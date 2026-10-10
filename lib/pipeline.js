import { createAquarium } from './aquarium'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Берёт камеру, вырезает человека и подставляет аквариум (или размытие).
// Возвращает canvas и видеотрек, который публикуется в звонок.
export async function createPipeline(onStatus = () => {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    audio: false,
  })
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()

  const w = video.videoWidth || 1280
  const h = video.videoHeight || 720
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  const person = document.createElement('canvas')
  person.width = w
  person.height = h
  const pctx = person.getContext('2d')

  const maskCanvas = document.createElement('canvas')
  let mctx = null
  let maskImg = null

  const aquarium = createAquarium(w, h)
  let mode = 'aquarium'
  let seg = null
  let segLoading = false
  let maskReady = false
  let invert = false
  let lastVideoTime = -1
  let frameN = 0
  let last = performance.now() / 1000

  async function loadSeg() {
    if (seg || segLoading) return
    segLoading = true
    onStatus('loading')
    try {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(WASM)
      const make = (delegate) =>
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        })
      try {
        seg = await make('GPU')
      } catch {
        seg = await make('CPU')
      }
      onStatus('ready')
    } catch (e) {
      console.error(e)
      onStatus('error')
    }
    segLoading = false
  }

  function avg(data, mw, mh, x0, x1, y0, y1) {
    let s = 0, n = 0
    for (let y = Math.floor(y0 * mh); y < Math.floor(y1 * mh); y++) {
      for (let x = Math.floor(x0 * mw); x < Math.floor(x1 * mw); x++) {
        s += data[y * mw + x]
        n++
      }
    }
    return n ? s / n : 0
  }

  function runSeg() {
    if (!seg || video.currentTime === lastVideoTime) return
    lastVideoTime = video.currentTime
    seg.segmentForVideo(video, performance.now(), (res) => {
      const m = res.confidenceMasks && res.confidenceMasks[0]
      if (!m) return
      const mw = m.width
      const mh = m.height
      const data = m.getAsFloat32Array()
      if (!mctx || maskCanvas.width !== mw || maskCanvas.height !== mh) {
        maskCanvas.width = mw
        maskCanvas.height = mh
        mctx = maskCanvas.getContext('2d')
        maskImg = mctx.createImageData(mw, mh)
      }
      // определяем, что в маске «человек»: центр кадра против верхних углов
      if (frameN % 60 === 0) {
        const c = avg(data, mw, mh, 0.4, 0.6, 0.45, 0.75)
        const e = (avg(data, mw, mh, 0, 0.12, 0, 0.12) + avg(data, mw, mh, 0.88, 1, 0, 0.12)) / 2
        if (Math.abs(c - e) > 0.3) invert = c < e
      }
      const px = maskImg.data
      for (let i = 0; i < data.length; i++) {
        let p = data[i]
        if (invert) p = 1 - p
        px[i * 4 + 3] = smooth(0.3, 0.7, p) * 255
      }
      mctx.putImageData(maskImg, 0, 0)
      maskReady = true
    })
  }

  function frame() {
    if (video.readyState < 2) return
    const now = performance.now() / 1000
    const dt = Math.min(0.1, now - last)
    last = now
    frameN++
    if (mode === 'none') {
      ctx.drawImage(video, 0, 0, w, h)
      return
    }
    runSeg()
    if (!maskReady) {
      ctx.drawImage(video, 0, 0, w, h)
      return
    }
    if (mode === 'aquarium') {
      aquarium.draw(ctx, now, dt)
    } else {
      ctx.filter = 'blur(16px)'
      ctx.drawImage(video, 0, 0, w, h)
      ctx.filter = 'none'
    }
    pctx.globalCompositeOperation = 'source-over'
    pctx.clearRect(0, 0, w, h)
    pctx.drawImage(video, 0, 0, w, h)
    pctx.globalCompositeOperation = 'destination-in'
    pctx.filter = 'blur(3px)'
    pctx.drawImage(maskCanvas, 0, 0, w, h)
    pctx.filter = 'none'
    pctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(person, 0, 0)
  }

  // Таймер в воркере, чтобы видео не замирало, когда вкладка в фоне
  let worker = null
  let timer = null
  try {
    const src = 'let id;onmessage=e=>{clearInterval(id);if(e.data)id=setInterval(()=>postMessage(0),e.data)}'
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })))
    worker.onmessage = frame
    worker.postMessage(33)
  } catch {
    timer = setInterval(frame, 33)
  }

  loadSeg()

  return {
    canvas,
    track: canvas.captureStream(30).getVideoTracks()[0],
    setMode(m) {
      mode = m
      if (m !== 'none') loadSeg()
    },
    stop() {
      if (worker) worker.terminate()
      if (timer) clearInterval(timer)
      stream.getTracks().forEach((t) => t.stop())
    },
  }
}
