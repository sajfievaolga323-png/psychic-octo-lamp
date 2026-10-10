import { AccessToken } from 'livekit-server-sdk'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const room = (searchParams.get('room') || '').toLowerCase()
  const name = (searchParams.get('name') || '').trim().slice(0, 40)

  if (!/^[a-z0-9-]{4,40}$/.test(room) || !name) {
    return Response.json({ error: 'Неверная ссылка или пустое имя' }, { status: 400 })
  }
  const key = process.env.LIVEKIT_API_KEY
  const secret = process.env.LIVEKIT_API_SECRET
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL
  if (!key || !secret || !url) {
    return Response.json(
      { error: 'На сервере не заданы LIVEKIT_API_KEY, LIVEKIT_API_SECRET и NEXT_PUBLIC_LIVEKIT_URL' },
      { status: 500 }
    )
  }
  const identity = `${name}-${Math.random().toString(36).slice(2, 7)}`
  const at = new AccessToken(key, secret, { identity, name, ttl: '6h' })
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true })
  return Response.json({ token: await at.toJwt(), url })
}
