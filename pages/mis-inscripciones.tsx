import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import AuthGuard from '@/components/AuthGuard';
import Link from 'next/link';

interface InscRaw {
  carreraId: string;
  perfilId: string;
  categoria: string;
  timestamp: any;
}

interface InscripcionView {
  id: string;
  carreraId: string;
  categoria: string;
  fechaInscripcion: string;
  // datos de la carrera padre:
  tituloCarrera: string;
  fechaCarrera: string;
  ubicacionCarrera?: string;
  imagenCarrera?: string;
}

export default function MisInscripcionesPage() {
  const [inscripciones, setInscripciones] = useState<InscripcionView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        setInscripciones([]);
        setLoading(false);
        return;
      }

      // 1) Consulta en la colección raíz 'inscripciones'
      const q = query(
        collection(db, 'inscripciones'),
        where('perfilId', '==', user.uid)
      );
      const snap = await getDocs(q);

      // 2) Por cada inscripción, obtenemos datos de la carrera padre
      const lista: InscripcionView[] = await Promise.all(
        snap.docs.map(async (docSnap) => {
          const data = docSnap.data() as InscRaw;

          // referenciar carrera en /carreras/{carreraId}
          const carreraRef = doc(db, 'carreras', data.carreraId);
          const cSnap: DocumentSnapshot = await getDoc(carreraRef);

          let tituloCarrera = '(desconocido)';
          let fechaCarrera = '';
          let ubicacionCarrera: string | undefined;
          let imagenCarrera: string | undefined;

          if (cSnap.exists()) {
            const c = cSnap.data() as any;
            tituloCarrera = c.titulo;
            fechaCarrera = c.fecha?.toDate
              ? c.fecha.toDate().toLocaleDateString()
              : String(c.fecha);
            ubicacionCarrera = c.ubicacion;
            imagenCarrera = c.imagenUrl;
          }

          return {
            id: docSnap.id,
            carreraId: data.carreraId,
            categoria: data.categoria,
            fechaInscripcion: data.timestamp?.toDate
              ? data.timestamp.toDate().toLocaleString()
              : '',
            tituloCarrera,
            fechaCarrera,
            ubicacionCarrera,
            imagenCarrera,
          };
        })
      );

      setInscripciones(lista);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <AuthGuard>
        <p className="text-center mt-10">Cargando tus inscripciones…</p>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Mis Inscripciones</h1>

        {inscripciones.length === 0 ? (
          <p className="text-center text-gray-600">
            No tienes inscripciones registradas.
          </p>
        ) : (
          <ul className="space-y-6">
            {inscripciones.map((insc) => (
              <li
                key={insc.id}
                className="border rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow"
              >
                <Link
                  href={`/inscribirse?carreraId=${insc.carreraId}`}
                  className="flex flex-col md:flex-row"
                >
                  {insc.imagenCarrera ? (
                    <div className="w-full md:w-1/3 h-48 overflow-hidden">
                      <img
                        src={insc.imagenCarrera}
                        alt={insc.tituloCarrera}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full md:w-1/3 h-48 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500">Sin imagen</span>
                    </div>
                  )}

                  <div className="p-4 flex-1">
                    <h2 className="text-xl font-semibold">
                      {insc.tituloCarrera}
                    </h2>
                    <p className="text-sm text-gray-600 mb-2">
                      📅 {insc.fechaCarrera}{' '}
                      {insc.ubicacionCarrera && (
                        <>· 📍 {insc.ubicacionCarrera}</>
                      )}
                    </p>
                    <p>
                      <strong>Categoría:</strong> {insc.categoria}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Inscrito el {insc.fechaInscripcion}
                    </p>
                    <button className="mt-4 inline-block bg-purple-600 text-white py-1 px-3 rounded hover:bg-purple-700 transition-colors">
                      Ver detalles
                    </button>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AuthGuard>
  );
}