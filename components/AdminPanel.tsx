import React, { useState, useEffect } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import AdminSidebar from './AdminSidebar';
import AdminCarrerasForm from './AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from './AdminCarrerasList';
import AdminInscripcionesView from './AdminInscripcionesView';
import EliminarInscripciones, { CarreraOption } from './EliminarInscripciones';
import { getDocs, collection } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '@/lib/firebase';

export default function AdminPanel() {
  const [view, setView] = useState<
    'crear' | 'listar' | 'inscripciones' | 'eliminarInscripciones'
  >('crear');
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(o => !o);

  // **1) Estado para la carrera que estamos editando**
  const [editItem, setEditItem] = useState<CarreraItem | undefined>(undefined);

  // States para borrar inscripciones
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Cloud Functions
  const functions = getFunctions(app);
  const fnBorrar = httpsCallable<{ carreraId: string }, { eliminado: number }>(
    functions,
    'borrarInscripcionesDeCarrera'
  );

  // Carga carreras para el sidebar de "Eliminar inscripciones"
  const loadCarreras = async () => {
    const snapshot = await getDocs(collection(db, 'carreras'));
    const list: CarreraOption[] = snapshot.docs.map(doc => ({
      id: doc.id,
      titulo: (doc.data() as any).titulo || 'Sin título',
    }));
    setCarreras(list);
  };
  useEffect(() => {
    loadCarreras();
  }, []);

  // Handler para borrar inscripciones de una carrera
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
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Toggle sidebar */}
      <button
        onClick={toggleMenu}
        className="fixed top-4 left-4 z-50 p-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition"
      >
        {menuOpen ? (
          <ChevronLeftIcon className="w-6 h-6" />
        ) : (
          <ChevronRightIcon className="w-6 h-6" />
        )}
      </button>

      <div className="flex flex-1">
        <AdminSidebar
          view={view}
          setView={v => {
            setView(v);
            setFeedback(null);
          }}
          open={menuOpen}
          onToggle={toggleMenu}
        />

        <main className="flex-1 p-6 relative z-0">
          <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

          {view === 'crear' && (
            <AdminCarrerasForm
              initialValues={editItem}
              onSuccess={() => {
                // una vez creada/actualizada, vuelvo a listar y limpio editItem
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