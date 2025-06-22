import React, { useEffect, useRef } from 'react';
import {
  PlusCircleIcon,
  PencilIcon,
  ClipboardIcon,
  ChevronRightIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  view: 'crear' | 'listar' | 'inscripciones';
  setView: (v: SidebarProps['view']) => void;
  open: boolean;
  onToggle: () => void;
}

export default function AdminSidebar({ view, setView, open, onToggle }: SidebarProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // cerrar al click fuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (open && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onToggle]);

  const btnBase = 'flex items-center w-full px-4 py-2 rounded-lg transition';

  return (
    <>
      {/* Toggle Tab */}
      <button
        onClick={onToggle}
        className="absolute top-8 left-0 z-20 bg-green-600 hover:bg-green-700 text-white p-1 rounded-r-lg focus:outline-none"
        aria-label={open ? 'Ocultar menú' : 'Mostrar menú'}
      >
        {open
          ? <ChevronLeftIcon className="w-5 h-5" />
          : <ChevronRightIcon className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <div
        ref={menuRef}
        className={`
          fixed inset-y-0 left-0 z-10 bg-white shadow-lg pt-20 pb-6
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          w-64 overflow-auto
        `}
      >
        <nav className="space-y-4 px-4">
          <button
            onClick={() => { setView('crear'); onToggle(); }}
            className={`${btnBase} ${view === 'crear' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" /> Crear
          </button>
          <button
            onClick={() => { setView('listar'); onToggle(); }}
            className={`${btnBase} ${view === 'listar' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <PencilIcon className="w-5 h-5 mr-2" /> Listar
          </button>
          <button
            onClick={() => { setView('inscripciones'); onToggle(); }}
            className={`${btnBase} ${view === 'inscripciones' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <ClipboardIcon className="w-5 h-5 mr-2" /> Inscripciones
          </button>
        </nav>
      </div>
    </>
  );
}