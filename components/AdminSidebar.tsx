import React from 'react';
import { PlusCircleIcon, PencilIcon, ClipboardIcon } from '@heroicons/react/24/outline';

interface SidebarProps {
  view: 'crear' | 'listar' | 'inscripciones';
  setView: (v: SidebarProps['view']) => void;
  collapsed: boolean;
}

export default function AdminSidebar({ view, setView, collapsed }: SidebarProps) {
  const btnBase = 'flex items-center w-full px-4 py-2 rounded-lg transition';
  const sidebarClasses = [
    'bg-white',
    'shadow-lg',
    'rounded-lg',
    'p-6',
    'space-y-4',
    'fixed',
    'top-0',
    'left-0',
    'h-full',
    'z-40',
    'transform',
    'transition-transform',
    'w-64'
  ].join(' ');
  const hiddenClass = collapsed ? '-translate-x-full' : 'translate-x-0';

  return (
    <aside className={`${sidebarClasses} ${hiddenClass} md:relative md:translate-x-0`}>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Panel Admin</h2>

      <button
        onClick={() => setView('crear')}
        className={`${btnBase} ${
          view === 'crear'
            ? 'bg-purple-600 text-white'
            : 'text-gray-600 hover:bg-purple-50'
        }`}
      >
        <PlusCircleIcon className="h-5 w-5 mr-3" />
        Crear Carrera
      </button>

      <button
        onClick={() => setView('listar')}
        className={`${btnBase} ${
          view === 'listar'
            ? 'bg-purple-600 text-white'
            : 'text-gray-600 hover:bg-purple-50'
        }`}
      >
        <PencilIcon className="h-5 w-5 mr-3" />
        Editar / Eliminar
      </button>

      <button
        onClick={() => setView('inscripciones')}
        className={`${btnBase} ${
          view === 'inscripciones'
            ? 'bg-purple-600 text-white'
            : 'text-gray-600 hover:bg-purple-50'
        }`}
      >
        <ClipboardIcon className="h-5 w-5 mr-3" />
        Ver Inscripciones
      </button>
    </aside>
);
}