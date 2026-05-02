import { useState, useEffect } from "react";
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
  const [eventoNombre, setEventoNombre] = useState("");
  const [destacada, setDestacada] = useState(false);
  const [loading, setLoading] = useState(false);

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
    if (!file || !eventoId) return;

    setLoading(true);

    try {
      // 📤 subir a storage
      const storageRef = ref(storage, `galeria/${eventoId}/${file.name}`);
      await uploadBytes(storageRef, file);

      const url = await getDownloadURL(storageRef);

      const carrera = carreras.find(c => c.id === eventoId);

      // 💾 guardar en Firestore
      await addDoc(collection(db, "galeria"), {
        url,
        eventoId,
        eventoNombre: carrera?.titulo || "",
        destacada,
        createdAt: Date.now()
      });

      alert("Foto subida 🚀");

      setFile(null);
      setDestacada(false);
    } catch (err) {
      console.error(err);
      alert("Error subiendo imagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow space-y-6">

      <h2 className="text-xl font-bold text-gray-900">
        Subir foto a galería
      </h2>

      {/* Seleccionar carrera */}
      <select
        value={eventoId}
        onChange={(e) => {
          setEventoId(e.target.value);
          const carrera = carreras.find(c => c.id === e.target.value);
          setEventoNombre(carrera?.titulo || "");
        }}
        className="w-full border rounded-xl px-3 py-2"
      >
        <option value="">Selecciona carrera</option>
        {carreras.map(c => (
          <option key={c.id} value={c.id}>
            {c.titulo}
          </option>
        ))}
      </select>

      {/* Input file */}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      {/* Destacada */}
      <label className="flex items-center gap-2">
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
        className="bg-dh-green text-black px-6 py-2 rounded-xl font-bold"
      >
        {loading ? "Subiendo..." : "Subir imagen"}
      </button>
    </div>
  );
}