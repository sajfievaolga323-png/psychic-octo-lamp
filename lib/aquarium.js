// Живой аквариум на canvas: рыбки, пузырьки, водоросли, лучи света.
export function createAquarium(w, h) {
  const R = Math.random
  const palette = [
    ['#ff7a1a', '#fff3e0'],
    ['#ffd23f', '#2b6cff'],
    ['#ff4d8d', '#ffe0ec'],
    ['#2ee6d6', '#0b6e8a'],
    ['#8a6bff', '#e6e0ff'],
    ['#ff5a36', '#ffffff'],
    ['#7dff6b', '#1b7a4a'],
  ]

  const fish = Array.from({ length: 15 }, () => {
    const L = h * (0.05 + R() * 0.075)
    return {
      x: R() * w,
      y: h * (0.1 + R() * 0.62),
      L,
      v: L * (0.5 + R() * 1.1),
      dir: R() < 0.5 ? -1 : 1,
      ph: R() * 6.28,
      c: palette[(R() * palette.length) | 0],
      wob: h * (0.008 + R() * 0.02),
    }
  })

  const bubbles = Array.from({ length: 32 }, () => ({
    x: R() * w,
    y: R() * h,
    r: h * (0.004 + R() * 0.01),
    v: h * (0.05 + R() * 0.12),
    ph: R() * 6.28,
  }))

  const greens = ['#1fbf75', '#13a06a', '#6fd64a', '#0e8a5f']
  const blades = Array.from({ length: 18 }, (_, i) => {
    const left = i % 2 === 0
    return {
      x: left ? R() * w * 0.24 : w * (0.76 + R() * 0.24),
      hgt: h * (0.2 + R() * 0.28),
      wid: h * (0.012 + R() * 0.012),
      col: greens[(R() * greens.length) | 0],
      ph: R() * 6.28,
    }
  })

  const stat = document.createElement('canvas')
  stat.width = w
  stat.height = h
  drawStatic(stat.getContext('2d'), w, h)

  function draw(ctx, t, dt) {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#2bb8d8')
    g.addColorStop(0.5, '#0d78a6')
    g.addColorStop(1, '#043553')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)

    // лучи света
    ctx.fillStyle = 'rgba(200,255,255,0.07)'
    for (let i = 0; i < 6; i++) {
      const x0 = w * (i / 5.5) + Math.sin(t * 0.25 + i * 1.7) * w * 0.05
      ctx.beginPath()
      ctx.moveTo(x0, 0)
      ctx.lineTo(x0 + w * 0.07, 0)
      ctx.lineTo(x0 + w * 0.02 - w * 0.12, h)
      ctx.lineTo(x0 - w * 0.12 - w * 0.06, h)
      ctx.closePath()
      ctx.fill()
    }

    ctx.drawImage(stat, 0, 0)

    // водоросли
    for (const b of blades) {
      const base = h * 0.95
      const sway = Math.sin(t * 1.1 + b.ph) * b.hgt * 0.12
      ctx.strokeStyle = b.col
      ctx.lineWidth = b.wid
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(b.x, base)
      ctx.quadraticCurveTo(b.x + sway, base - b.hgt * 0.55, b.x + sway * 1.8, base - b.hgt)
      ctx.stroke()
    }

    // рыбки
    for (const f of fish) {
      f.x += f.dir * f.v * dt
      if (f.dir > 0 && f.x > w + f.L) { f.x = -f.L; f.y = h * (0.1 + R() * 0.62) }
      if (f.dir < 0 && f.x < -f.L) { f.x = w + f.L; f.y = h * (0.1 + R() * 0.62) }
      drawFish(ctx, f, t)
    }

    // пузырьки
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1.5
    for (const b of bubbles) {
      b.y -= b.v * dt
      if (b.y < -b.r) { b.y = h + b.r; b.x = R() * w }
      const x = b.x + Math.sin(t * 1.5 + b.ph) * h * 0.01
      ctx.beginPath()
      ctx.arc(x, b.y, b.r, 0, 6.283)
      ctx.fill()
      ctx.stroke()
    }
  }

  return { draw }
}

function drawFish(ctx, f, t) {
  const { L } = f
  const wag = Math.sin(t * 8 + f.ph) * L * 0.12
  ctx.save()
  ctx.translate(f.x, f.y + Math.sin(t * 1.2 + f.ph) * f.wob)
  ctx.scale(f.dir, 1)
  ctx.fillStyle = f.c[0]
  // хвост
  ctx.beginPath()
  ctx.moveTo(-L * 0.38, 0)
  ctx.lineTo(-L * 0.8, -L * 0.28 + wag)
  ctx.lineTo(-L * 0.8, L * 0.28 + wag)
  ctx.closePath()
  ctx.fill()
  // плавник
  ctx.beginPath()
  ctx.moveTo(-L * 0.1, -L * 0.25)
  ctx.quadraticCurveTo(L * 0.05, -L * 0.52, L * 0.2, -L * 0.24)
  ctx.closePath()
  ctx.fill()
  // тело
  ctx.beginPath()
  ctx.ellipse(0, 0, L * 0.5, L * 0.3, 0, 0, 6.283)
  ctx.fill()
  // полоса
  ctx.save()
  ctx.clip()
  ctx.fillStyle = f.c[1]
  ctx.globalAlpha = 0.85
  ctx.fillRect(L * 0.02, -L, L * 0.11, L * 2)
  ctx.restore()
  // глаз
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(L * 0.3, -L * 0.07, L * 0.07, 0, 6.283)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(L * 0.32, -L * 0.07, L * 0.035, 0, 6.283)
  ctx.fill()
  ctx.restore()
}

function coral(ctx, x, y, s, color) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineWidth = s * 0.13
  const arms = [-0.9, -0.45, 0, 0.45, 0.9]
  for (const a of arms) {
    const len = s * (0.7 + Math.abs(Math.cos(a * 3)) * 0.5)
    const ex = x + Math.sin(a) * len
    const ey = y - Math.cos(a) * len
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ex, ey, s * 0.11, 0, 6.283)
    ctx.fill()
  }
}

function drawStatic(ctx, w, h) {
  // песок
  const sand = ctx.createLinearGradient(0, h * 0.86, 0, h)
  sand.addColorStop(0, '#f0d9a0')
  sand.addColorStop(1, '#b98f55')
  ctx.fillStyle = sand
  ctx.beginPath()
  ctx.moveTo(0, h * 0.92)
  ctx.quadraticCurveTo(w * 0.25, h * 0.86, w * 0.5, h * 0.92)
  ctx.quadraticCurveTo(w * 0.78, h * 0.97, w, h * 0.9)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
  // камни
  const rocks = [[0.07, 0.94, 0.07, '#5d7f93'], [0.18, 0.96, 0.05, '#7c9bab'], [0.9, 0.95, 0.08, '#5d7f93'], [0.78, 0.97, 0.05, '#7c9bab']]
  for (const [rx, ry, rs, col] of rocks) {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.ellipse(w * rx, h * ry, w * rs, h * rs * 0.7, 0, 0, 6.283)
    ctx.fill()
  }
  // кораллы
  const s = h * 0.17
  coral(ctx, w * 0.1, h * 0.93, s, '#ff5f8a')
  coral(ctx, w * 0.2, h * 0.95, s * 0.75, '#ff9a3c')
  coral(ctx, w * 0.82, h * 0.94, s * 0.9, '#b266ff')
  coral(ctx, w * 0.93, h * 0.93, s * 0.8, '#ff5f8a')
  // коралл-шар
  ctx.fillStyle = '#ffb347'
  ctx.beginPath()
  ctx.arc(w * 0.27, h * 0.95, h * 0.05, Math.PI, 0)
  ctx.fill()
}
