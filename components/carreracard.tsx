import Link from 'next/link'

interface CarreraCardProps {
  id: string
  nombre: string
  fecha: string
}

export default function CarreraCard({ id, nombre, fecha }: CarreraCardProps) {
  return (
    <div className="border rounded p-4 shadow">
      <h2 className="text-xl font-bold">{nombre}</h2>
      <p>{fecha}</p>
      <Link href={`/carrera/${id}`} className="text-blue-500 underline">Ver detalles</Link>
    </div>
  )
}