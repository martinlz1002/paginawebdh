// components/AdminPanel.tsx
import { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from '@/components/AdminCarrerasList';

export default function AdminPanel() {
  const [vista, setVista] = useState<'crear' | 'listar'>('listar');
  const [editar, setEditar] = useState<CarreraItem | undefined>(undefined);

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>
        <nav className="mb-6">
          <button
            className={`mr-4 ${vista === 'crear' ? 'font-semibold' : ''}`}
            onClick={() => {
              setEditar(undefined);
              setVista('crear');
            }}
          >
            Crear / Editar Carrera
          </button>
          <button
            className={`${vista === 'listar' ? 'font-semibold' : ''}`}
            onClick={() => setVista('listar')}
          >
            Listar Carreras
          </button>
        </nav>

        {vista === 'crear' && (
          <AdminCarrerasForm
            initialValues={editar}
            onSuccess={() => setVista('listar')}
          />
        )}

        {vista === 'listar' && (
          <AdminCarrerasList
            onEdit={(c: CarreraItem) => {
              setEditar(c);
              setVista('crear');
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
