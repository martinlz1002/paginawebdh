import React, { useEffect, useRef } from 'react';
import {
  PlusCircleIcon,
  PencilIcon,
  ClipboardIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  view: 'crear' | 'listar' | 'inscripciones' | 'eliminarInscripciones';
  setView: (v: SidebarProps['view']) => void;
  open: boolean;
  onToggle: () => void;
}

export default function AdminSidebar({ view, setView, open, onToggle }: SidebarProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (open && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onToggle]);

  const btnBase = 'flex items-center w-full px-4 py-2 rounded-lg transition';

  return (
    <div
      ref={menuRef}
      className={
        `fixed inset-y-0 left-0 z-40 bg-white shadow-lg pt-4 pb-6
         transform transition-transform duration-300
         ${open ? 'translate-x-0' : '-translate-x-full'}
         w-64 overflow-auto`
      }
    >
      <nav className="space-y-4 px-4">
        <button
          onClick={() => { setView('crear'); onToggle(); }}
          className={`${btnBase} ${view === 'crear' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <PlusCircleIcon className="w-5 h-5 mr-2" /> Crear Carrera
        </button>
        <button
          onClick={() => { setView('listar'); onToggle(); }}
          className={`${btnBase} ${view === 'listar' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <PencilIcon className="w-5 h-5 mr-2" /> Listar Carreras
        </button>
        <button
          onClick={() => { setView('inscripciones'); onToggle(); }}
          className={`${btnBase} ${view === 'inscripciones' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <ClipboardIcon className="w-5 h-5 mr-2" /> Ver Inscripciones
        </button>
        <button
          onClick={() => { setView('eliminarInscripciones'); onToggle(); }}
          className={`${btnBase} ${view === 'eliminarInscripciones' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <TrashIcon className="w-5 h-5 mr-2" /> Eliminar Inscripciones
        </button>
      </nav>
    </div>
  );
}