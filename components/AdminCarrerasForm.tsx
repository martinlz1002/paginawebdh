import { useState, useEffect, FormEvent } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type { CarreraData } from '@/types/carrera';

export interface AdminCarrerasFormProps {
  /** Valores iniciales (para edición) */
  initialValues?: CarreraData & { id?: string };
  /** Callback llamado tras crear/editar exitosamente */
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({
  initialValues,
  onSuccess = () => {},
}: AdminCarrerasFormProps) {
  // Estado del formulario
  const [titulo, setTitulo] = useState(initialValues?.titulo || '');
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion || '');
  const [ubicacion, setUbicacion] = useState(initialValues?.ubicacion || '');
  const [fecha, setFecha] = useState(initialValues?.fecha || '');
  const [imagenUrl, setImagenUrl] = useState(initialValues?.imagenBase64 || '');
  const [mensaje, setMensaje] = useState('');

  // Si cambian los valores iniciales, recarga el formulario
  useEffect(() => {
    if (initialValues) {
      setTitulo(initialValues.titulo);
      setDescripcion(initialValues.descripcion);
      setUbicacion(initialValues.ubicacion);
      setFecha(initialValues.fecha);
      setImagenUrl(initialValues.imagenBase64 || '');
    }
  }, [initialValues]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMensaje('');

    try {
      const functions = getFunctions(app);
      // Decide si es creación o edición
      const fnName = initialValues?.id ? 'editarCarrera' : 'crearCarrera';
      const crearEditar = httpsCallable(functions, fnName);

      await crearEditar({
        id: initialValues?.id,
        titulo,
        descripcion,
        ubicacion,
        fecha,
        imagenUrl,
      });

      setMensaje('Operación realizada con éxito');
      onSuccess();
    } catch (error: any) {
      console.error('Error en crear/editar carrera:', error);
      setMensaje('Error: ' + (error.message || error));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <div>
        <label className="block text-sm font-medium">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Ubicación</label>
        <input
          type="text"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          required
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">URL de Imagen (opcional)</label>
        <input
          type="url"
          value={imagenUrl}
          onChange={(e) => setImagenUrl(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
      >
        {initialValues?.id ? 'Actualizar Carrera' : 'Crear Carrera'}
      </button>

      {mensaje && <p className="mt-2 text-sm text-green-600">{mensaje}</p>}
    </form>
  );
}
