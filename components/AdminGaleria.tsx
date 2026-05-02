import { useState, useEffect, useRef } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

interface Carrera {
  id: string;
  titulo: string;
}

export default function AdminGaleria() {
  const [file, setFile] = useState<File | null>(null);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [eventoId, setEventoId] = useState("");
  const [destacada, setDestacada] = useState(false);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadCarreras = async () => {
      const snap = await getDocs(collection(db, "carreras"));
      const data = snap.docs.map(doc => ({
        id: doc.id,
        titulo: (doc.data() as any).titulo
      }));
      setCarreras(data);
    };

    loadCarreras();
  }, []);

  const handleUpload = async () => {
    if (!file || !eventoId) {
      alert("Selecciona una carrera y una imagen");
      return;
    }

    setLoading(true);

    try {
      const storageRef = ref(storage, `galeria/${eventoId}/${file.name}`);
      await uploadBytes(storageRef, file);

      const url = await getDownloadURL(storageRef);

      const carrera = carreras.find(c => c.id === eventoId);

      await addDoc(collection(db, "galeria"), {
        url,
        eventoId,
        eventoNombre: carrera?.titulo || "",
        destacada,
        createdAt: Date.now()
      });

      alert("Foto subida 🚀");

      // 🔄 reset limpio
      setFile(null);
      setDestacada(false);
      setEventoId("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

    } catch (err) {
      console.error(err);
      alert("Error subiendo imagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white text-gray-900 p-6 rounded-2xl shadow-md space-y-6 max-w-2xl">

      <h2 className="text-xl font-bold">
        Subir foto a galería
      </h2>

      {/* Select carrera */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">
          Carrera
        </label>

        <select
          value={eventoId}
          onChange={(e) => setEventoId(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-dh-green/40 outline-none"
        >
          <option value="">Selecciona carrera</option>
          {carreras.map(c => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
      </div>

      {/* Input file */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">
          Imagen
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-gray-900"
        />
      </div>

      {/* Checkbox */}
      <label className="flex items-center gap-2 text-gray-800">
        <input
          type="checkbox"
          checked={destacada}
          onChange={(e) => setDestacada(e.target.checked)}
        />
        Marcar como destacada
      </label>

      {/* Botón */}
      <button
        onClick={handleUpload}
        disabled={loading}
        className={`w-full py-3 rounded-xl font-bold transition ${
          loading
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-dh-green text-black hover:scale-[1.02]"
        }`}
      >
        {loading ? "Subiendo..." : "Subir imagen"}
      </button>
    </div>
  );
}