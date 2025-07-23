import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AuthGuard from '@/components/AuthGuard';
import { app, db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  updateDoc,
  DocumentReference
} from 'firebase/firestore';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

type CarreraOption = { id: string; titulo: string };

export default function InscripcionesManualesAdmin() {
  const router = useRouter();
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [carreraId, setCarreraId] = useState<string>('');
  const [startNumber, setStartNumber] = useState<number>(0);
  const [endNumber, setEndNumber] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar carreras
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'carreras'));
      setCarreras(
        snap.docs.map(d => ({
          id: d.id,
          titulo: (d.data() as any).titulo || ''
        }))
      );
    })();
  }, []);

  const handleCreate = async () => {
    setError(null);
    if (
      !carreraId ||
      startNumber <= 0 ||
      endNumber < startNumber ||
      !expiresAt ||
      !username.trim() ||
      !password
    ) {
      setError('Por favor completa todos los campos correctamente.');
      return;
    }
    setLoading(true);
    try {
      // 1️⃣ Crear el documento temporal
      const docRef = await addDoc(
        collection(db, 'tempusuarios'),
        {
          carreraId,
          range: { start: startNumber, end: endNumber },
          expiresAt: new Date(expiresAt),
          username: username.trim(),
          password, // en prod deberías hashear
          createdAt: serverTimestamp()
        }
      ) as DocumentReference;  // anotar tipo para TS

      // 2️⃣ Generar el link y actualizar el mismo doc
      const url = `${window.location.origin}/inscripcion-manual/${docRef.id}`;
      await updateDoc(docRef, { link: url });

      setLink(url);
    } catch (e: any) {
      console.error(e);
      setError('Error al crear el acceso temporal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-800"
        >
          <ChevronLeftIcon className="w-5 h-5 mr-1" /> Volver
        </button>
        <h2 className="text-xl font-semibold">Crear Inscripciones Manuales</h2>

        <div className="space-y-4">
          {/* Carrera */}
          <div>
            <label className="block font-medium">Carrera</label>
            <select
              className="w-full border p-2 rounded"
              value={carreraId}
              onChange={e => setCarreraId(e.target.value)}
            >
              <option value="">-- Selecciona carrera --</option>
              {carreras.map(c => (
                <option key={c.id} value={c.id}>{c.titulo}</option>
              ))}
            </select>
          </div>

          {/* Rango de números */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium">Número inicio</label>
              <input
                type="number"
                min={1}
                className="w-full border p-2 rounded"
                value={startNumber}
                onChange={e => setStartNumber(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block font-medium">Número fin</label>
              <input
                type="number"
                min={startNumber}
                className="w-full border p-2 rounded"
                value={endNumber}
                onChange={e => setEndNumber(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Expiración */}
          <div>
            <label className="block font-medium">Expiración</label>
            <input
              type="datetime-local"
              className="w-full border p-2 rounded"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
            />
          </div>

          {/* Credenciales */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium">Usuario</label>
              <input
                type="text"
                className="w-full border p-2 rounded"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium">Contraseña</label>
              <input
                type="password"
                className="w-full border p-2 rounded"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-red-600">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear Acceso'}
          </button>

          {link && (
            <div className="bg-green-50 border border-green-200 p-4 rounded">
              <p className="font-medium">Link generado:</p>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline break-all"
              >
                {link}
              </a>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}