import React, { useState, useEffect } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '@/lib/firebase';
import AdminSidebar from '@/components/AdminSidebar';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList from '@/components/AdminCarrerasList';
import AdminInscripcionesView from '@/components/AdminInscripcionesView';
import EliminarInscripciones, { CarreraOption } from '@/components/EliminarInscripciones';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

type View = 'crear' | 'listar' | 'inscripciones' | 'eliminarInscripciones';

export default function AdminPage() {
  const [view, setView] = useState<View>('crear');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(o => !o);

  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Usa la misma región donde desplegaste tu función
  const functions = getFunctions(app, 'us-central1');
  const fnBorrar = httpsCallable<{ carreraId: string }, { eliminado: number }>(
    functions,
    'borrarInscripcionesDeCarrera'
  );

  const loadCarreras = async () => {
    const snap = await getDocs(collection(db, 'carreras'));
    setCarreras(
      snap.docs.map(d => ({
        id: d.id,
        titulo: (d.data() as any).titulo || 'Sin título',
      }))
    );
  };

  useEffect(() => {
    loadCarreras();
  }, []);

  const handleDeleteInscripciones = async (carreraId: string) => {
    setLoadingDelete(true);
    setFeedback(null);
    try {
      const { data } = await fnBorrar({ carreraId });
      setFeedback(`Se borraron ${data.eliminado} inscripciones.`);
      loadCarreras();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setFeedback('No tienes permisos para borrar inscripciones.');
      } else {
        setFeedback('Error interno al borrar inscripciones.');
      }
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <div className="relative flex pt-16">
      {/* mueve el toggle más abajo para que no quede bajo el header */}
      <button
        onClick={toggleSidebar}
        className="fixed top-20 left-4 z-50 p-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition"
      >
        {sidebarOpen
          ? <ChevronLeftIcon className="w-6 h-6" />
          : <ChevronRightIcon className="w-6 h-6" />
        }
      </button>

      {/* Sidebar desplazable */}
      <AdminSidebar
        view={view}
        setView={v => { setView(v); setFeedback(null); }}
        open={sidebarOpen}
        onToggle={toggleSidebar}
      />

      {/* Contenido principal */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'} flex-1 p-6`}>
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

        {view === 'crear' && (
          <AdminCarrerasForm onSuccess={() => { setView('listar'); loadCarreras(); }} />
        )}
        {view === 'listar' && <AdminCarrerasList onEdit={() => setView('crear')} />}
        {view === 'inscripciones' && <AdminInscripcionesView />}
        {view === 'eliminarInscripciones' && (
          <EliminarInscripciones
            carreras={carreras}
            onDelete={handleDeleteInscripciones}
            loading={loadingDelete}
            feedback={feedback}
          />
        )}
      </main>
    </div>
  );
}