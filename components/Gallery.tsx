import { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
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
  const [selected, setSelected] = useState<Photo | null>(null);

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
          };
        })
      );

      setPhotos(urls);
    };

    fetchGallery();
  }, []);

  const displayed = showAll || !limit ? photos : photos.slice(0, limit);

  return (
    <section className="relative py-24 bg-[#0c0c0f] overflow-hidden">

      {/* Fondo glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/20 via-black to-dh-green/20 blur-3xl opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 space-y-16">

        <SectionHeader
          title="Momentos que no se olvidan"
          subtitle="La energía antes del disparo, el esfuerzo en cada zancada."
        />

        {/* Grid Masonry */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {displayed.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="break-inside-avoid group relative cursor-pointer overflow-hidden rounded-3xl"
              onClick={() => setSelected(p)}
            >
              <img
                src={p.src}
                alt={p.alt}
                loading="lazy"
                className="w-full object-cover rounded-3xl transition-transform duration-700 group-hover:scale-110"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-500" />

              <div className="absolute bottom-4 left-4 text-white opacity-0 group-hover:opacity-100 transition">
                <p className="text-sm font-semibold">
                  {p.alt.replace(/\.[^/.]+$/, "")}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Botón Ver todas */}
        {showAllButton &&
          photos.length > (limit ?? photos.length) &&
          !showAll && (
            <div className="text-center">
              <button
                onClick={() => setShowAll(true)}
                className="bg-dh-green text-black font-bold px-8 py-4 rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,120,0.4)] transition-all"
              >
                Ver todas
              </button>
            </div>
          )}
      </div>

      {/* Modal Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-6"
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-6 right-6 text-white hover:text-dh-green transition"
            >
              <XMarkIcon className="w-8 h-8" />
            </button>

            <motion.img
              src={selected.src}
              alt={selected.alt}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className="max-h-[85vh] rounded-3xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

    </section>
  );
}
