import { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminSidebar from '@/components/AdminSidebar';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList from '@/components/AdminCarrerasList';
import AdminInscripcionesView from '@/components/AdminInscripcionesView';

export default function AdminPage() {
  const [view, setView] = useState<'crear' | 'listar' | 'inscripciones'>('crear');
  const [editItem, setEditItem] = useState<any>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      {/* Botón toggle para móvil */}
      <button
        className="fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md md:hidden"
        onClick={() => setSidebarOpen(o => !o)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d={sidebarOpen
              ? 'M6 18L18 6M6 6l12 12'
              : 'M4 6h16M4 12h16M4 18h16'
            }
          />
        </svg>
      </button>

      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar view={view} setView={setView} collapsed={!sidebarOpen} />

        <main className="flex-1 p-8 md:ml-64">
          {view === 'crear' && (
            <AdminCarrerasForm
              initialValues={editItem}
              onSuccess={() => {
                setEditItem(undefined);
                setView('listar');
                setSidebarOpen(false);
              }}
            />
          )}
          {view === 'listar' && (
            <AdminCarrerasList
              onEdit={(carrera) => {
                setEditItem(carrera);
                setView('crear');
                setSidebarOpen(false);
              }}
            />
          )}
          {view === 'inscripciones' && <AdminInscripcionesView />}
        </main>
      </div>
    </ProtectedRoute>
  );
}