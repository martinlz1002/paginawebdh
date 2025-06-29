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

// Definimos las vistas disponibles
type View = 'crear' | 'listar' | 'inscripciones' | 'eliminarInscripciones';

export default function AdminPage() {
  const [view, setView] = useState<View>('crear');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(o => !o);

  // Estados para las carreras y la acción de borrado
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Inicializamos la función callable (mismísima región de deploy)
  const functions = getFunctions(app, 'us-central1');
  const fnBorrar = httpsCallable<{ carreraId: string }, { eliminado: number }>(
    functions,
    'borrarInscripcionesDeCarrera'
  );

  // Función para cargar carreras desde Firestore
  const loadCarreras = async () => {
    const snapshot = await getDocs(collection(db, 'carreras'));
    const list: CarreraOption[] = snapshot.docs.map(doc => ({
      id: doc.id,
      titulo: (doc.data() as any).titulo || 'Sin título',
    }));
    setCarreras(list);
  };

  // Cargar al montar
  useEffect(() => {
    loadCarreras();
  }, []);

  // Handler para eliminar inscripciones
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
      {/* Botón toggle */}
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
