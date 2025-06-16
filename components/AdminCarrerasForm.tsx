import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type { CarreraData, Categoria } from '@/types/carrera';

interface AdminCarrerasFormProps {
  /** Si viene, recarga el formulario para editar */
  initialValues?: CarreraData & { id: string };
  /** Callback tras crear/editar con éxito */
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({ initialValues, onSuccess }: AdminCarrerasFormProps) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(initialValues?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion ?? '');
  const [ubicacion, setUbicacion] = useState(initialValues?.ubicacion ?? '');
  const [fecha, setFecha] = useState(initialValues?.fecha ?? '');
  const [horaSalida, setHoraSalida] = useState(initialValues?.horaSalida ?? '');
  const [categorias, setCategorias] = useState<Categoria[]>(
    initialValues?.categorias ?? [{ nombre: '', minAge: 0, maxAge: 0 }]
  );
  const [mensaje, setMensaje] = useState('');

  const handleCategoriaChange = (
    index: number,
    field: keyof Categoria,
    value: string | number
  ) => {
    setCategorias(categorias.map((cat, i) => {
      if (i !== index) return cat;
      return { ...cat, [field]: field === 'nombre' ? String(value) : Number(value) };
    }));
  };

  const addCategoria = () => {
    setCategorias([...categorias, { nombre: '', minAge: 0, maxAge: 0 }]);
  };

  const removeCategoria = (index: number) => {
    setCategorias(categorias.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const functions = getFunctions(app);
      const crearCarrera = httpsCallable(functions, 'crearCarrera');
      await crearCarrera({ titulo, descripcion, ubicacion, fecha, horaSalida, categorias });
      setMensaje('Carrera guardada exitosamente');
      onSuccess?.();
      router.reload();
    } catch (err: any) {
      console.error(err);
      setMensaje('Error al guardar carrera');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block font-medium">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          required
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          required
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium">Ubicación</label>
          <input
            type="text"
            value={ubicacion}
            onChange={e => setUbicacion(e.target.value)}
            required
            className="mt-1 block w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            required
            className="mt-1 block w-full border p-2 rounded"
          />
        </div>
      </div>

      <div>
        <label className="block font-medium">Hora de Salida</label>
        <input
          type="time"
          value={horaSalida}
          onChange={e => setHoraSalida(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block font-medium">Categorías</label>
        {categorias.map((cat, idx) => (
          <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
            <input
              type="text"
              placeholder="Nombre"
              value={cat.nombre}
              onChange={e => handleCategoriaChange(idx, 'nombre', e.target.value)}
              required
              className="border p-1 rounded col-span-2"
            />
            <input
              type="number"
              placeholder="Edad min"
              value={cat.minAge}
              onChange={e => handleCategoriaChange(idx, 'minAge', e.target.value)}
              required
              className="border p-1 rounded"
            />
            <input
              type="number"
              placeholder="Edad max"
              value={cat.maxAge}
              onChange={e => handleCategoriaChange(idx, 'maxAge', e.target.value)}
              required
              className="border p-1 rounded"
            />
            <button
              type="button"
              onClick={() => removeCategoria(idx)}
              className="text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" onClick={addCategoria} className="text-blue-600">
          + Agregar categoría
        </button>
      </div>

      <button type="submit" className="bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700">
        Guardar Carrera
      </button>
      {mensaje && <p className="mt-2 text-green-600">{mensaje}</p>}
    </form>
  );
}
