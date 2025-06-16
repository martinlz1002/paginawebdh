import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';

export default function MisInscripciones() {
  const [inscripciones, setInscripciones] = useState<any[]>([]);
  const auth = getAuth();

  useEffect(() => {
    const fetch = async () => {
      if (!auth.currentUser) return;
      const q = query(
        collection(db, 'inscripciones'),
        where('uid', '==', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      setInscripciones(snap.docs.map(d => d.data()));
    };
    fetch();
  }, [auth.currentUser]);

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Mis Inscripciones</h1>
        <ul className="space-y-2">
          {inscripciones.map(i => (
            <li key={i.id} className="border p-3 rounded">
              <p><strong>Carrera:</strong> {i.carreraId}</p>
              <p><strong>Registrado:</strong> {new Date(i.createdAt.seconds * 1000).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </div>
    </ProtectedRoute>
  );
}