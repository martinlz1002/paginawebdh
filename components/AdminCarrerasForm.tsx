// components/AdminCarrerasForm.tsx
import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

export default function AdminCarrerasForm() {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fecha, setFecha] = useState('');
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState('');

  const handleCrearCarrera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagenArchivo) {
      return setMensaje('Selecciona un archivo de imagen');
    }

    try {
      // Leer la imagen como base64
      const reader = new FileReader();
      reader.readAsDataURL(imagenArchivo);
      await new Promise<void>((resolve, reject) => {
        reader.onloadend = () => resolve();
        reader.onerror = () => reject();
      });
      const base64str = reader.result as string;
      const imagenBase64 = base64str.split(',')[1];
      const nombreArchivo = imagenArchivo.name;

      // Llamar la Cloud Function
      const functions = getFunctions(app);
      const crearCarrera = httpsCallable(functions, 'crearCarrera');
      await crearCarrera({
        titulo,
        descripcion,
        ubicacion,
        fecha,
        imagenBase64,
        nombreArchivo
      });

      setMensaje('Carrera creada exitosamente');
      setTitulo('');
      setDescripcion('');
      setUbicacion('');
      setFecha('');
      setImagenArchivo(null);
    } catch (error: any) {
      console.error('Error creando carrera:', error);
      setMensaje('Error creando carrera: ' + (error.message || error));
    }
  };

  return (
    <form onSubmit={handleCrearCarrera} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
          placeholder="Título de la carrera"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
          placeholder="Descripción de la carrera"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Ubicación</label>
        <input
          type="text"
          value={ubicacion}
          onChange={e => setUbicacion(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
          placeholder="Ciudad, sede..."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Imagen</label>
        <input
          type="file"
          accept="image/*"
          className="mt-1 block w-full"
          onChange={e => setImagenArchivo(e.target.files?.[0] || null)}
          required
        />
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
      >
        Crear Carrera
      </button>

      {mensaje && (
        <p className="mt-2 text-sm text-green-600">
          {mensaje}
        </p>
      )}
    </form>
  );
}