// components/AdminCarrerasForm.tsx
import { useState, useEffect, FormEvent } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, updateDoc, Timestamp } from "firebase/firestore";

export interface CarreraData {
  titulo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;        // ISO string: "2025-07-20"
  horaSalida?: string;  // e.g. "09:00"
  // Si quieres manejar categorías dinámicas, añádelas aquí:
  // categorias?: { nombre: string; minAge: number; maxAge: number }[];
}

export interface CarreraDoc extends CarreraData {
  id: string;
}

interface AdminCarrerasFormProps {
  /** Si se pasa, cargamos estos valores para editar */
  initialValues?: CarreraDoc;
  /** Se llama después de crear o editar exitosamente */
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({
  initialValues,
  onSuccess,
}: AdminCarrerasFormProps) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaSalida, setHoraSalida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const isEdit = Boolean(initialValues);

  // Al montar o cambiar initialValues, precargamos el formulario
  useEffect(() => {
    if (initialValues) {
      setTitulo(initialValues.titulo);
      setDescripcion(initialValues.descripcion);
      setUbicacion(initialValues.ubicacion);
      setFecha(initialValues.fecha);
      setHoraSalida(initialValues.horaSalida || "");
    }
  }, [initialValues]);

  const resetForm = () => {
    setTitulo("");
    setDescripcion("");
    setUbicacion("");
    setFecha("");
    setHoraSalida("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);

    try {
      const payload: CarreraData = {
        titulo,
        descripcion,
        ubicacion,
        fecha,
        horaSalida: horaSalida || undefined,
      };

      if (isEdit && initialValues) {
        // Editar carrera existente
        const ref = doc(db, "carreras", initialValues.id);
        await updateDoc(ref, {
          ...payload,
          actualizado: Timestamp.now(),
        });
      } else {
        // Crear nueva carrera
        await addDoc(collection(db, "carreras"), {
          ...payload,
          creado: Timestamp.now(),
        });
      }

      // Callback externo (p.ej. para recargar lista)
      onSuccess?.();
      // Si no es edición, limpiar para nueva creación
      if (!isEdit) resetForm();
    } catch (err: any) {
      console.error("Error guardando carrera:", err);
      alert("Ocurrió un error al guardar la carrera.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded shadow">
      <h3 className="text-xl font-semibold">
        {isEdit ? "Editar Carrera" : "Crear Nueva Carrera"}
      </h3>

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

      <div className="grid grid-cols-2 gap-4">
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
        <div>
          <label className="block text-sm font-medium">Hora de Salida</label>
          <input
            type="time"
            value={horaSalida}
            onChange={(e) => setHoraSalida(e.target.value)}
            className="mt-1 w-full border p-2 rounded"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={guardando}
        className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {guardando
          ? isEdit
            ? "Actualizando..."
            : "Creando..."
          : isEdit
          ? "Actualizar"
          : "Crear"}
      </button>
    </form>
  );
}
