import Link from 'next/link'

export default function Header() {
  return (
    <header className="bg-gray-800 text-white p-4">
      <nav className="flex justify-between">
        <Link href="/">Inicio</Link>
        <Link href="/perfil">Perfil</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </header>
  )
}