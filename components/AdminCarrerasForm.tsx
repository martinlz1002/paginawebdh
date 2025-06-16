import React, { useState } from 'react';
import { db, storage } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import { CarreraData, Categoria } from '@/types/carrera';

export interface AdminCarrerasFormProps {
  initialValues?: CarreraData & { id: string };
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({
  initialValues,
  onSuccess
}: AdminCarrerasFormProps) {
  const [titulo, setTitulo] = useState(initialValues?.titulo || '');
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion || '');
  const [lugar, setLugar] = useState(initialValues?.lugar || '');
  const [fecha, setFecha] = useState(initialValues?.fecha || '');
  const [horaSalida, setHoraSalida] = useState(initialValues?.horaSalida || '');
  const [imagenFile, setImagenFile] = useState<File | null>(null);

  // Aquí inicializas directamente con Categoria[], no con función que devuelva string[]
  const [categorias, setCategorias] = useState<Categoria[]>(
    initialValues?.categorias ?? []
  );

  const [nuevaCat, setNuevaCat] = useState<Categoria>({
    nombre: '',
    minAge: 0,
    maxAge: 0
  });

  const handleAddCategoria = () => {
    if (
      nuevaCat.nombre.trim() &&
      nuevaCat.minAge >= 0 &&
      nuevaCat.maxAge >= nuevaCat.minAge
    ) {
      setCategorias(prev => [...prev, nuevaCat]);
      setNuevaCat({ nombre: '', minAge: 0, maxAge: 0 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) Subida de imagen si hay
    let imagenUrl = initialValues?.imagenUrl;
    if (imagenFile) {
      const storageRef = ref(
        storage,
        `carreras/${Date.now()}_${imagenFile.name}`
      );
      const snap = await uploadBytes(storageRef, imagenFile);
      imagenUrl = await getDownloadURL(snap.ref);
    }

    // 2) Payload
    const payload: CarreraData = {
      titulo,
      descripcion,
      lugar,
      fecha,
      horaSalida,
      imagenUrl,
      categorias
    };

    // 3) Crear o editar
    if (initialValues?.id) {
      await updateDoc(
        doc(db, 'carreras', initialValues.id),
        // workaround typing de Firestore
        payload as any
      );
    } else {
      await addDoc(collection(db, 'carreras'), payload as any);
    }

    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold">
        {initialValues ? 'Editar Carrera' : 'Crear Nueva Carrera'}
      </h2>

      <div>
        <label className="block font-medium">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block font-medium">Lugar</label>
        <input
          type="text"
          value={lugar}
          onChange={e => setLugar(e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            required
            className="mt-1 w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Hora de salida</label>
          <input
            type="time"
            value={horaSalida}
            onChange={e => setHoraSalida(e.target.value)}
            required
            className="mt-1 w-full border p-2 rounded"
          />
        </div>
      </div>

      <div>
        <label className="block font-medium">Foto (opcional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={e => setImagenFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full"
        />
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">Categorías</h3>
        <ul className="mb-2">
          {categorias.map((c, i) => (
            <li key={i} className="text-sm">
              • {c.nombre} ({c.minAge}–{c.maxAge} años)
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-2 items-end">
          <input
            type="text"
            placeholder="Nombre categoría"
            value={nuevaCat.nombre}
            onChange={e =>
              setNuevaCat(s => ({ ...s, nombre: e.target.value }))
            }
            className="border p-2 rounded"
          />
          <input
            type="number"
            placeholder="Mín edad"
            value={nuevaCat.minAge}
            onChange={e =>
              setNuevaCat(s => ({ ...s, minAge: Number(e.target.value) }))
            }
            className="border p-2 rounded"
          />
          <input
            type="number"
            placeholder="Máx edad"
            value={nuevaCat.maxAge}
            onChange={e =>
              setNuevaCat(s => ({ ...s, maxAge: Number(e.target.value) }))
            }
            className="border p-2 rounded"
          />
          <button
            type="button"
            onClick={handleAddCategoria}
            className="col-span-3 mt-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            + Agregar categoría
          </button>
        </div>
      </div>

      <div>
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}