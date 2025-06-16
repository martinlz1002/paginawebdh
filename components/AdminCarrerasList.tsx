import React, { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CarreraData } from '@/types/carrera';

export interface CarreraItem extends CarreraData { id: string; }

interface Props { onEdit: (c: CarreraItem) => void; }
export default function AdminCarrerasList({ onEdit }: Props) {
  const [list, setList] = useState<CarreraItem[]>([]);
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'carreras'));
      setList(snap.docs.map(d => ({ id: d.id, ...(d.data() as CarreraData) })));
    })();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar?')) return;
    await deleteDoc(doc(db, 'carreras', id));
    setList(list.filter(c => c.id !== id));
  };

  return (
    <table>
      <thead><tr><th>Título</th><th>Fecha</th><th>Acciones</th></tr></thead>
      <tbody>
        {list.map(c => (
          <tr key={c.id}>
            <td>{c.titulo}</td>
            <td>{new Date(c.fecha).toLocaleDateString()}</td>
            <td>
              <button onClick={() => onEdit(c)}>Editar</button>
              <button onClick={() => handleDelete(c.id)}>Eliminar</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}