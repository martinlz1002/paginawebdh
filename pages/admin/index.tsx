import React, { useState, useEffect } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '@/lib/firebase';
import AdminSidebar from '@/components/AdminSidebar';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import EliminarInscripciones, { CarreraOption } from '@/components/EliminarInscripciones';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface Carrera { id: string; titulo: string; }

type View = 'crear' | 'listar' | 'inscripciones' | 'eliminarInscripciones';

export default function AdminPage() {
  const [view, setView] = useState<View>('crear');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(o => !o);

  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Initialize callable
  const functions = getFunctions(app);
  const fnBorrar = httpsCallable<{ carreraId: string }, { eliminado: number }>(
    functions,
    'borrarInscripcionesDeCarrera'
  );

  // Load carreras
  const loadCarreras = async () => {
    const snapshot = await getDocs(collection(db, 'carreras'));
    const list: Carrera[] = snapshot.docs.map(doc => ({
      id: doc.id,
      titulo: (doc.data() as any).titulo || 'Sin título',
    }));
    setCarreras(list);
  };

  useEffect(() => {
    loadCarreras();
  }, []);

  // Delete handler
  const handleDeleteInscripciones = async (carreraId: string) => {
    setLoadingDelete(true);
    setFeedback(null);
    try {
      const { data } = await fnBorrar({ carreraId });
      setFeedback(`Se borraron ${data.eliminado} inscripciones.`);
      loadCarreras();
    } catch (err: any) {
      console.error(err);
      setFeedback(err.message || 'Error borrando inscripciones');
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <div className="relative flex">
      {/* Toggle sidebar button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition"
      >
        {sidebarOpen
          ? <ChevronLeftIcon className="w-6 h-6" />
          : <ChevronRightIcon className="w-6 h-6" />
        }
      </button>

      {/* Sidebar */}
      <AdminSidebar
        view={view}
        setView={v => { setView(v); setFeedback(null); }}
        open={sidebarOpen}
        onToggle={toggleSidebar}
      />

      {/* Main content */}
      <main className={`${sidebarOpen ? 'ml-64' : 'ml-0'} flex-1 p-6 transition-all duration-300`}
      >
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

        {view === 'crear' && (
          <AdminCarrerasForm onSuccess={() => { setView('listar'); loadCarreras(); }} />
        )}
        {view === 'listar' && <div>Listado de carreras...</div>}
        {view === 'inscripciones' && <div>Gestión de inscripciones...</div>}
        {view === 'eliminarInscripciones' && (
          <EliminarInscripciones
            carreras={carreras as CarreraOption[]}
            onDelete={handleDeleteInscripciones}
            loading={loadingDelete}
            feedback={feedback}
          />
        )}
      </main>
    </div>
  );
}