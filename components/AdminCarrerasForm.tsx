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
      setMensaje('Completa título, fecha e imagen.');
      return;
    }

    setMensaje('Creando carrera…');
    try {
      // Base64
      const reader = new FileReader();
      reader.readAsDataURL(imagenArchivo);
      await new Promise<void>(res => reader.onloadend = () => res());
      const base64 = (reader.result as string).split(',')[1];

      // Token
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const idToken = await user.getIdToken();

      // Fetch POST
      const resp = await fetch(
        'https://us-central1-webdh-730dc.cloudfunctions.net/crearCarrera',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${idToken}`,
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
      if (!resp.ok) throw new Error(body.error || 'Error desconocido');

      setMensaje(body.mensaje);
      // Limpiar
      setTitulo('');
      setDescripcion('');
      setUbicacion('');
      setFecha('');
      setImagenArchivo(null);
    } catch (err: any) {
      console.error(err);
      setMensaje(err.message || 'Error interno');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white rounded shadow">
      {/* inputs idénticos a la versión anterior */}
      <button type="submit" className="w-full bg-green-600 text-white py-2 rounded">
        Guardar Carrera
      </button>
      {mensaje && <p className="mt-4 text-center">{mensaje}</p>}
    </form>
  );
}