import React, { useState } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { CarreraData, Categoria, DistanciaConCategorias, AgeBasis } from '@/types/carrera';
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
  initialValues?: CarreraData & { id: string; bannerUrl?: string; imagenUrl?: string };
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({ initialValues, onSuccess }: AdminCarrerasFormProps) {
  const [titulo, setTitulo] = useState(initialValues?.titulo || '');
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion || '');
  const [lugar, setLugar] = useState(initialValues?.lugar || '');
  const [fecha, setFecha] = useState(initialValues?.fecha || '');
  const [horaSalida, setHoraSalida] = useState(initialValues?.horaSalida || '');
  const [maxCompetitors, setMaxCompetitors] = useState<number>(initialValues?.maxCompetitors || 0);
  const [ageBasis, setAgeBasis] = useState<AgeBasis>(initialValues?.ageBasis || 'endOfYear');

  const [kitFecha, setKitFecha] = useState(initialValues?.kitFecha || '');
  const [kitLugar, setKitLugar] = useState(initialValues?.kitLugar || '');
  const [kitHorario, setKitHorario] = useState(initialValues?.kitHorario || '');

  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [imagenUrl, setImagenUrl] = useState<string|undefined>(initialValues?.imagenUrl);
  const [bannerUrl, setBannerUrl] = useState<string|undefined>(initialValues?.bannerUrl);

  const [distancias, setDistancias] = useState<DistanciaConCategorias[]>(initialValues?.distancias || []);
  const [nuevaDistancia, setNuevaDistancia] = useState('');
  const [distanciaSeleccionada, setDistanciaSeleccionada] = useState('');

  const [nuevaCat, setNuevaCat] = useState<Categoria>({ nombre: '', minAge: 0, maxAge: 0, price: 0 });
  const [editDistIndex, setEditDistIndex] = useState<number | null>(null);
  const [editCatIndex, setEditCatIndex] = useState<number | null>(null);

  const uploadIfNeeded = async (file: File, prefix: string) => {
    const path = `${prefix}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    return getDownloadURL(snap.ref);
  };

  const handleAddDistancia = () => {
    const d = nuevaDistancia.trim();
    if (!d) return;
    if (distancias.find(dd => dd.distancia === d)) return;
    setDistancias(prev => [...prev, { distancia: d, categorias: [] }]);
    setNuevaDistancia('');
  };

  const handleAddOrSaveCategoria = () => {
    if (!distanciaSeleccionada) return;
    if (!nuevaCat.nombre.trim() || nuevaCat.minAge < 0 || nuevaCat.maxAge < nuevaCat.minAge || nuevaCat.price < 0) return;
    setDistancias(prev => prev.map(d => {
      if (d.distancia !== distanciaSeleccionada) return d;
      const nuevasCats = [...d.categorias];
      if (editCatIndex !== null) nuevasCats[editCatIndex] = nuevaCat;
      else nuevasCats.push(nuevaCat);
      return { ...d, categorias: nuevasCats };
    }));
    setNuevaCat({ nombre: '', minAge: 0, maxAge: 0, price: 0 });
    setEditCatIndex(null);
  };

  const handleEditCategoria = (dIndex: number, cIndex: number) => {
    const cat = distancias[dIndex].categorias[cIndex];
    setNuevaCat(cat);
    setDistanciaSeleccionada(distancias[dIndex].distancia);
    setEditCatIndex(cIndex);
  };

  const handleDeleteCategoria = (dIndex: number, cIndex: number) => {
    setDistancias(prev => prev.map((d, i) => {
      if (i !== dIndex) return d;
      const categorias = d.categorias.filter((_, j) => j !== cIndex);
      return { ...d, categorias };
    }));
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

    const payload = {
      titulo,
      descripcion,
      lugar,
      fecha,
      horaSalida,
      maxCompetitors,
      ageBasis,
      distancias,
      kitFecha: kitFecha || 'Por definir',
      kitLugar: kitLugar || 'Por definir',
      kitHorario: kitHorario || 'Por definir',
      ...(newImagenUrl ? { imagenUrl: newImagenUrl } : {}),
      ...(newBannerUrl ? { bannerUrl: newBannerUrl } : {}),
    };

    if (initialValues?.id) {
      await updateDoc(doc(db, 'carreras', initialValues.id), payload);
    } else {
      await addDoc(collection(db, 'carreras'), payload);
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

      {/* TÍTULO */}
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

      {/* DESCRIPCIÓN */}
      <div>
        <label className="block font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded focus:ring-green-300"
        />
      </div>

      {/* LUGAR */}
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

      {/* FECHA & HORA */}
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

      {/* CUPO MÁXIMO */}
      <div>
        <label className="block font-medium">Cupo máximo de competidores</label>
        <input
          type="number"
          min="1"
          value={maxCompetitors}
          onChange={e => setMaxCompetitors(+e.target.value)}
          required
          className="mt-1 w-full border p-2 rounded focus:ring-green-300"
        />
      </div>

      {/* CÁLCULO DE EDAD */}
      <div>
        <label className="block font-medium">Cálculo de edad</label>
        <div className="mt-1 space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="endOfYear"
              checked={ageBasis === 'endOfYear'}
              onChange={() => setAgeBasis('endOfYear')}
              className="form-radio"
            />
            <span className="ml-2">Al término del año ({new Date().getFullYear()}/12/31)</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="eventDate"
              checked={ageBasis === 'eventDate'}
              onChange={() => setAgeBasis('eventDate')}
              className="form-radio"
            />
            <span className="ml-2">Fecha del evento</span>
          </label>
        </div>
      </div>


      {/* IMAGEN PRINCIPAL */}
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

      {/* BANNER SUPERIOR */}
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

      {/* DISTANCIAS */}
      <div>
        <h3 className="font-medium text-green-600">Distancias</h3>
        <div className="flex space-x-2 mt-2">
          <input
            type="text"
            value={nuevaDistancia}
            onChange={e => setNuevaDistancia(e.target.value)}
            placeholder="Ej. 5K, 10K"
            className="border p-2 rounded"
          />
          <button type="button" onClick={handleAddDistancia} className="bg-green-600 text-white px-3 py-1 rounded">Agregar</button>
        </div>
        <div className="space-y-4 mt-4">
          {distancias.map((d, dIndex) => (
            <div key={d.distancia} className="border p-4 rounded">
              <h4 className="text-purple-700 font-semibold">Distancia: {d.distancia}</h4>
              <ul className="mt-2 space-y-1">
                {d.categorias.map((c, cIndex) => (
                  <li key={cIndex} className="flex justify-between items-center">
                    <span>{c.nombre} ({c.minAge}-{c.maxAge}) - ${c.price.toFixed(2)}</span>
                    <div className="space-x-2">
                      <button type="button" onClick={() => handleEditCategoria(dIndex, cIndex)}><PencilIcon className="w-4 h-4 text-blue-600" /></button>
                      <button type="button" onClick={() => handleDeleteCategoria(dIndex, cIndex)}><TrashIcon className="w-4 h-4 text-red-600" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* FORMULARIO PARA CATEGORÍA */}
      <div className="mt-4">
        <h4 className="text-green-700 font-semibold">Agregar categoría</h4>
        <select value={distanciaSeleccionada} onChange={e => setDistanciaSeleccionada(e.target.value)} className="mt-2 w-full border p-2 rounded">
          <option value="">Selecciona una distancia</option>
          {distancias.map(d => <option key={d.distancia} value={d.distancia}>{d.distancia}</option>)}
        </select>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <input type="text" placeholder="Nombre" value={nuevaCat.nombre} onChange={e => setNuevaCat(s => ({ ...s, nombre: e.target.value }))} className="border p-2 rounded" />
          <input type="number" placeholder="Edad min" value={nuevaCat.minAge} onChange={e => setNuevaCat(s => ({ ...s, minAge: +e.target.value }))} className="border p-2 rounded" />
          <input type="number" placeholder="Edad max" value={nuevaCat.maxAge} onChange={e => setNuevaCat(s => ({ ...s, maxAge: +e.target.value }))} className="border p-2 rounded" />
          <div className="flex items-center space-x-1">
            <CurrencyDollarIcon className="w-5 h-5 text-gray-500" />
            <input type="number" placeholder="Precio" value={nuevaCat.price} onChange={e => setNuevaCat(s => ({ ...s, price: +e.target.value }))} className="flex-1 border p-2 rounded" />
          </div>
        </div>
        <button type="button" onClick={handleAddOrSaveCategoria} className="mt-2 w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition">
          <PlusCircleIcon className="w-5 h-5 mr-1" />{editCatIndex !== null ? "Guardar categoría" : "Agregar categoría"}
        </button>
      </div>

      {/* ENTREGA DE KITS */}
      <div className="border-t pt-4">
        <h3 className="font-medium text-green-600">Entrega de Kits</h3>
        <input type="date" value={kitFecha} onChange={e => setKitFecha(e.target.value)} placeholder="Fecha" className="mt-2 w-full border p-2 rounded" />
        <input type="text" value={kitLugar} onChange={e => setKitLugar(e.target.value)} placeholder="Lugar de entrega" className="mt-2 w-full border p-2 rounded" />
        <input type="text" value={kitHorario} onChange={e => setKitHorario(e.target.value)} placeholder="Horario de entrega" className="mt-2 w-full border p-2 rounded" />
      </div>

      <button type="submit" className="mt-6 w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 transition">Guardar</button>
    </form>
  );
}