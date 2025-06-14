// components/CrearCarreraForm.tsx
import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase'; // tu inicialización de Firebase

export default function CrearCarreraForm() {
  // Estados del formulario
  const [titulo, setTitulo]         = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion]   = useState('');
  const [fecha, setFecha]           = useState('');
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje]       = useState<string>('');

  // Obtén la instancia de Functions y la referencia a tu función
  const functions = getFunctions(app);
  const crearCarreraFn = httpsCallable<{
    titulo: string;
    descripcion: string;
    ubicacion: string;
    fecha: string;
    imagenBase64: string;
    nombreArchivo: string;
  }, { mensaje: string }>(functions, 'crearCarrera');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo || !fecha || !imagenArchivo) {
      setMensaje('Completa todos los campos obligatorios.');
      return;
    }

    try {
      setMensaje('Creando carrera…');

      // Convierte la imagen a Base64
      const reader = new FileReader();
      reader.readAsDataURL(imagenArchivo);
      await new Promise<void>(res => {
        reader.onloadend = () => res();
      });
      const base64 = (reader.result as string).split(',')[1];

      // Invoca la función callable
      const result = await crearCarreraFn({
        titulo,
        descripcion,
        ubicacion,
        fecha,
        imagenBase64: base64,
        nombreArchivo: imagenArchivo.name,
      });

      // Éxito
      setMensaje(result.data.mensaje);
      // Limpia el form si quieres
      setTitulo('');
      setDescripcion('');
      setUbicacion('');
      setFecha('');
      setImagenArchivo(null);
    } catch (error: any) {
      console.error('Error creando carrera:', error);
      setMensaje('Error interno al crear la carrera.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold">Crear Nueva Carrera</h2>

      <input
        type="text"
        value={titulo}
        onChange={e => setTitulo(e.target.value)}
        placeholder="Título"
        className="w-full border p-2 rounded"
        required
      />

      <input
        type="date"
        value={fecha}
        onChange={e => setFecha(e.target.value)}
        className="w-full border p-2 rounded"
        required
      />

      <input
        type="text"
        value={ubicacion}
        onChange={e => setUbicacion(e.target.value)}
        placeholder="Ubicación"
        className="w-full border p-2 rounded"
      />

      <textarea
        value={descripcion}
        onChange={e => setDescripcion(e.target.value)}
        placeholder="Descripción (opcional)"
        className="w-full border p-2 rounded"
      />

      <input
        type="file"
        accept="image/*"
        onChange={e => setImagenArchivo(e.target.files?.[0] || null)}
        className="w-full"
        required
      />

      <button
        type="submit"
        className="bg-green-600 text-white py-2 px-6 rounded hover:bg-green-700"
      >
        Guardar Carrera
      </button>

      {mensaje && <p className="mt-2 text-gray-800">{mensaje}</p>}
    </form>
  );
}