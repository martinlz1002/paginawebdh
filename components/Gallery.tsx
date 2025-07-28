import { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import SectionHeader from "./SectionHeader";

interface Photo {
  id: string;
  src: string;
  alt: string;
}

interface GalleryProps {
  limit?: number;
  showAllButton?: boolean;
}

export default function Gallery({ limit, showAllButton }: GalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchGallery = async () => {
      const galleryRef = ref(storage, "galeria");
      const { items } = await listAll(galleryRef);
      const urls = await Promise.all(
        items.map(async (itemRef, idx) => {
          const url = await getDownloadURL(itemRef);
          return {
            id: itemRef.name,
            src: url,
            alt: itemRef.name,
          } as Photo;
        })
      );
      setPhotos(urls);
    };
    fetchGallery();
  }, []);

  const displayed = showAll || !limit ? photos : photos.slice(0, limit);

  return (
    <section className="space-y-6">
      <SectionHeader title="Galería de Emociones" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayed.map((p) => (
          <div
            key={p.id}
            className="overflow-hidden rounded-2xl shadow-lg"
          >
            <img
              src={p.src}
              alt={p.alt}
              className="w-full h-56 object-cover transition-transform hover:scale-105"
            />
          </div>
        ))}
      </div>
      {showAllButton && photos.length > (limit ?? photos.length) && !showAll && (
        <div className="text-center mt-4">
          <button
            onClick={() => setShowAll(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full transition"
          >
            Ver todas
          </button>
        </div>
      )}
    </section>
  );
}