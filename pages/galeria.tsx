import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface Photo {
  id: string;
  url: string;
  alt?: string;
  eventoNombre?: string;
  createdAt?: number;
}

export default function GaleriaPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<Photo | null>(null);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const snap = await getDocs(collection(db, "galeria"));

        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        })) as Photo[];

        // 🔥 ordenar global (más recientes primero)
        const sorted = data.sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );

        setPhotos(sorted);

      } catch (error) {
        console.error("Error cargando galería:", error);
      }
    };

    fetchGallery();
  }, []);

  // 🧠 Agrupar por evento (ordenado)
  const grouped = photos.reduce<Record<string, Photo[]>>((acc, photo) => {
    const key = photo.eventoNombre || "Otros";

    if (!acc[key]) acc[key] = [];
    acc[key].push(photo);

    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0c0c0f] py-24 px-6">

      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-20 text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-white">
          Galería DHTime
        </h1>
        <p className="text-gray-400">
          Revive cada evento, cada meta, cada historia.
        </p>
      </div>

      {/* CONTENIDO */}
      <div className="max-w-7xl mx-auto space-y-20">

        {Object.entries(grouped).map(([evento, fotos]) => (
          <div key={evento} className="space-y-8">

            {/* Título evento */}
            <h2 className="text-2xl md:text-3xl font-extrabold text-dh-purple">
              {evento}
            </h2>

            {/* Grid */}
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
              {fotos.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.03 }}
                  viewport={{ once: true }}
                  className="break-inside-avoid cursor-pointer overflow-hidden rounded-3xl group relative"
                  onClick={() => setSelected(p)}
                >
                  <img
                    src={p.url}
                    alt={p.alt || ""}
                    className="w-full object-cover rounded-3xl transition-transform duration-700 group-hover:scale-110"
                  />

                  {/* overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition" />
                </motion.div>
              ))}
            </div>

          </div>
        ))}

      </div>

      {/* LIGHTBOX */}
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

    </div>
  );
}