import { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";

interface Carrera {
  id: string;
  titulo: string;
}

interface Foto {
  id: string;
  url: string;
  eventoId: string;
  eventoNombre: string;
  destacada: boolean;
}

export default function AdminGaleria() {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<string[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [eventoId, setEventoId] = useState("");
  const [galeria, setGaleria] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 📥 cargar carreras
  useEffect(() => {
    const loadCarreras = async () => {
      const snap = await getDocs(collection(db, "carreras"));
      setCarreras(
        snap.docs.map(d => ({
          id: d.id,
          titulo: (d.data() as any).titulo
        }))
      );
    };

    loadCarreras();
  }, []);

  // 📥 cargar galería
  const loadGaleria = async () => {
    const snap = await getDocs(collection(db, "galeria"));
    const data = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Foto[];

    setGaleria(data);
  };

  useEffect(() => {
    loadGaleria();
  }, []);

  // 📤 subir múltiples fotos
  const handleUpload = async () => {
    if (files.length === 0 || !eventoId) {
      alert("Selecciona carrera y fotos");
      return;
    }

    setLoading(true);

    try {
      const carrera = carreras.find(c => c.id === eventoId);

      for (const file of files) {
        const storageRef = ref(
          storage,
          `galeria/${eventoId}/${Date.now()}_${file.name}`
        );

        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        await addDoc(collection(db, "galeria"), {
          url,
          eventoId,
          eventoNombre: carrera?.titulo || "",
          destacada: false,
          createdAt: Date.now()
        });
      }

      alert("Fotos subidas 🚀");

      setFiles([]);
      setPreview([]);
      setEventoId("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      loadGaleria();

    } catch (err) {
      console.error(err);
      alert("Error subiendo imágenes");
    } finally {
      setLoading(false);
    }
  };

  // ⭐ toggle destacada
  const toggleDestacada = async (id: string, value: boolean) => {
    await updateDoc(doc(db, "galeria", id), {
      destacada: !value
    });

    loadGaleria();
  };

  // 🗑 eliminar foto
  const eliminarFoto = async (foto: Foto) => {
    if (!confirm("¿Eliminar esta foto?")) return;

    try {
      const fileRef = ref(storage, foto.url);
      await deleteObject(fileRef);

      await deleteDoc(doc(db, "galeria", foto.id));

      loadGaleria();
    } catch (err) {
      console.error(err);
      alert("Error eliminando foto");
    }
  };

  // 🔍 filtro
  const filtradas = filtro
    ? galeria.filter(f => f.eventoId === filtro)
    : galeria;

  return (
    <div className="bg-white text-gray-900 p-6 rounded-2xl shadow-md space-y-6">

      <h2 className="text-xl font-bold">Galería de fotos</h2>

      {/* SELECT */}
      <select
        value={eventoId}
        onChange={(e) => setEventoId(e.target.value)}
        className="w-full border rounded-xl px-3 py-2"
      >
        <option value="">Selecciona carrera</option>
        {carreras.map(c => (
          <option key={c.id} value={c.id}>
            {c.titulo}
          </option>
        ))}
      </select>

      {/* INPUT MULTIPLE */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;

          const arr = Array.from(files);
          setFiles(arr);

          const previews = arr.map(file => URL.createObjectURL(file));
          setPreview(previews);
        }}
      />

      {/* PREVIEW */}
      {preview.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {preview.map((src, i) => (
            <img key={i} src={src} className="rounded-xl h-24 object-cover" />
          ))}
        </div>
      )}

      {/* BOTÓN */}
      <button
        onClick={handleUpload}
        disabled={loading}
        className={`w-full py-3 rounded-xl font-bold ${
          loading
            ? "bg-gray-300"
            : "bg-dh-green text-black hover:scale-[1.02]"
        }`}
      >
        {loading ? "Subiendo..." : "Subir fotos"}
      </button>

      {/* FILTRO */}
      <select
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full border rounded-xl px-3 py-2"
      >
        <option value="">Todas las carreras</option>
        {carreras.map(c => (
          <option key={c.id} value={c.id}>
            {c.titulo}
          </option>
        ))}
      </select>

      {/* GALERÍA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filtradas.map((foto) => (
          <div key={foto.id} className="relative group">

            <img
              src={foto.url}
              className="w-full h-40 object-cover rounded-xl"
            />

            {/* BADGE */}
            {foto.destacada && (
              <span className="absolute top-2 left-2 bg-yellow-400 text-black text-xs px-2 py-1 rounded">
                ⭐
              </span>
            )}

            {/* ACTIONS */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">

              <button
                onClick={() => toggleDestacada(foto.id, foto.destacada)}
                className="bg-white px-2 py-1 rounded text-xs"
              >
                ⭐
              </button>

              <button
                onClick={() => eliminarFoto(foto)}
                className="bg-red-500 text-white px-2 py-1 rounded text-xs"
              >
                🗑
              </button>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}