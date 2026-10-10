'use client'
import { useEffect, useRef } from 'react'
import { createAquarium } from '../lib/aquarium'

export default function Home() {
  const ref = useRef(null)

  useEffect(() => {
    const c = ref.current
    const w = 1280, h = 720
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    const aq = createAquarium(w, h)
    let last = performance.now() / 1000
    let raf
    const loop = () => {
      const now = performance.now() / 1000
      aq.draw(ctx, now, Math.min(0.1, now - last))
      last = now
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  const create = () => {
    const id = Math.random().toString(36).slice(2, 10)
    window.location.href = `/room/${id}`
  }

  return (
    <main className="home">
      <canvas ref={ref} className="home-aquarium" aria-hidden="true" />
      <section className="home-card">
        <h1>Видеозвонки с аквариумом за спиной</h1>
        <p>
          Создайте комнату и отправьте ссылку команде. Вход без паролей и регистрации: человек
          вводит имя и попадает в звонок. Всё, что у вас за спиной, скрыто, а текст из чата
          звучит голосом для всех.
        </p>
        <button className="btn-primary" onClick={create}>Создать комнату</button>
      </section>
    </main>
  )
}
