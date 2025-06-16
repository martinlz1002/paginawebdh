import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type { CarreraData, Categoria } from '@/types/carrera';

export interface AdminCarrerasFormProps {
  initialValues?: CarreraData & { id: string };
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({ initialValues, onSuccess }: AdminCarrerasFormProps) {
  const [titulo, setTitulo] = useState(initialValues?.titulo || '');
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion || '');
  const [ubicacion, setUbicacion] = useState(initialValues?.ubicacion || '');
  const [fecha, setFecha] = useState(initialValues?.fecha?.slice(0,10) || '');
  const [horaSalida, setHoraSalida] = useState(initialValues?.horaSalida || '');
  const [imagenFile, setImagenFile] = useState<File|undefined>();
  const [categorias, setCategorias] = useState<Categoria[]>(initialValues?.categorias || [{ nombre:'', minAge:0, maxAge:0 }]);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (initialValues) {
      setCategorias(initialValues.categorias);
    }
  }, [initialValues]);

  const handleCategoriaChange = (i:number, f:keyof Categoria, v:string|number) => {
    setCategorias(categorias.map((c,idx)=> idx===i?{ ...c, [f]: f==='nombre'?String(v):Number(v) }:c));
  };
  const addCat = ()=> setCategorias([...categorias,{ nombre:'',minAge:0,maxAge:0 }]);
  const remCat = (i:number)=> setCategorias(categorias.filter((_,idx)=>idx!==i));

  const handleSubmit = async(e:React.FormEvent) =>{
    e.preventDefault();
    try{
      const fn = getFunctions(app);
      const call = httpsCallable(fn,'crearCarrera');
      // build payload
      const payload: any = { titulo, descripcion, ubicacion, fecha, horaSalida, categorias };
      if(imagenFile){
        const data = await new Promise<string>((res,rej)=>{
          const r = new FileReader();
          r.onload = ()=>res((r.result as string).split(',')[1]);
          r.onerror = rej;
          r.readAsDataURL(imagenFile);
        });
        payload.imagenBase64 = data;
        payload.nombreArchivo = imagenFile.name;
      }
      if(initialValues) payload.id = initialValues.id;
      await call(payload);
      setMensaje('Carrera guardada');
      onSuccess?.();
    }catch(err:any){
      console.error(err);
      setMensaje('Error: '+err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="font-semibold">{initialValues?'Editar':'Crear'} Carrera</h2>
      <div><label>Título</label><input type="text" value={titulo} onChange={e=>setTitulo(e.target.value)} required className="w-full"/></div>
      <div><label>Descripción</label><textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)} required className="w-full"/></div>
      <div className="grid grid-cols-3 gap-4">
        <div><label>Ubicación</label><input value={ubicacion} onChange={e=>setUbicacion(e.target.value)} required className="w-full"/></div>
        <div><label>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} required className="w-full"/></div>
        <div><label>Hora</label><input type="time" value={horaSalida} onChange={e=>setHoraSalida(e.target.value)} required className="w-full"/></div>
      </div>
      <div><label>Foto (opcional)</label><input type="file" accept="image/*" onChange={e=>setImagenFile(e.target.files?.[0]!)} /></div>
      <div><label>Categorías</label>{categorias.map((c,i)=>(
        <div key={i} className="flex gap-2 items-center">
          <input placeholder="Nombre" value={c.nombre} onChange={e=>handleCategoriaChange(i,'nombre',e.target.value)} required/>
          <input placeholder="Edad min" type="number" value={c.minAge} onChange={e=>handleCategoriaChange(i,'minAge',e.target.value)} required/>
          <input placeholder="Edad max" type="number" value={c.maxAge} onChange={e=>handleCategoriaChange(i,'maxAge',e.target.value)} required/>
          <button type="button" onClick={()=>remCat(i)}>✕</button>
        </div>
      ))}
      <button type="button" onClick={addCat}>+ Agregar categoría</button></div>
      <button type="submit" className="bg-blue-600 text-white rounded py-1 px-3">Guardar</button>
      {mensaje && <p>{mensaje}</p>}
    </form>
  );
}