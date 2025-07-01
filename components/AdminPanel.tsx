import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '@/lib/firebase';
import AdminSidebar from './AdminSidebar';
import AdminCarrerasForm from './AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from './AdminCarrerasList';
import AdminInscripcionesView from './AdminInscripcionesView';
import EliminarInscripciones, { CarreraOption } from './EliminarInscripciones';
import { getDocs, collection } from 'firebase/firestore';

export default function AdminPanel() {
  const [view, setView] = useState<
    'crear' | 'listar' | 'inscripciones' | 'eliminarInscripciones'
  >('crear');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editItem, setEditItem] = useState<CarreraItem | undefined>(undefined);

  // Estados para "Eliminar Inscripciones"
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Fuerza la renovación del token para incluir el nuevo claim admin
  useEffect(() => {
    const auth = getAuth(app);
    if (auth.currentUser) {
      auth.currentUser.getIdToken(true).catch(console.error);
    }
  }, []);

  // Cargamos la función en la región donde la desplegaste
  const functions = getFunctions(app, 'us-central1');
  const fnBorrar = httpsCallable<{ carreraId: string }, { eliminado: number }>(
    functions,
    'borrarInscripcionesDeCarrera'
  );

  // Recarga el listado de carreras (para el select de eliminar)
  const loadCarreras = async () => {
    const snapshot = await getDocs(collection(db, 'carreras'));
    setCarreras(
      snapshot.docs.map(doc => ({
        id: doc.id,
        titulo: (doc.data() as any).titulo || 'Sin título',
      }))
    );
  };

  useEffect(() => {
    loadCarreras();
  }, []);

  // Handler de borrar inscripciones
  const handleDeleteInscripciones = async (carreraId: string) => {
    setLoadingDelete(true);
    setFeedback(null);
    try {
      const { data } = await fnBorrar({ carreraId });
      setFeedback(`Se borraron ${data.eliminado} inscripciones.`);
      loadCarreras();
    } catch (err: any) {
      console.error(err);
      setFeedback(
        err.code === 'permission-denied'
          ? 'No tienes permisos para borrar inscripciones.'
          : 'Error interno al borrar inscripciones.'
      );
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Toggle sidebar */}
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="fixed top-4 left-4 z-50 p-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition"
      >
        {menuOpen ? <ChevronLeftIcon className="w-6 h-6" /> : <ChevronRightIcon className="w-6 h-6" />}
      </button>

      <div className="flex flex-1">
        <AdminSidebar
          view={view}
          setView={v => {
            setView(v);
            setFeedback(null);
          }}
          open={menuOpen}
          onToggle={() => setMenuOpen(o => !o)}
        />

        <main className="flex-1 p-6 relative z-0">
          <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

          {view === 'crear' && (
            <AdminCarrerasForm
              initialValues={editItem}
              onSuccess={() => {
                setView('listar');
                setEditItem(undefined);
                loadCarreras();
              }}
            />
          )}

          {view === 'listar' && (
            <AdminCarrerasList
              onEdit={(c: CarreraItem) => {
                setEditItem(c);
                setView('crear');
              }}
            />
          )}

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
    </div>
  );
}