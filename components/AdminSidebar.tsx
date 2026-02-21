import React, { useEffect, useRef } from 'react';
import {
  PlusCircleIcon,
  PencilIcon,
  ClipboardIcon,
  TrashIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  view: 'crear' | 'listar' | 'inscripciones' | 'eliminarInscripciones' | 'inscripcionesManuales';
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
    className={`
      fixed top-16 bottom-0 left-0 z-40
      w-72
      bg-dh-panel border-r border-dh-border
      shadow-dh
      transform transition-transform duration-300
      ${open ? "translate-x-0" : "-translate-x-full"}
      overflow-y-auto
    `}
  >
    <div className="px-6 pt-8 pb-6 space-y-8">

      {/* Título */}
      <div>
        <p className="text-xs uppercase tracking-wider text-dh-muted font-semibold">
          Panel Admin
        </p>
        <h3 className="text-lg font-extrabold text-dh-ink mt-1">
          DH Control
        </h3>
      </div>

      {/* Navegación */}
      <nav className="space-y-2">

        {/* Crear */}
        <button
          onClick={() => { setView("crear"); onToggle(); }}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition
            ${
              view === "crear"
                ? "bg-dh-green text-dh-dark shadow-dhSm"
                : "text-dh-muted hover:bg-dh-soft"
            }
          `}
        >
          <PlusCircleIcon className="w-5 h-5" />
          Crear Carrera
        </button>

        {/* Listar */}
        <button
          onClick={() => { setView("listar"); onToggle(); }}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition
            ${
              view === "listar"
                ? "bg-dh-green text-dh-dark shadow-dhSm"
                : "text-dh-muted hover:bg-dh-soft"
            }
          `}
        >
          <PencilIcon className="w-5 h-5" />
          Listar Carreras
        </button>

        {/* Inscripciones */}
        <button
          onClick={() => { setView("inscripciones"); onToggle(); }}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition
            ${
              view === "inscripciones"
                ? "bg-dh-green text-dh-dark shadow-dhSm"
                : "text-dh-muted hover:bg-dh-soft"
            }
          `}
        >
          <ClipboardIcon className="w-5 h-5" />
          Ver Inscripciones
        </button>

        {/* Manuales */}
        <button
          onClick={() => { setView("inscripcionesManuales"); onToggle(); }}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition
            ${
              view === "inscripcionesManuales"
                ? "bg-dh-green text-dh-dark shadow-dhSm"
                : "text-dh-muted hover:bg-dh-soft"
            }
          `}
        >
          <UserPlusIcon className="w-5 h-5" />
          Inscripciones Manuales
        </button>

        {/* Eliminar */}
        <button
          onClick={() => { setView("eliminarInscripciones"); onToggle(); }}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition
            ${
              view === "eliminarInscripciones"
                ? "bg-red-500/15 text-red-600"
                : "text-dh-muted hover:bg-red-50 hover:text-red-600"
            }
          `}
        >
          <TrashIcon className="w-5 h-5" />
          Eliminar Inscripciones
        </button>

      </nav>

      {/* Footer sutil */}
      <div className="pt-6 border-t border-dh-border text-xs text-dh-muted">
        Admin DHTime © {new Date().getFullYear()}
      </div>

    </div>
  </div>
);
}