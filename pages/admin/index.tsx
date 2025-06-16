import { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminSidebar from '@/components/AdminSidebar';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList from '@/components/AdminCarrerasList';
import AdminInscripcionesView from '@/components/AdminInscripcionesView';

export default function AdminPage() {
  const [view, setView] = useState<'crear' | 'listar' | 'inscripciones'>('crear');
  const [editItem, setEditItem] = useState<any>(undefined);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar view={view} setView={setView} />
        <main className="flex-1 p-8">
          {view === 'crear' && (
            <AdminCarrerasForm
              initialValues={editItem}
              onSuccess={() => {
                setEditItem(undefined);
                setView('listar');
              }}
            />
          )}
          {view === 'listar' && (
            <AdminCarrerasList
              onEdit={(carrera) => {
                setEditItem(carrera);
                setView('crear');
              }}
            />
          )}
          {view === 'inscripciones' && <AdminInscripcionesView />}
        </main>
      </div>
    </ProtectedRoute>
  );
}