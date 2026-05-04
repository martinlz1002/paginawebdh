import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import SectionHeader from "./SectionHeader";
import { useRouter } from "next/router";

interface Photo {
  id: string;
  url: string;
  alt?: string;
  eventoNombre?: string;
  destacada?: boolean;
  createdAt?: number;
}

interface GalleryProps {
  limit?: number;
  showAllButton?: boolean;
}

export default function Gallery({ limit, showAllButton }: GalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<Photo | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const snap = await getDocs(collection(db, "galeria"));

        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        })) as Photo[];

        // 🔥 separar destacadas
        const destacadas = data
          .filter((p) => p.destacada)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // 🎯 lógica final
        const resultado =
          limit != null
            ? destacadas.slice(0, limit) // HOME → máximo 6
            : data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // GALERÍA completa

        setPhotos(resultado);

      } catch (error) {
        console.error("Error cargando galería:", error);
      }
    };

    fetchGallery();
  }, [limit]);

  return (
    <section className="relative py-24 bg-[#0c0c0f] overflow-hidden">

      {/* Fondo glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/20 via-black to-dh-purple/20 blur-3xl opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 space-y-16">

        <SectionHeader
          title="DHTime el paso de los años!"
          subtitle="Momentos que construyen historia en cada meta."
        />

        {/* Grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {photos.map((p, i) => (
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
                src={p.url}
                alt={p.alt || "Foto"}
                loading="lazy"
                className="w-full object-cover rounded-3xl transition-transform duration-700 group-hover:scale-110"
              />

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-500" />

              <div className="absolute bottom-4 left-4 text-white opacity-0 group-hover:opacity-100 transition">
                <p className="text-sm font-semibold">
                  {p.eventoNombre || "Evento"}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Botón */}
        {showAllButton && limit != null && (
          <div className="text-center">
            <button
              onClick={() => router.push("/galeria")}
              className="bg-dh-purple text-black font-bold px-8 py-4 rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,120,0.4)] transition-all"
            >
              Ver más
            </button>
          </div>
        )}

      </div>

      {/* Lightbox */}
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
              className="absolute top-6 right-6 text-white hover:text-dh-purple transition"
            >
              <XMarkIcon className="w-8 h-8" />
            </button>

            <motion.img
              src={selected.url}
              alt={selected.alt || ""}
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