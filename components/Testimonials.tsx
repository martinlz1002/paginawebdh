import { useEffect, useState } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import SectionHeader from './SectionHeader'

interface Testimonial {
  id: string
  author: string
  text: string
  avatarUrl?: string
}

export default function Testimonials() {
  const [items, setItems] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [newText, setNewText] = useState('')

  // Carga inicial
  const fetchTestimonials = async () => {
    const res = await fetch('/api/testimonials')
    const data = await res.json()
    setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchTestimonials()
    const auth = getAuth()
    return onAuthStateChanged(auth, u => setUser(u))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newText.trim()) return
    const token = await user.getIdToken()
    await fetch('/api/testimonials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        author: user.displayName || user.email!.split('@')[0],
        text: newText.trim(),
        avatarUrl: user.photoURL || null,
      }),
    })
    setNewText('')
    await fetchTestimonials()
  }

  return (
    <section className="space-y-6">
      <SectionHeader title="Testimonios de Corredores" />

      {user && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Escribe tu testimonio...."
            className="w-full border rounded-xl p-3 resize-none focus:ring-2 focus:ring-blue-400"
            rows={3}
          />
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl transition"
          >
            Enviar Testimonio
          </button>
        </form>
      )}

      {loading ? (
        <p>Cargando testimonios…</p>
      ) : items.length === 0 ? (
        <p>No hay testimonios aún. ¡Sé el primero!</p>
      ) : (
        <div className="space-y-4">
          {items.map(t => (
            <div
              key={t.id}
              className="bg-white rounded-2xl shadow-sm p-6 flex gap-4"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center overflow-hidden">
                {t.avatarUrl ? (
                  <img
                    src={t.avatarUrl}
                    alt={t.author}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-purple-600 font-bold">
                    {t.author.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <p className="italic text-gray-700">“{t.text}”</p>
                <p className="mt-2 font-medium text-gray-800">— {t.author}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}