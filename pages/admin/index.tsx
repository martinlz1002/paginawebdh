import React, { useState, useEffect } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '@/lib/firebase';
import AdminSidebar from '@/components/AdminSidebar';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from '@/components/AdminCarrerasList';
import AdminInscripcionesView from '@/components/AdminInscripcionesView';
import EliminarInscripciones, { CarreraOption } from '@/components/EliminarInscripciones';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

type View = 'crear' | 'listar' | 'inscripciones' | 'eliminarInscripciones';

export default function AdminPage() {
  const [view, setView] = useState<View>('crear');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(o => !o);

  // --- Edición de carreras ---
  const [editItem, setEditItem] = useState<CarreraItem | null>(null);

  // Estados para "eliminar inscripciones"
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Cloud Functions (misma región donde desplegaste)
  const functions = getFunctions(app, 'us-central1');
  const fnBorrar = httpsCallable<{ carreraId: string }, { eliminado: number }>(
    functions,
    'borrarInscripcionesDeCarrera'
  );

  // Carga carreras para el sidebar de "eliminar inscripciones"
  const loadCarreras = async () => {
    const snap = await getDocs(collection(db, 'carreras'));
    setCarreras(
      snap.docs.map(d => ({ id: d.id, titulo: (d.data() as any).titulo || 'Sin título' }))
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
      setFeedback(err.code === 'permission-denied'
        ? 'No tienes permisos para borrar inscripciones.'
        : 'Error interno al borrar inscripciones.');
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <div className="relative flex pt-16">
      {/* Toggle sidebar */}
      <button
        onClick={toggleSidebar}
        className="fixed top-20 left-4 z-50 p-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition"
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

      {/* Main */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'} flex-1 p-6`}>
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

        {/* CREAR / EDITAR CARRERA */}
        {view === 'crear' && (
          <AdminCarrerasForm
            initialValues={editItem ?? undefined}
            onSuccess={() => {
              setEditItem(null);
              setView('listar');
              loadCarreras();
            }}
          />
        )}

        {/* LISTAR CARRERAS */}
        {view === 'listar' && (
          <AdminCarrerasList
            onEdit={(c: CarreraItem) => {
              setEditItem(c);
              setView('crear');
            }}
          />
        )}

        {/* VER INSCRIPCIONES */}
        {view === 'inscripciones' && <AdminInscripcionesView />}

        {/* ELIMINAR INSCRIPCIONES */}
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