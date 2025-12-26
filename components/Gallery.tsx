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
        items.map(async (itemRef) => {
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

  const shell =
    "rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-dh";

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Galería de Emociones"
        subtitle="Momentos que se sienten más rápido que un sprint 🟣🟢"
      />

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((p) => (
          <div
            key={p.id}
            className={[
              shell,
              "group overflow-hidden relative",
              "transition hover:bg-white/10 hover:border-white/15",
            ].join(" ")}
          >
            {/* Imagen */}
            <img
              src={p.src}
              alt={p.alt}
              loading="lazy"
              className={[
                "w-full h-56 object-cover",
                "transition-transform duration-500 group-hover:scale-[1.06]",
              ].join(" ")}
            />

            {/* Overlay suave para que combine con dark theme */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent opacity-90" />

            {/* Caption opcional (se ve sutil, no estorba) */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-xs text-white/70 truncate">
                {p.alt?.replace(/\.[^/.]+$/, "")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Botón Ver todas */}
      {showAllButton && photos.length > (limit ?? photos.length) && !showAll && (
        <div className="text-center pt-2">
          <button
            onClick={() => setShowAll(true)}
            className={[
              "inline-flex items-center justify-center",
              "px-6 py-2.5 rounded-full font-semibold transition shadow",
              "bg-dh-green text-dh-dark hover:bg-dh-green/90",
              "border border-white/10",
            ].join(" ")}
          >
            Ver todas
          </button>
          <p className="mt-2 text-xs text-white/45">
            Mostrando {displayed.length} de {photos.length}
          </p>
        </div>
      )}
    </section>
  );
}