import React, { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CarreraData } from '@/types/carrera';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export interface CarreraItem extends CarreraData { id: string; }

interface Props { onEdit: (c: CarreraItem) => void; }

// Formatea "YYYY-MM-DD" a "DD/MM/YYYY"
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export default function AdminCarrerasList({ onEdit }: Props) {
  const [list, setList] = useState<CarreraItem[]>([]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'carreras'));
      setList(snap.docs.map(d => ({ id: d.id, ...(d.data() as CarreraData) })));
    })();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta carrera?')) return;
    await deleteDoc(doc(db, 'carreras', id));
    setList(list.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-4">
      {list.map(c => (
        <div
          key={c.id}
          className="flex items-center justify-between bg-white p-4 rounded-lg shadow hover:shadow-lg transition"
        >
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{c.titulo}</h3>
            <p className="text-sm text-gray-500">
              Fecha: <time>{formatDate(c.fecha)}</time>
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit(c)}
              className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition"
              title="Editar"
            >
              <PencilIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDelete(c.id)}
              className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
              title="Eliminar"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
      {list.length === 0 && (
        <p className="text-center text-gray-500">No hay carreras creadas.</p>
      )}
    </div>
  );
}