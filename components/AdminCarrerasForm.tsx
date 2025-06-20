import React, { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { CarreraData, Categoria } from '@/types/carrera';

export interface AdminCarrerasFormProps {
  initialValues?: CarreraData & { id: string; bannerUrl?: string };
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({
  initialValues,
  onSuccess
}: AdminCarrerasFormProps) {
  // Campos básicos
  const [titulo, setTitulo] = useState(initialValues?.titulo || '');
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion || '');
  const [lugar, setLugar] = useState(initialValues?.lugar || '');
  const [fecha, setFecha] = useState(initialValues?.fecha || '');
  const [horaSalida, setHoraSalida] = useState(initialValues?.horaSalida || '');

  // Imágenes opcionales
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [imagenUrl, setImagenUrl] = useState<string|undefined>(initialValues?.imagenUrl);
  const [bannerUrl, setBannerUrl] = useState<string|undefined>(initialValues?.bannerUrl);

  // Categorías con edición y borrado
  const [categorias, setCategorias] = useState<Categoria[]>(initialValues?.categorias ?? []);
  const [nuevaCat, setNuevaCat] = useState<Categoria>({ nombre: '', minAge: 0, maxAge: 0 });
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // Añadir o guardar categoría
  const handleAddOrSaveCategoria = () => {
    if (!nuevaCat.nombre.trim() || nuevaCat.minAge < 0 || nuevaCat.maxAge < nuevaCat.minAge) return;
    setCategorias(prev => {
      if (editIndex !== null) {
        const copy = [...prev];
        copy[editIndex] = nuevaCat;
        return copy;
      }
      return [...prev, nuevaCat];
    });
    setNuevaCat({ nombre: '', minAge: 0, maxAge: 0 });
    setEditIndex(null);
  };

  const handleEditCategoria = (idx: number) => {
    setNuevaCat(categorias[idx]);
    setEditIndex(idx);
  };

  const handleDeleteCategoria = (idx: number) => {
    setCategorias(prev => prev.filter((_, i) => i !== idx));
    if (editIndex === idx) {
      setNuevaCat({ nombre: '', minAge: 0, maxAge: 0 });
      setEditIndex(null);
    }
  };

  // Subida condicional de archivos
  const uploadIfNeeded = async (file: File, prefix: string) => {
    const path = `${prefix}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    return getDownloadURL(snap.ref);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let newImagenUrl = imagenUrl;
    let newBannerUrl = bannerUrl;

    // Imagen principal
    if (imagenFile) {
      if (newImagenUrl) {
        try { await deleteObject(ref(storage, newImagenUrl)); } catch {}
      }
      newImagenUrl = await uploadIfNeeded(imagenFile, 'carreras');
    }

    // Banner superior
    if (bannerFile) {
      if (newBannerUrl) {
        try { await deleteObject(ref(storage, newBannerUrl)); } catch {}
      }
      newBannerUrl = await uploadIfNeeded(bannerFile, 'carreras/banners');
    }

    // Armar payload
    const payload: CarreraData & { bannerUrl?: string } = {
      titulo,
      descripcion,
      lugar,
      fecha,
      horaSalida,
      categorias,
      ...(newImagenUrl ? { imagenUrl: newImagenUrl } : {}),
      ...(newBannerUrl ? { bannerUrl: newBannerUrl } : {}),
    };

    // Crear o actualizar en Firestore
    if (initialValues?.id) {
      await updateDoc(doc(db, 'carreras', initialValues.id), payload as any);
    } else {
      await addDoc(collection(db, 'carreras'), payload as any);
    }

    // Actualizar estado local
    setImagenUrl(newImagenUrl);
    setBannerUrl(newBannerUrl);

    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold">
        {initialValues ? 'Editar Carrera' : 'Crear Nueva Carrera'}
      </h2>

      {/* Título */}
      <div>
        <label className="block font-medium">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded"
        />
      </div>

      {/* Lugar */}
      <div>
        <label className="block font-medium">Lugar</label>
        <input
          type="text"
          value={lugar}
          onChange={e => setLugar(e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded"
        />
      </div>

      {/* Fecha y hora salida */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            required
            className="mt-1 w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Hora de salida</label>
          <input
            type="time"
            value={horaSalida}
            onChange={e => setHoraSalida(e.target.value)}
            required
            className="mt-1 w-full border p-2 rounded"
          />
        </div>
      </div>

      {/* Imagen principal opcional */}
      <div>
        <label className="block font-medium">Imagen principal (opcional)</label>
        {imagenUrl && (
          <div className="mb-2 flex items-center">
            <img src={imagenUrl} alt="Principal" className="h-24 object-cover rounded" />
            <button
              type="button"
              onClick={() => setImagenUrl(undefined)}
              className="text-red-600 ml-4"
            >
              Eliminar
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={e => setImagenFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full"
        />
      </div>

      {/* Banner superior opcional */}
      <div>
        <label className="block font-medium">Banner superior (opcional)</label>
        {bannerUrl && (
          <div className="mb-2 flex items-center">
            <img src={bannerUrl} alt="Banner" className="h-32 w-full object-cover rounded" />
            <button
              type="button"
              onClick={() => setBannerUrl(undefined)}
              className="text-red-600 ml-4"
            >
              Eliminar
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={e => setBannerFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full"
        />
      </div>

      {/* Categorías con editar/eliminar */}
      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">Categorías</h3>
        <ul className="mb-2 space-y-1">
          {categorias.map((c, i) => (
            <li key={i} className="flex justify-between items-center">
              <span>
                • {c.nombre} ({c.minAge}–{c.maxAge} años)
              </span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => handleEditCategoria(i)}
                  className="text-blue-600 hover:underline"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategoria(i)}
                  className="text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-2 items-end">
          <input
            type="text"
            placeholder="Nombre categoría"
            value={nuevaCat.nombre}
            onChange={e => setNuevaCat(s => ({ ...s, nombre: e.target.value }))}
            className="border p-2 rounded"
          />
          <input
            type="number"
            placeholder="Mín edad"
            value={nuevaCat.minAge}
            onChange={e => setNuevaCat(s => ({ ...s, minAge: Number(e.target.value) }))}
            className="border p-2 rounded"
          />
          <input
            type="number"
            placeholder="Máx edad"
            value={nuevaCat.maxAge}
            onChange={e => setNuevaCat(s => ({ ...s, maxAge: Number(e.target.value) }))}
            className="border p-2 rounded"
          />
          <button
            type="button"
            onClick={handleAddOrSaveCategoria}
            className="col-span-3 mt-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {editIndex !== null ? 'Guardar categoría' : '+ Agregar categoría'}
          </button>
        </div>
      </div>

      {/* Guardar */}
      <div>
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}