import React, { useState, FormEvent } from 'react';
import { getAuth } from 'firebase/auth';

export default function AdminCarrerasForm() {
  const [titulo, setTitulo]             = useState('');
  const [descripcion, setDescripcion]   = useState('');
  const [ubicacion, setUbicacion]       = useState('');
  const [fecha, setFecha]               = useState('');
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje]           = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMensaje('');

    if (!titulo || !fecha || !imagenArchivo) {
      setMensaje('Por favor completa título, fecha e imagen.');
      return;
    }

    try {
      setMensaje('Creando carrera…');

      // 1) Convertir la imagen a Base64
      const reader = new FileReader();
      reader.readAsDataURL(imagenArchivo);
      await new Promise<void>(res => { reader.onloadend = () => res(); });
      const base64 = (reader.result as string).split(',')[1];

      // 2) Obtener token de Firebase Auth
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setMensaje('Debes iniciar sesión como administrador.');
        return;
      }
      const idToken = await user.getIdToken();

      // 3) Enviar petición POST al endpoint Express + CORS
      const resp = await fetch(
        'https://us-central1-webdh-730dc.cloudfunctions.net/api/crearCarrera',
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            Authorization:   `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            titulo,
            descripcion,
            ubicacion,
            fecha,
            imagenBase64: base64,
            nombreArchivo: imagenArchivo.name,
          }),
        }
      );

      const body = await resp.json();
      if (!resp.ok) {
        throw new Error(body.error || 'Error al crear la carrera.');
      }

      // 4) Éxito
      setMensaje(body.mensaje);
      setTitulo('');
      setDescripcion('');
      setUbicacion('');
      setFecha('');
      setImagenArchivo(null);

    } catch (err: any) {
      console.error('Error creando carrera:', err);
      setMensaje(err.message || 'Error interno al crear la carrera.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Crear Nueva Carrera</h2>

      <label className="block mb-2">
        <span className="font-medium">Título*</span>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          className="mt-1 block w-full border rounded p-2"
          required
        />
      </label>

      <label className="block mb-2">
        <span className="font-medium">Fecha*</span>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="mt-1 block w-full border rounded p-2"
          required
        />
      </label>

      <label className="block mb-2">
        <span className="font-medium">Ubicación</span>
        <input
          type="text"
          value={ubicacion}
          onChange={e => setUbicacion(e.target.value)}
          className="mt-1 block w-full border rounded p-2"
        />
      </label>

      <label className="block mb-2">
        <span className="font-medium">Descripción</span>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          className="mt-1 block w-full border rounded p-2"
        />
      </label>

      <label className="block mb-4">
        <span className="font-medium">Imagen*</span>
        <input
          type="file"
          accept="image/*"
          onChange={e => setImagenArchivo(e.target.files?.[0] || null)}
          className="mt-1 block w-full"
          required
        />
      </label>

      <button
        type="submit"
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
      >
        Guardar Carrera
      </button>

      {mensaje && <p className="mt-4 text-center text-gray-800">{mensaje}</p>}
    </form>
  );
}