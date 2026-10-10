'use client'
import Room from '../../../components/Room'

export default function Page({ params }) {
  return <Room roomId={params.id} />
}
