import { useState } from 'react';
import AdminCarrerasForm from './AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from './AdminCarrerasList';
import AdminInscripcionesView from './AdminInscripcionesView';

export default function AdminPanel() {
  const [vista, setVista] = useState<'crear' | 'listar' | 'insc'>('crear');
  const [editar, setEditar] = useState<CarreraItem | undefined>(undefined);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Panel de Administración</h1>
      <nav className="flex gap-4 mb-6">
        <button
          className={vista === 'crear' ? 'font-semibold' : ''}
          onClick={() => { setEditar(undefined); setVista('crear'); }}
        >
          Crear / Editar Carrera
        </button>
        <button
          className={vista === 'listar' ? 'font-semibold' : ''}
          onClick={() => setVista('listar')}
        >
          Listar Carreras
        </button>
        <button
          className={vista === 'insc' ? 'font-semibold' : ''}
          onClick={() => setVista('insc')}
        >
          Ver Inscripciones
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
          onEdit={(c) => { setEditar(c); setVista('crear'); }}
        />
      )}
      {vista === 'insc' && <AdminInscripcionesView />}
    </div>
  );
}
