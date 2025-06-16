// components/AdminCarrerasList.tsx
import { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminCarrerasForm, { CarreraData } from "./AdminCarrerasForm";

interface CarreraDoc extends CarreraData {
  id: string;
}

export default function AdminCarrerasList() {
  const [carreras, setCarreras] = useState<CarreraDoc[]>([]);
  const [editCarrera, setEditCarrera] = useState<CarreraDoc | null>(null);

  const loadCarreras = async () => {
    const snap = await getDocs(collection(db, "carreras"));
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as CarreraData),
    }));
    setCarreras(list);
  };

  useEffect(() => {
    loadCarreras();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta carrera?")) return;
    await deleteDoc(doc(db, "carreras", id));
    loadCarreras();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Carreras Activas</h2>
      {editCarrera ? (
        <>
          <button
            className="mb-4 text-blue-600 hover:underline"
            onClick={() => setEditCarrera(null)}
          >
            ← Cancelar edición
          </button>
          {/* Reutilizamos el formulario con datos precargados */}
          <AdminCarrerasForm
            initialValues={editCarrera}
            onSuccess={() => {
              setEditCarrera(null);
              loadCarreras();
            }}
          />
        </>
      ) : (
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="border p-2">Título</th>
              <th className="border p-2">Fecha</th>
              <th className="border p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {carreras.map((c) => (
              <tr key={c.id}>
                <td className="border p-2">{c.titulo}</td>
                <td className="border p-2">{new Date(c.fecha).toLocaleDateString()}</td>
                <td className="border p-2 space-x-2">
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => setEditCarrera(c)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => handleDelete(c.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}