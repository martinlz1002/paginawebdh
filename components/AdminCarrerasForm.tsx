import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Carrera {
  id: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string; // YYYY-MM-DD
}

export default function AdminCarrerasForm() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Campos del formulario
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");

  // 1) Carga inicial de carreras
  useEffect(() => {
    fetchCarreras();
  }, []);

  async function fetchCarreras() {
    const snap = await getDocs(collection(db, "carreras"));
    const list = snap.docs.map((d) => {
      const data = d.data() as any;
      // Convertimos Timestamp a string YYYY-MM-DD si existe
      let fechaStr = "";
      if (data.fecha && (data.fecha as Timestamp).toDate) {
        fechaStr = (data.fecha as Timestamp)
          .toDate()
          .toISOString()
          .split("T")[0];
      }
      return {
        id: d.id,
        titulo: data.titulo || "",
        descripcion: data.descripcion || "",
        ubicacion: data.ubicacion || "",
        fecha: fechaStr,
      };
    });
    setCarreras(list);
  }

  // 2) Crear o actualizar
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validación mínima
    if (!titulo || !descripcion || !ubicacion || !fecha) {
      alert("Completa todos los campos.");
      return;
    }

    const payload = {
      titulo,
      descripcion,
      ubicacion,
      fecha: Timestamp.fromDate(new Date(fecha)),
    };

    if (editingId) {
      await updateDoc(doc(db, "carreras", editingId), payload);
      alert("Carrera actualizada.");
    } else {
      await addDoc(collection(db, "carreras"), payload);
      alert("Carrera creada.");
    }

    clearForm();
    fetchCarreras();
  }

  // 3) Preparar edición
  function handleEdit(c: Carrera) {
    setEditingId(c.id);
    setTitulo(c.titulo);
    setDescripcion(c.descripcion);
    setUbicacion(c.ubicacion);
    setFecha(c.fecha);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 4) Eliminar
  async function handleDelete(id: string) {
    if (confirm("¿Eliminar esta carrera?")) {
      await deleteDoc(doc(db, "carreras", id));
      fetchCarreras();
    }
  }

  function clearForm() {
    setEditingId(null);
    setTitulo("");
    setDescripcion("");
    setUbicacion("");
    setFecha("");
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {editingId ? "Editar Carrera" : "Crear Carrera"}
      </h2>

      <form onSubmit={handleSubmit} className="grid gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="mt-1 w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="mt-1 w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Ubicación</label>
          <input
            type="text"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            className="mt-1 w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full border p-2 rounded"
            required
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
        >
          {editingId ? "Actualizar" : "Crear"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={clearForm}
            className="ml-2 bg-gray-400 text-white py-2 px-4 rounded hover:bg-gray-500 transition"
          >
            Cancelar
          </button>
        )}
      </form>

      <h3 className="text-lg font-semibold mb-2">Carreras existentes</h3>
      {carreras.length === 0 && <p>No hay carreras.</p>}
      <ul className="space-y-2">
        {carreras.map((c) => (
          <li
            key={c.id}
            className="border p-4 rounded flex justify-between items-center"
          >
            <div>
              <p className="font-medium">{c.titulo}</p>
              <p className="text-sm text-gray-600">{c.descripcion}</p>
              <p className="text-sm">
                📍 {c.ubicacion} — 📅 {c.fecha}
              </p>
            </div>
            <div className="space-x-2">
              <button
                onClick={() => handleEdit(c)}
                className="text-blue-600 hover:underline"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}