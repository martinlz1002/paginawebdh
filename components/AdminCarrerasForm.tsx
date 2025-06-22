import React, { useState } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { CarreraData, Categoria } from '@/types/carrera';
import {
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  PlusCircleIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

export interface AdminCarrerasFormProps {
  initialValues?: CarreraData & { id: string; bannerUrl?: string };
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({
  initialValues,
  onSuccess
}: AdminCarrerasFormProps) {
  // campos básicos
  const [titulo, setTitulo] = useState(initialValues?.titulo || '');
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion || '');
  const [lugar, setLugar] = useState(initialValues?.lugar || '');
  const [fecha, setFecha] = useState(initialValues?.fecha || '');
  const [horaSalida, setHoraSalida] = useState(initialValues?.horaSalida || '');
  const [precio, setPrecio] = useState(initialValues?.precio?.toString() || '');

  // imágenes
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [imagenUrl, setImagenUrl] = useState<string|undefined>(initialValues?.imagenUrl);
  const [bannerUrl, setBannerUrl] = useState<string|undefined>(initialValues?.bannerUrl);

  // categorías
  const [categorias, setCategorias] = useState<Categoria[]>(initialValues?.categorias ?? []);
  const [nuevaCat, setNuevaCat] = useState<Categoria>({ nombre: '', minAge: 0, maxAge: 0 });
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // helpers…
  const uploadIfNeeded = async (file: File, prefix: string) => {
    const path = `${prefix}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    return getDownloadURL(snap.ref);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let newImagenUrl = imagenUrl;
    let newBannerUrl = bannerUrl;

    if (imagenFile) {
      if (newImagenUrl) try { await deleteObject(ref(storage, newImagenUrl)); } catch {}
      newImagenUrl = await uploadIfNeeded(imagenFile, 'carreras');
    }
    if (bannerFile) {
      if (newBannerUrl) try { await deleteObject(ref(storage, newBannerUrl)); } catch {}
      newBannerUrl = await uploadIfNeeded(bannerFile, 'carreras/banners');
    }

    // armar payload, incluyendo precio parseado
    const payload: CarreraData & { bannerUrl?: string } = {
      titulo,
      descripcion,
      lugar,
      fecha,
      horaSalida,
      categorias,
      precio: parseFloat(precio) || 0,
      ...(newImagenUrl ? { imagenUrl: newImagenUrl } : {}),
      ...(newBannerUrl ? { bannerUrl: newBannerUrl } : {}),
    };

    if (initialValues?.id) {
      await updateDoc(doc(db, 'carreras', initialValues.id), payload as any);
    } else {
      await addDoc(collection(db, 'carreras'), payload as any);
    }

    setImagenUrl(newImagenUrl);
    setBannerUrl(newBannerUrl);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold text-green-700">
        {initialValues ? '✏️ Editar carrera' : '+ Crear carrera'}
      </h2>

      {/* Título */}
      <div>
        <label className="block font-medium">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded focus:ring-green-300"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded focus:ring-green-300"
        />
      </div>

      {/* Precio */}
      <div className="flex items-center space-x-2">
        <CurrencyDollarIcon className="w-5 h-5 text-gray-500" />
        <input
          type="number"
          step="0.01"
          value={precio}
          onChange={e => setPrecio(e.target.value)}
          placeholder="Precio"
          required
          className="flex-1 border p-2 rounded focus:ring-green-300"
        />
      </div>

      {/* Lugar */}
      <div className="flex items-center space-x-2">
        <MapPinIcon className="w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={lugar}
          onChange={e => setLugar(e.target.value)}
          placeholder="Lugar"
          required
          className="flex-1 border p-2 rounded focus:ring-green-300"
        />
      </div>

      {/* Fecha & Hora */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-5 h-5 text-purple-600" />
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            required
            className="flex-1 border p-2 rounded focus:ring-green-300"
          />
        </div>
        <div className="flex items-center space-x-2">
          <ClockIcon className="w-5 h-5 text-purple-600" />
          <input
            type="time"
            value={horaSalida}
            onChange={e => setHoraSalida(e.target.value)}
            required
            className="flex-1 border p-2 rounded focus:ring-green-300"
          />
        </div>
      </div>

      {/* Imagen principal */}
      <div>
        <label className="block font-medium flex items-center space-x-2">
          <PhotoIcon className="w-5 h-5 text-green-600" />
          <span>Imagen principal (opcional)</span>
        </label>
        {imagenUrl && (
          <div className="mt-2 flex items-center space-x-4">
            <img src={imagenUrl} alt="Principal" className="h-24 rounded" />
            <button
              type="button"
              onClick={() => setImagenUrl(undefined)}
              className="text-red-600"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={e => setImagenFile(e.target.files?.[0] ?? null)}
          className="mt-2"
        />
      </div>

      {/* Banner superior */}
      <div>
        <label className="block font-medium flex items-center space-x-2">
          <PhotoIcon className="w-5 h-5 text-green-600" />
          <span>Banner superior (opcional)</span>
        </label>
        {bannerUrl && (
          <div className="mt-2 flex items-center space-x-4">
            <img src={bannerUrl} alt="Banner" className="h-32 rounded w-full object-cover" />
            <button
              type="button"
              onClick={() => setBannerUrl(undefined)}
              className="text-red-600"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={e => setBannerFile(e.target.files?.[0] ?? null)}
          className="mt-2"
        />
      </div>

      {/* Categorías */}
      <div className="border-t pt-4">
        <h3 className="font-medium text-green-600 flex items-center space-x-2">
          <PlusCircleIcon className="w-5 h-5" />
          <span>Categorías</span>
        </h3>
        <ul className="mt-2 space-y-2">
          {categorias.map((c, i) => (
            <li key={i} className="flex justify-between items-center">
              <span>• {c.nombre} ({c.minAge}–{c.maxAge} años)</span>
              <div className="flex space-x-2">
                <button onClick={() => handleEditCategoria(i)}>
                  <PencilIcon className="w-5 h-5 text-blue-600" />
                </button>
                <button onClick={() => handleDeleteCategoria(i)}>
                  <TrashIcon className="w-5 h-5 text-red-600" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-2 mt-4">
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
            onChange={e => setNuevaCat(s => ({ ...s, minAge: +e.target.value }))}
            className="border p-2 rounded"
          />
          <input
            type="number"
            placeholder="Máx edad"
            value={nuevaCat.maxAge}
            onChange={e => setNuevaCat(s => ({ ...s, maxAge: +e.target.value }))}
            className="border p-2 rounded"
          />
        </div>
        <button
          type="button"
          onClick={handleAddOrSaveCategoria}
          className="mt-2 w-full flex justify-center items-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          <PlusCircleIcon className="w-5 h-5 mr-1" />
          {editIndex !== null ? "Guardar categoría" : "Agregar categoría"}
        </button>
      </div>

      {/* Enviar */}
      <button
        type="submit"
        className="mt-4 w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 transition"
      >
        Guardar
      </button>
    </form>
  );
}