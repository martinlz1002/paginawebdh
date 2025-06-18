import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase';

export default function InscripcionForm({ carreraId }: { carreraId: string }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [mensaje, setMensaje] = useState('');
  const auth = getAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'inscripciones'), {
        carreraId,
        uid: auth.currentUser!.uid,
        nombre,
        email,
        celular,
        createdAt: serverTimestamp(),
      });
      setMensaje('Inscripción correcta.');
    } catch (err: any) {
      setMensaje('Error al inscribir: ' + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Nombre completo"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        required
        className="border p-2 rounded w-full"
      />
      <input
        type="email"
        placeholder="Correo electrónico"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="border p-2 rounded w-full"
      />
      <input
        type="tel"
        placeholder="Celular"
        value={celular}
        onChange={e => setCelular(e.target.value)}
        required
        className="border p-2 rounded w-full"
      />
      <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded">
        Confirmar Inscripción
      </button>
      {mensaje && <p className="mt-2 text-sm text-green-600">{mensaje}</p>}
    </form>
  );
}