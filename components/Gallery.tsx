import { useEffect, useState } from 'react';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

interface Photo {
  id: string;
  src: string;
  alt?: string;
}

export default function Gallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    (async () => {
      // Referencia a la carpeta "galeria"
      const listRef = ref(storage, 'galeria');
      try {
        const res = await listAll(listRef);
        const urls = await Promise.all(
          res.items.map(async (itemRef) => {
            const url = await getDownloadURL(itemRef);
            return { id: itemRef.name, src: url, alt: itemRef.name };
          })
        );
        setPhotos(urls);
      } catch (e) {
        console.error('Error cargando galería:', e);
      }
    })();
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Galería de Emociones</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl shadow-lg">
            <img
              src={p.src}
              alt={p.alt || ''}
              className="w-full h-56 object-cover transition-transform hover:scale-105"
            />
          </div>
        ))}
      </div>
    </section>
  );
}