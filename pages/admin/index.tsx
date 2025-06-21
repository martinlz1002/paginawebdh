import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminSidebar from '@/components/AdminSidebar';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList from '@/components/AdminCarrerasList';
import AdminInscripcionesView from '@/components/AdminInscripcionesView';

export default function AdminPage() {
  const [view, setView] = useState<'crear' | 'listar' | 'inscripciones'>('crear');
  const [editItem, setEditItem] = useState<any>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Cierra el sidebar si se hace click fuera de él
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
            collapsed={!sidebarOpen}
            onToggle={() => setSidebarOpen(o => !o)}
          />
        </div>

        {/* Ajuste de margen tanto en móvil como en desktop */}
        <main
          className={`flex-1 p-6 transition-all duration-300 ${
            sidebarOpen ? 'md:ml-64' : 'md:ml-0'
          }`}
        >
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