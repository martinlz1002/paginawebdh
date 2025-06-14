import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";

export default function AdminCarrerasForm() {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState<string>("");

  const handleCrearCarrera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagenArchivo) {
      setMensaje("Selecciona un archivo de imagen");
      return;
    }
    try {
      // 1) Sube la imagen a Storage
      const storageRef = ref(
        storage,
        `carreras/${Date.now()}_${imagenArchivo.name}`
      );
      const snap = await uploadBytes(storageRef, imagenArchivo);
      const url = await getDownloadURL(snap.ref);

      // 2) Crea el documento en Firestore
      await addDoc(collection(db, "carreras"), {
        titulo,
        descripcion,
        ubicacion,
        fecha: Timestamp.fromDate(new Date(fecha)),
        imagenUrl: url,
        creado: serverTimestamp(),
      });

      setMensaje("Carrera creada exitosamente");
      // Limpia el formulario
      setTitulo("");
      setDescripcion("");
      setUbicacion("");
      setFecha("");
      setImagenArchivo(null);
    } catch (err: any) {
      console.error(err);
      setMensaje("Error creando carrera: " + err.message);
    }
  };

  return (
    <form onSubmit={handleCrearCarrera} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título de la carrera"
          className="mt-1 block w-full border p-2 rounded"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción de la carrera"
          className="mt-1 block w-full border p-2 rounded"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Ubicación</label>
        <input
          type="text"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          placeholder="Ciudad, sede..."
          className="mt-1 block w-full border p-2 rounded"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Imagen</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImagenArchivo(e.target.files?.[0] || null)}
          className="mt-1 block w-full"
          required
        />
      </div>
      <button
        type="submit"
        className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
      >
        Crear Carrera
      </button>
      {mensaje && <p className="mt-2 text-sm">{mensaje}</p>}
    </form>
  );
}