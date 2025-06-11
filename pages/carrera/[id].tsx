import { useRouter } from 'next/router'

export default function CarreraDetalle() {
  const router = useRouter()
  const { id } = router.query

  return <div className="p-4">Detalles de la carrera con ID: {id}</div>
}
