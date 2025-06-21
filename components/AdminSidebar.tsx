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
    <aside className={`flex flex-col bg-white shadow-lg rounded-lg overflow-hidden
                       fixed top-0 left-0 h-full z-40 transform transition-transform
                       ${collapsed ? '-translate-x-64' : 'translate-x-0'} md:relative md:translate-x-0`}>
      {/* Toggle */}
      <div
        onClick={onToggle}
        className="absolute top-4 right-[-1.5rem] bg-white p-2 rounded-full shadow cursor-pointer"
      >
        {collapsed
          ? <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          : <ChevronLeftIcon className="w-5 h-5 text-gray-600" />}
      </div>

      <nav className="mt-8 space-y-2">
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
  );
}