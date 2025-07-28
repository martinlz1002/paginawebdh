import { useEffect, useState } from 'react'
import { ref, listAll, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import AuthGuard from '@/components/AuthGuard'

export default function GaleriaPage() {
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    const listRef = ref(storage, 'galeria')
    listAll(listRef).then(res =>
      Promise.all(res.items.map(item => getDownloadURL(item))).then(setPhotos)
    )
  }, [])

  return (
    <AuthGuard>
      <main className="max-w-6xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Galería Completa</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {photos.map((src, i) => (
            <div key={i} className="overflow-hidden rounded-2xl shadow-lg">
              <img
                src={src}
                alt={`foto-${i}`}
                className="w-full h-56 object-cover transition-transform hover:scale-105"
              />
            </div>
          ))}
        </div>
      </main>
    </AuthGuard>
  )
}