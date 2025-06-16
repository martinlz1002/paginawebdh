import React, { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from '@/components/AdminCarrerasList';
import AdminInscripcionesView from '@/components/AdminInscripcionesView';

export default function AdminPage(){
  const [vista, setVista]=useState<'crear'|'editar'|'listar'|'inscripciones'>('listar');
  const [editTarget, setEdit]=useState<CarreraItem|undefined>(undefined);
  return <ProtectedRoute>
    <nav className="flex gap-4 p-4 bg-gray-100">
      <button onClick={()=>{setEdit(undefined);setVista('crear')}}>Crear</button>
      <button onClick={()=>setVista('listar')}>Editar/Eliminar</button>
      <button onClick={()=>setVista('inscripciones')}>Ver Inscripciones</button>
    </nav>
    <div className="p-4">
      {vista==='crear'&&<AdminCarrerasForm onSuccess={()=>setVista('listar')}/>}      
      {vista==='listar'&&<AdminCarrerasList onEdit={c=>{setEdit(c);setVista('crear');}}/>}
      {vista==='inscripciones'&&<AdminInscripcionesView/>}
    </div>
  </ProtectedRoute>;
}
