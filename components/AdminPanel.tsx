import { useState } from 'react';
import AdminCarrerasForm from './AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from './AdminCarrerasList';
import AdminInscripcionesView from './AdminInscripcionesView';
import AdminSidebar from './AdminSidebar';

export default function AdminPanel() {
  const [view, setView] = useState<
  'crear' | 'listar' | 'inscripciones' | 'eliminarInscripciones'
>('crear');
  const [editItem, setEditItem] = useState<CarreraItem>();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex flex-1">
        <AdminSidebar
          view={view}
          setView={setView}
          open={menuOpen}
          onToggle={() => setMenuOpen(o => !o)}
        />

        <main className="flex-1 p-6 relative z-0">
          <h1 className="text-2xl font-bold mb-6">    Panel de Administración</h1>

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
    </div>
  );
}