import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import AdminSidebar from '@/components/AdminSidebar';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from '@/components/AdminCarrerasList';
import AdminInscripcionesView from '@/components/AdminInscripcionesView';
import InscripcionesManualesPage from '@/pages/admin/inscripciones-manuales';
import EliminarInscripciones, { CarreraOption } from '@/components/EliminarInscripciones';
import AdminGaleria from '@/components/AdminGaleria';
import { getDocs, collection } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { app, db } from '@/lib/firebase';

// Incluir la nueva vista en el tipo
type View =
  | 'crear'
  | 'listar'
  | 'inscripciones'
  | 'inscripcionesManuales'
  | 'eliminarInscripciones'
  | 'galeria';
  
export default function AdminPanel() {
  const [view, setView] = useState<View>('crear');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(o => !o);

  const [editItem, setEditItem] = useState<CarreraItem | null>(null);
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const functions = getFunctions(app, 'us-central1');
  const fnBorrar = httpsCallable<{ carreraId: string }, { eliminado: number }>(
    functions,
    'borrarInscripcionesDeCarrera'
  );

  const loadCarreras = async () => {
    const snap = await getDocs(collection(db, 'carreras'));
    setCarreras(
      snap.docs.map(d => ({ id: d.id, titulo: (d.data() as any).titulo || 'Sin título' }))
    );
  };

  useEffect(() => { loadCarreras(); }, []);

  const handleDeleteInscripciones = async (carreraId: string) => {
    setLoadingDelete(true);
    setFeedback(null);
    try {
      const auth = getAuth(app);
      if (auth.currentUser) await auth.currentUser.getIdToken(true);
      const { data } = await fnBorrar({ carreraId });
      setFeedback(`Se borraron ${data.eliminado} inscripciones.`);
      await loadCarreras();
    } catch (err: any) {
      console.error(err);
      setFeedback(err.code === 'permission-denied'
        ? 'No tienes permisos de administrador.'
        : 'Error interno al borrar inscripciones.'
      );
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <div className="relative flex pt-16">
      <button
        onClick={toggleSidebar}
        className="fixed top-20 left-4 z-50 p-2 bg-purple-600 text-dh-ink rounded-full shadow-lg hover:bg-purple-700 transition"
      >
        {sidebarOpen ? <ChevronLeftIcon className="w-6 h-6" /> : <ChevronRightIcon className="w-6 h-6" />}
      </button>

      <AdminSidebar
  view={view}
  setView={(v: View) => {
    setView(v);
    setFeedback(null);

    // ✅ FIX: si vuelvo a "crear", limpio el edit
    if (v === 'crear') {
      setEditItem(null);
    }
  }}
  open={sidebarOpen}
  onToggle={toggleSidebar}
/>

      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'} flex-1 p-6`}>
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

        {view === 'crear' && (
  <AdminCarrerasForm
    key={editItem?.id || 'crear'}
    initialValues={editItem ?? undefined}
    onSuccess={() => {
      setEditItem(null);
      setView('listar');
      loadCarreras();
    }}
  />
)}

        {view === 'listar' && (
          <AdminCarrerasList
            onEdit={(c: CarreraItem) => { setEditItem(c); setView('crear'); }}
          />
        )}

        {view === 'inscripciones' && <AdminInscripcionesView />}

        {view === 'inscripcionesManuales' && <InscripcionesManualesPage />}

        {view === 'eliminarInscripciones' && (
          <EliminarInscripciones
            carreras={carreras}
            onDelete={handleDeleteInscripciones}
            loading={loadingDelete}
            feedback={feedback}
          />
        )}

        {view === 'galeria' && <AdminGaleria />}

      </main>
    </div>
  );
}
