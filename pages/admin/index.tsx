import { useState, useRef, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminSidebar from '@/components/AdminSidebar';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList from '@/components/AdminCarrerasList';
import AdminInscripcionesView from '@/components/AdminInscripcionesView';

export default function AdminPage() {
  const [view, setView] = useState<'crear' | 'listar' | 'inscripciones'>('crear');
  const [editItem, setEditItem] = useState<any>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // cerrar sidebar al click fuera
  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (
        sidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(ev.target as Node)
      ) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  return (
    <ProtectedRoute>
      <div className="relative flex min-h-screen bg-gray-100">
        {/* Sidebar + toggle */}
        <div ref={sidebarRef}>
          <AdminSidebar
            view={view}
            setView={setView}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(o => !o)}
          />
        </div>

        {/* Contenido principal */}
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

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