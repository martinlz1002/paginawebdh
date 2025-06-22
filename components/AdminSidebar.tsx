import React from 'react';
import {
  PlusCircleIcon,
  PencilIcon,
  ClipboardIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  view: 'crear' | 'listar' | 'inscripciones';
  setView: (v: SidebarProps['view']) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function AdminSidebar({ view, setView, collapsed, onToggle }: SidebarProps) {
  const btnBase = 'flex items-center w-full px-4 py-2 rounded-lg transition';

  return (
    <div className="relative">
      {/* Toggle interno */}
      <button
        onClick={onToggle}
        className={`
          absolute left-0 top-4 z-20 flex items-center justify-center
          bg-green-600 hover:bg-green-700 text-white
          p-2 rounded-tr-lg rounded-br-lg
          transition-colors
        `}
        aria-label={collapsed ? 'Mostrar menú' : 'Ocultar menú'}
      >
        {collapsed
          ? <ChevronRightIcon className="w-5 h-5" />
          : <ChevronLeftIcon className="w-5 h-5" />}
      </button>

      {/* Sidebar superpuesto */}
      <aside
        className={`
          absolute left-0 top-0 h-full bg-white shadow-lg
          pt-16 px-6 space-y-6
          transition-all duration-300
          ${collapsed ? 'w-0 opacity-0' : 'w-64 opacity-100'}
          overflow-hidden
        `}
      >
        <nav className="space-y-4">
          <button
            onClick={() => setView('crear')}
            className={`${btnBase} ${view === 'crear' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" /> Crear
          </button>
          <button
            onClick={() => setView('listar')}
            className={`${btnBase} ${view === 'listar' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <PencilIcon className="w-5 h-5 mr-2" /> Listar
          </button>
          <button
            onClick={() => setView('inscripciones')}
            className={`${btnBase} ${view === 'inscripciones' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <ClipboardIcon className="w-5 h-5 mr-2" /> Inscripciones
          </button>
        </nav>
      </aside>
    </div>
  );
}