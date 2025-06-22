import { useState } from 'react';
import AdminCarrerasForm from './AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from './AdminCarrerasList';
import AdminInscripcionesView from './AdminInscripcionesView';
import AdminSidebar from './AdminSidebar';

export default function AdminPanel() {
  const [view, setView] = useState<'crear' | 'listar' | 'inscripciones'>('crear');
  const [editItem, setEditItem] = useState<CarreraItem | undefined>();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative flex-1">
      {/* Aquí el sidebar está sobre el contenido, sin mover nada fuera */}
      <AdminSidebar
        view={view}
        setView={setView}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />

      {/* Contenido que NO se mueve */}
      <div className="pl-0 md:pl-0">
        <h1 className="text-2xl font-bold mb-6 pt-4">Panel de Administración</h1>

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
            onEdit={(c) => {
              setEditItem(c);
              setView('crear');
            }}
          />
        )}

        {view === 'inscripciones' && <AdminInscripcionesView />}
      </div>
    </div>
  );
}