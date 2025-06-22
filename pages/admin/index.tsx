import { useState, useRef, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminSidebar from '@/components/AdminSidebar';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList from '@/components/AdminCarrerasList';
import AdminInscripcionesView from '@/components/AdminInscripcionesView';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';

export default function AdminPage() {
  const [view, setView] = useState<'crear' | 'listar' | 'inscripciones'>('crear');
  const [editItem, setEditItem] = useState<any>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-100">
        <div ref={sidebarRef}>
          <AdminSidebar
            view={view}
            setView={setView}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(o => !o)}
          />
        </div>

        {/* Contenido */}
        <main className="relative flex-1 p-6">
          {/* Toggle dentro de contenido, justo debajo del header */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="absolute top-6 left-6 z-30 bg-green-600 hover:bg-green-700 text-white p-2 rounded-full focus:outline-none"
            aria-label={sidebarOpen ? 'Ocultar menú' : 'Mostrar menú'}
          >
            {sidebarOpen
              ? <ChevronLeftIcon className="w-5 h-5" />
              : <ChevronRightIcon className="w-5 h-5" />}
          </button>

          {/* Header del Admin */}
          <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

          {/* Vistas */}
          {view === 'crear' && (
            <AdminCarrerasForm
              initialValues={editItem}
              onSuccess={() => {
                setEditItem(undefined);
                setView('listar');
                setSidebarOpen(true);
              }}
            />
          )}
          {view === 'listar' && (
            <AdminCarrerasList
              onEdit={carrera => {
                setEditItem(carrera);
                setView('crear');
                setSidebarOpen(true);
              }}
            />
          )}
          {view === 'inscripciones' && <AdminInscripcionesView />}
        </main>
      </div>
    </ProtectedRoute>
  );
}