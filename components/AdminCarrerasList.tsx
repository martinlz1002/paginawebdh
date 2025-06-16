import React, { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CarreraData } from '@/types/carrera';

export interface CarreraItem extends CarreraData { id:string }
export interface AdminCarrerasListProps { onEdit:(c:CarreraItem)=>void }

export default function AdminCarrerasList({ onEdit }:AdminCarrerasListProps){
  const [list, setList] = useState<CarreraItem[]>([]);
  const load=async()=>{
    const snap=await getDocs(collection(db,'carreras'));
    setList(snap.docs.map(d=>({ id:d.id, ...(d.data() as CarreraData) })));  };
  useEffect(()=>{load()},[]);
  const del=async(id:string)=>{ if(!confirm('Eliminar?'))return; await deleteDoc(doc(db,'carreras',id)); load();};
  return <table><thead><tr><th>Título</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>
    {list.map(c=><tr key={c.id}><td>{c.titulo}</td><td>{c.fecha}</td>
      <td><button onClick={()=>onEdit(c)}>Editar</button><button onClick={()=>del(c.id)}>Eliminar</button></td>
    </tr>)}
  </tbody></table>;
}