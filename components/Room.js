'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Room as LKRoom, RoomEvent, Track } from 'livekit-client'
import { createPipeline } from '../lib/pipeline'

const QUICK = ['Да', 'Нет', 'Спасибо', 'Повторите, пожалуйста', 'Одну минуту', 'Согласна']
const BG = [
  ['aquarium', 'Аквариум'],
  ['blur', 'Размытие'],
  ['none', 'Без фона'],
]
const enc = new TextEncoder()
const dec = new TextDecoder()

const ICONS = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  cam: 'M3 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3zM16 10l5-3v10l-5-3',
  screen: 'M3 5h18v11H3zM8 20h8M12 16v4',
  chat: 'M4 5h16v11H9l-5 4z',
  fish: 'M3 12c3-5 9-6 13-2l5-3v10l-5-3c-4 4-10 3-13-2z',
  leave: 'M3 14c5-5 13-5 18 0l-2.5 3-3-1.5v-2.5c-2-.8-5-.8-7 0v2.5l-3 1.5z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  voice: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6',
}

function Icon({ name, off }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

function say(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ru-RU'
  const v = window.speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith('ru'))
  if (v) u.voice = v
  window.speechSynthesis.speak(u)
}

function RawVideo({ track, mirror }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && track) ref.current.srcObject = new MediaStream([track])
  }, [track])
  return <video ref={ref} autoPlay muted playsInline className={mirror ? 'mirror' : ''} />
}

function LKVideo({ track }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])
  return <video ref={ref} autoPlay playsInline muted />
}

function Tile({ p, rawTrack, screen, big, onClick }) {
  const track = screen ? p.screen : p.local ? null : p.video
  const showVideo = screen ? !!p.screen : p.camOn
  const label = screen ? `${p.name}: экран` : p.local ? `${p.name} (вы)` : p.name
  return (
    <button
      type="button"
      className={`tile${big ? ' big' : ''}${p.speaking && !screen ? ' speaking' : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      {showVideo ? (
        p.local && !screen ? <RawVideo track={rawTrack} mirror /> : <LKVideo track={track} />
      ) : (
        <span className="avatar">{(p.name || '?').slice(0, 1).toUpperCase()}</span>
      )}
      <span className="tile-name">
        {!p.micOn && !screen && <i className="mutedot" title="Микрофон выключен" />}
        {label}
      </span>
    </button>
  )
}

export default function Room({ roomId }) {
  const [stage, setStage] = useState('prejoin')
  const [name, setName] = useState('')
  const [bg, setBg] = useState('aquarium')
  const [segStatus, setSegStatus] = useState('')
  const [camErr, setCamErr] = useState(false)
  const [rawTrack, setRawTrack] = useState(null)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [parts, setParts] = useState([])
  const [pin, setPin] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [draft, setDraft] = useState('')
  const [speakAuto, setSpeakAuto] = useState(true)
  const [ttsOn, setTtsOn] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [bgMenu, setBgMenu] = useState(false)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)

  const pipeRef = useRef(null)
  const roomRef = useRef(null)
  const audioBox = useRef(null)
  const logRef = useRef(null)
  const ttsRef = useRef(true)
  ttsRef.current = ttsOn

  useEffect(() => {
    setName(localStorage.getItem('aq-name') || '')
    let cancelled = false
    createPipeline(setSegStatus)
      .then((p) => {
        if (cancelled) return p.stop()
        pipeRef.current = p
        p.setMode('aquarium')
        setRawTrack(p.track)
      })
      .catch(() => setCamErr(true))
    return () => {
      cancelled = true
      if (pipeRef.current) pipeRef.current.stop()
      if (roomRef.current) roomRef.current.disconnect()
    }
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [msgs])

  const chooseBg = (m) => {
    setBg(m)
    setBgMenu(false)
    if (pipeRef.current) pipeRef.current.setMode(m)
  }

  const sync = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const all = [room.localParticipant, ...room.remoteParticipants.values()]
    setParts(
      all.map((p) => {
        const cam = p.getTrackPublication(Track.Source.Camera)
        const scr = p.getTrackPublication(Track.Source.ScreenShare)
        const mic = p.getTrackPublication(Track.Source.Microphone)
        return {
          id: p.identity,
          name: p.name || p.identity,
          local: p.isLocal,
          video: cam && cam.track ? cam.track : null,
          screen: scr && scr.track ? scr.track : null,
          camOn: !!cam && !cam.isMuted,
          micOn: !!mic && !mic.isMuted,
          speaking: p.isSpeaking,
        }
      })
    )
  }, [])

  const join = async () => {
    const n = name.trim()
    if (!n) return setError('Введите имя')
    setError('')
    setJoining(true)
    localStorage.setItem('aq-name', n)
    try {
      const res = await fetch(`/api/token?room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(n)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Не удалось получить доступ в комнату')

      const room = new LKRoom({ adaptiveStream: true, dynacast: true })
      roomRef.current = room
      room
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio && audioBox.current) audioBox.current.appendChild(track.attach())
          sync()
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) track.detach().forEach((e) => e.remove())
          sync()
        })
        .on(RoomEvent.DataReceived, (payload) => {
          try {
            const d = JSON.parse(dec.decode(payload))
            if (d.t !== 'chat') return
            setMsgs((x) => [...x, { ...d, me: false }])
            if (d.speak && ttsRef.current) say(d.text)
          } catch {}
        })
        .on(RoomEvent.Disconnected, () => setError('Соединение потеряно. Обновите страницу, чтобы зайти снова.'))
      ;[
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
        RoomEvent.TrackPublished,
        RoomEvent.TrackUnpublished,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.ActiveSpeakersChanged,
      ].forEach((ev) => room.on(ev, sync))

      await room.connect(data.url, data.token)
      try {
        await room.localParticipant.setMicrophoneEnabled(micOn)
      } catch {
        setMicOn(false)
      }
      if (pipeRef.current && camOn) {
        await room.localParticipant.publishTrack(pipeRef.current.track, {
          source: Track.Source.Camera,
          name: 'camera',
        })
      }
      sync()
      setStage('room')
    } catch (e) {
      setError(e.message || 'Не удалось войти')
      if (roomRef.current) roomRef.current.disconnect()
    }
    setJoining(false)
  }

  const toggleMic = async () => {
    const next = !micOn
    setMicOn(next)
    if (stage !== 'room') return
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(next)
    } catch {
      setMicOn(false)
    }
    sync()
  }

  const toggleCam = async () => {
    const next = !camOn
    setCamOn(next)
    if (stage !== 'room') return
    const lp = roomRef.current.localParticipant
    const pub = lp.getTrackPublication(Track.Source.Camera)
    if (pub) {
      next ? await pub.unmute() : await pub.mute()
    } else if (next && pipeRef.current) {
      await lp.publishTrack(pipeRef.current.track, { source: Track.Source.Camera, name: 'camera' })
    }
    sync()
  }

  const toggleShare = async () => {
    try {
      await roomRef.current.localParticipant.setScreenShareEnabled(!sharing)
      setSharing(!sharing)
    } catch {
      setSharing(false)
    }
    sync()
  }

  const leave = () => {
    if (roomRef.current) roomRef.current.disconnect()
    if (pipeRef.current) pipeRef.current.stop()
    window.location.href = '/'
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Скопируйте ссылку:', window.location.href)
    }
  }

  const send = (text, speak) => {
    const t = text.trim()
    if (!t || !roomRef.current) return
    const m = { t: 'chat', from: name.trim(), text: t, speak, ts: Date.now() }
    roomRef.current.localParticipant.publishData(enc.encode(JSON.stringify(m)), { reliable: true })
    setMsgs((x) => [...x, { ...m, me: true }])
    setDraft('')
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(draft, speakAuto)
    }
  }

  const bgNote =
    segStatus === 'loading' && bg !== 'none'
      ? 'Готовлю вырезание фона…'
      : segStatus === 'error' && bg !== 'none'
        ? 'Вырезание фона недоступно. Проверьте интернет и обновите страницу.'
        : ''

  /* ---------- вход ---------- */
  if (stage === 'prejoin') {
    return (
      <main className="prejoin">
        <div className="prejoin-preview">
          {rawTrack && camOn ? <RawVideo track={rawTrack} mirror /> : (
            <div className="prejoin-empty">
              {camErr ? 'Нет доступа к камере. Разрешите её в настройках браузера и обновите страницу.' : camOn ? 'Включаю камеру…' : 'Камера выключена'}
            </div>
          )}
          {bgNote && <div className="note">{bgNote}</div>}
        </div>
        <section className="prejoin-form">
          <h1>Войти в звонок</h1>
          <label htmlFor="nm">Ваше имя</label>
          <input id="nm" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && join()} placeholder="Как вас называть" maxLength={40} autoFocus />
          <fieldset>
            <legend>Фон за спиной</legend>
            <div className="seg">
              {BG.map(([k, l]) => (
                <button key={k} type="button" className={bg === k ? 'on' : ''} onClick={() => chooseBg(k)}>{l}</button>
              ))}
            </div>
          </fieldset>
          <div className="row">
            <button type="button" className={`chip${micOn ? ' on' : ''}`} onClick={toggleMic}>Микрофон: {micOn ? 'вкл' : 'выкл'}</button>
            <button type="button" className={`chip${camOn ? ' on' : ''}`} onClick={toggleCam}>Камера: {camOn ? 'вкл' : 'выкл'}</button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary" onClick={join} disabled={joining}>{joining ? 'Подключаюсь…' : 'Войти'}</button>
        </section>
      </main>
    )
  }

  /* ---------- комната ---------- */
  const screenOwner = parts.find((p) => p.screen)
  const main = screenOwner
    ? { p: screenOwner, screen: true }
    : { p: parts.find((p) => p.id === pin) || parts.find((p) => !p.local) || parts.find((p) => p.local) }

  return (
    <main className={`room${chatOpen ? ' with-chat' : ''}`}>
      <header className="bar">
        <strong className="brand">Аквариум</strong>
        <span className="count">Участников: {parts.length}</span>
        <button type="button" className="chip on" onClick={copyLink}>
          <Icon name="link" /> {copied ? 'Ссылка скопирована' : 'Пригласить'}
        </button>
      </header>

      <section className="strip" aria-label="Участники">
        {parts.map((p) => (
          <Tile key={p.id} p={p} rawTrack={rawTrack} onClick={() => setPin(p.id)} />
        ))}
      </section>

      <section className="stage">
        {main.p && <Tile p={main.p} rawTrack={rawTrack} screen={main.screen} big />}
        {bgNote && <div className="note">{bgNote}</div>}
        {error && <div className="note" role="alert">{error}</div>}
      </section>

      <aside className="chat" aria-label="Чат">
        <div className="chat-head">
          <strong>Чат</strong>
          <button type="button" className={`chip${ttsOn ? ' on' : ''}`} onClick={() => setTtsOn(!ttsOn)} title="Слышать озвучку сообщений других участников">
            <Icon name="voice" off={!ttsOn} /> Голос
          </button>
        </div>
        <div className="log" ref={logRef}>
          {msgs.length === 0 && <p className="empty">Сообщений пока нет. Напишите, и текст прозвучит у всех участников.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`msg${m.me ? ' me' : ''}`}>
              <span className="who">{m.me ? 'Вы' : m.from}{m.speak ? ', озвучено' : ''}</span>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
        <div className="quick">
          {QUICK.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => send(q, true)}>{q}</button>
          ))}
        </div>
        <div className="compose">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder="Напишите сообщение" rows={2} aria-label="Сообщение" />
          <div className="row">
            <button type="button" className="btn-primary" onClick={() => send(draft, speakAuto)}>{speakAuto ? 'Сказать' : 'Отправить'}</button>
            {!speakAuto && <button type="button" className="btn-ghost" onClick={() => send(draft, true)}>Сказать</button>}
          </div>
          <label className="switch">
            <input type="checkbox" checked={speakAuto} onChange={(e) => setSpeakAuto(e.target.checked)} />
            Озвучивать сразу при отправке
          </label>
        </div>
      </aside>

      <nav className="controls" aria-label="Управление">
        <button type="button" className={!micOn ? 'off' : ''} onClick={toggleMic}><Icon name="mic" off={!micOn} /><span>Микрофон</span></button>
        <button type="button" className={!camOn ? 'off' : ''} onClick={toggleCam}><Icon name="cam" off={!camOn} /><span>Камера</span></button>
        <button type="button" className={sharing ? 'active' : ''} onClick={toggleShare}><Icon name="screen" /><span>Демонстрация</span></button>
        <div className="bgwrap">
          <button type="button" className={bgMenu ? 'active' : ''} onClick={() => setBgMenu(!bgMenu)}><Icon name="fish" /><span>Фон</span></button>
          {bgMenu && (
            <div className="menu" role="menu">
              {BG.map(([k, l]) => (
                <button key={k} type="button" role="menuitemradio" aria-checked={bg === k} className={bg === k ? 'on' : ''} onClick={() => chooseBg(k)}>{l}</button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className={chatOpen ? 'active' : ''} onClick={() => setChatOpen(!chatOpen)}><Icon name="chat" /><span>Чат</span></button>
        <button type="button" className="leave" onClick={leave}><Icon name="leave" /><span>Выйти</span></button>
      </nav>
      <div ref={audioBox} hidden />
    </main>
  )
}
