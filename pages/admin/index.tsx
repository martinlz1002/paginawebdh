import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import CrearCarreraForm from "@/components/AdminCarrerasForm";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'crear' | 'inscritos'>('crear');
  const [carreras, setCarreras] = useState<any[]>([]);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = '/login';
      }
    });

    if (activeTab === 'inscritos') {
      (async () => {
        const snap = await getDocs(collection(db, 'inscripciones'));
        setCarreras(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      })();
    }

    return () => unsubscribe();
  }, [activeTab]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-6">
        <h2 className="text-2xl font-bold mb-6">Panel Admin</h2>
        <nav className="space-y-2">
          <button
            className={`w-full text-left px-4 py-2 rounded ${
              activeTab === 'crear' ? 'bg-gray-700' : 'hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('crear')}
          >
            Crear Carrera
          </button>
          <button
            className={`w-full text-left px-4 py-2 rounded ${
              activeTab === 'inscritos' ? 'bg-gray-700' : 'hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('inscritos')}
          >
            Competidores Inscritos
          </button>
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 bg-gray-50">
        {activeTab === 'crear' && (
          <CrearCarreraForm />
        )}

        {activeTab === 'inscritos' && (
          <div>
            <h1 className="text-2xl font-bold mb-4">Competidores Inscritos</h1>
            {carreras.length === 0 ? (
              <p>No hay inscripciones.</p>
            ) : (
              <ul className="space-y-2">
                {carreras.map((insc) => (
                  <li key={insc.id} className="bg-white p-4 rounded shadow">
                    <p className="font-semibold">
                      {insc.nombre} {insc.apellidoPaterno} {insc.apellidoMaterno}
                    </p>
                    <p className="text-sm text-gray-600">
                      Carrera ID: {insc.carreraId} | Categoría: {insc.categoriaId}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
