import { useState, useEffect } from 'react';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

interface Photo {
  id: string;
  src: string;
  alt?: string;
}

interface GalleryProps {
  /** Número máximo de fotos a mostrar inicialmente */
  limit?: number;
  /** Indica si debe incluir botón para ver todas */
  showAllButton?: boolean;
}

export default function Gallery({ limit = 6, showAllButton = false }: GalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Lista todos los archivos en storage/galeria
    const galleryRef = ref(storage, 'galeria');
    listAll(galleryRef)
      .then(async (res) => {
        const items = await Promise.all(
          res.items.map(async (itemRef) => {
            const url = await getDownloadURL(itemRef);
            return { id: itemRef.fullPath, src: url, alt: itemRef.name };
          })
        );
        // Ordenados por nombre (asume timestamps en el nombre para orden cronológico)
        items.sort((a, b) => b.id.localeCompare(a.id));
        setPhotos(items);
      })
      .catch(console.error);
  }, []);

  const visiblePhotos = expanded ? photos : photos.slice(0, limit);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Galería de Emociones</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visiblePhotos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl shadow-lg">
            <img
              src={p.src}
              alt={p.alt}
              className="w-full h-56 object-cover transition-transform hover:scale-105"
            />
          </div>
        ))}
      </div>
      {showAllButton && photos.length > limit && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition"
        >
          {expanded ? 'Ver Menos' : `Ver Todas (${photos.length})`}
        </button>
      )}
    </section>
  );
}
