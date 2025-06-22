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
    <div className="flex bg-gray-100 min-h-[calc(100vh-4rem)]">
      {/* Solo ocupa el contenido, no tapa footer */}
      <AdminSidebar
        view={view}
        setView={setView}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />

      <main
        className={`
          flex-1 transition-all duration-300
          ${collapsed ? 'ml-4' : 'ml-72'}
          p-6
        `}
      >
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

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
      </main>
    </div>
  );
}