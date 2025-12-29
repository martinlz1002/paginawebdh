import React, { useState } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { CarreraData, Categoria, DistanciaConCategorias, AgeBasis } from "@/types/carrera";
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
  initialValues?: CarreraData & {
    id: string;
    bannerUrl?: string;
    imagenUrl?: string;

    // ✅ nuevo
    inscripcionesAbiertas?: boolean;
    inscripcionesMensaje?: string;
  };
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({ initialValues, onSuccess }: AdminCarrerasFormProps) {
  const [titulo, setTitulo] = useState(initialValues?.titulo || "");
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion || "");
  const [lugar, setLugar] = useState(initialValues?.lugar || "");
  const [fecha, setFecha] = useState<string>("");
  const [horaSalida, setHoraSalida] = useState(initialValues?.horaSalida || "");
  const [maxCompetitors, setMaxCompetitors] = useState<number>(initialValues?.maxCompetitors || 0);
  const [ageBasis, setAgeBasis] = useState<AgeBasis>(initialValues?.ageBasis || "endOfYear");

  const [kitFecha, setKitFecha] = useState(initialValues?.kitFecha || "");
  const [kitLugar, setKitLugar] = useState(initialValues?.kitLugar || "");
  const [kitHorario, setKitHorario] = useState(initialValues?.kitHorario || "");

  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [imagenUrl, setImagenUrl] = useState<string | undefined>(initialValues?.imagenUrl);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(initialValues?.bannerUrl);

  const [distancias, setDistancias] = useState<DistanciaConCategorias[]>(
    initialValues?.distancias || []
  );
  const [nuevaDistancia, setNuevaDistancia] = useState("");
  const [distanciaSeleccionada, setDistanciaSeleccionada] = useState("");

  const [nuevaCat, setNuevaCat] = useState<Categoria>({
    nombre: "",
    minAge: 0,
    maxAge: 0,
    price: 0,
  });
  const [editCatIndex, setEditCatIndex] = useState<number | null>(null);

  // ✅ NUEVO: control de inscripciones
  const [inscripcionesAbiertas, setInscripcionesAbiertas] = useState<boolean>(
    initialValues?.inscripcionesAbiertas !== false // default true
  );
  const [inscripcionesMensaje, setInscripcionesMensaje] = useState<string>(
    initialValues?.inscripcionesMensaje || "Inscripciones pausadas temporalmente."
  );

  const uploadIfNeeded = async (file: File, prefix: string) => {
    const path = `${prefix}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    return getDownloadURL(snap.ref);
  };

  // ✅ FIX: normalizar distancia para evitar "5k" vs "5K" vs "5K "
  const normalizeDist = (v: string) => v.replace(/\s+/g, "").trim().toUpperCase();

  const handleAddDistancia = () => {
    const raw = nuevaDistancia.trim();
    const normalized = normalizeDist(raw);
    if (!normalized || distancias.some((dd) => dd.distancia === normalized)) return;

    setDistancias((prev) => [...prev, { distancia: normalized, categorias: [] }]);
    setNuevaDistancia("");
  };

  const handleAddOrSaveCategoria = () => {
    if (!distanciaSeleccionada) return;

    const nombre = (nuevaCat.nombre || "").trim();
    if (!nombre) return;

    if (nuevaCat.minAge < 0) return;
    if (nuevaCat.maxAge < nuevaCat.minAge) return;
    if (nuevaCat.price < 0) return;

    setDistancias((prev) =>
      prev.map((d) => {
        if (d.distancia !== distanciaSeleccionada) return d;

        const cats = [...d.categorias];
        const catToSave: Categoria = {
          ...nuevaCat,
          nombre,
          price: Number(nuevaCat.price) || 0,
          minAge: Number(nuevaCat.minAge) || 0,
          maxAge: Number(nuevaCat.maxAge) || 0,
        };

        if (editCatIndex !== null) cats[editCatIndex] = catToSave;
        else cats.push(catToSave);

        return { ...d, categorias: cats };
      })
    );

    setNuevaCat({ nombre: "", minAge: 0, maxAge: 0, price: 0 });
    setEditCatIndex(null);
  };

  const handleEditCategoria = (dIndex: number, cIndex: number) => {
    const cat = distancias[dIndex].categorias[cIndex];
    setNuevaCat(cat);
    setDistanciaSeleccionada(distancias[dIndex].distancia);
    setEditCatIndex(cIndex);
  };

  const handleDeleteCategoria = (dIndex: number, cIndex: number) => {
    setDistancias((prev) =>
      prev.map((d, i) => {
        if (i !== dIndex) return d;
        return { ...d, categorias: d.categorias.filter((_, j) => j !== cIndex) };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let newImagenUrl = imagenUrl;
    let newBannerUrl = bannerUrl;

    if (imagenFile) {
      if (newImagenUrl) await deleteObject(ref(storage, newImagenUrl)).catch(() => {});
      newImagenUrl = await uploadIfNeeded(imagenFile, "carreras");
    }

    if (bannerFile) {
      if (newBannerUrl) await deleteObject(ref(storage, newBannerUrl)).catch(() => {});
      newBannerUrl = await uploadIfNeeded(bannerFile, "carreras/banners");
    }

    // ✅ FIX: normaliza TODAS las distancias existentes al guardar
    const distanciasNorm: DistanciaConCategorias[] = (distancias || []).map((d) => ({
      distancia: normalizeDist(d.distancia),
      categorias: (d.categorias || []).map((c) => ({
        ...c,
        nombre: (c.nombre || "").trim(),
        minAge: Number(c.minAge) || 0,
        maxAge: Number(c.maxAge) || 0,
        price: Number(c.price) || 0,
      })),
    }));

    const payload: any = {
      titulo,
      descripcion,
      lugar,
      fecha,
      horaSalida,
      maxCompetitors,
      ageBasis,
      distancias: distanciasNorm,
      kitFecha: kitFecha || "Por definir",
      kitLugar: kitLugar || "Por definir",
      kitHorario: kitHorario || "Por definir",

      // ✅ control de inscripciones
      inscripcionesAbiertas,
      inscripcionesMensaje: inscripcionesAbiertas
        ? ""
        : inscripcionesMensaje || "Inscripciones pausadas temporalmente.",

      ...(newImagenUrl ? { imagenUrl: newImagenUrl } : {}),
      ...(newBannerUrl ? { bannerUrl: newBannerUrl } : {}),
    };

    if (initialValues?.id) {
      // ✅ No tocamos nextNumber aquí para no romper carreras existentes
      await updateDoc(doc(db, "carreras", initialValues.id), payload);
    } else {
      // ✅ FIX CRÍTICO: carrera nueva arranca con nextNumber=1
      await addDoc(collection(db, "carreras"), {
        ...payload,
        nextNumber: 1,
      });
    }

    setImagenUrl(newImagenUrl);
    setBannerUrl(newBannerUrl);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-semibold text-gray-800">
        {initialValues ? "Editar Carrera" : "Nueva Carrera"}
      </h2>

      {/* ✅ CONTROL DE INSCRIPCIONES */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Inscripciones en línea</p>
            <p className="text-sm text-gray-600">
              Si lo apagas, no se podrán crear pagos Stripe para esta carrera.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setInscripcionesAbiertas((v) => !v)}
            className={`px-4 py-2 rounded-lg text-dh-ink font-medium ${
              inscripcionesAbiertas
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {inscripcionesAbiertas ? "Abiertas" : "Pausadas"}
          </button>
        </div>

        {!inscripcionesAbiertas && (
          <div className="mt-3">
            <label className="block mb-1 font-medium text-gray-700">
              Mensaje al usuario (opcional)
            </label>
            <input
              type="text"
              value={inscripcionesMensaje}
              onChange={(e) => setInscripcionesMensaje(e.target.value)}
              placeholder="Ej. Inscripciones pausadas por cupo lleno."
              className="w-full border p-2 rounded text-gray-800"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este mensaje lo verán en /inscribirse y también bloqueará el checkout.
            </p>
          </div>
        )}
      </div>

      {/* TÍTULO */}
      <div>
        <label className="block mb-1 font-medium text-gray-700">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          className="w-full border p-2 rounded text-gray-800 focus:ring-green-300"
        />
      </div>

      {/* DESCRIPCIÓN */}
      <div>
        <label className="block mb-1 font-medium text-gray-700">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
          className="w-full border p-2 rounded text-gray-800 focus:ring-green-300"
        />
      </div>

      {/* LUGAR */}
      <div>
        <label className="block mb-1 font-medium text-gray-700 flex items-center">
          <MapPinIcon className="w-5 h-5 mr-2 text-gray-600" />
          Lugar
        </label>
        <input
          type="text"
          value={lugar}
          onChange={(e) => setLugar(e.target.value)}
          required
          className="w-full border p-2 rounded text-gray-800 focus:ring-green-300"
        />
      </div>

      {/* FECHA & HORA */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 font-medium text-gray-700 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-gray-600" />
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            className="w-full border p-2 rounded text-gray-800 focus:ring-green-300"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium text-gray-700 flex items-center">
            <ClockIcon className="w-5 h-5 mr-2 text-gray-600" />
            Hora de salida
          </label>
          <input
            type="time"
            value={horaSalida}
            onChange={(e) => setHoraSalida(e.target.value)}
            required
            className="w-full border p-2 rounded text-gray-800 focus:ring-green-300"
          />
        </div>
      </div>

      {/* CUPO MÁXIMO */}
      <div>
        <label className="block mb-1 font-medium text-gray-700">Cupo máximo</label>
        <input
          type="number"
          min="1"
          value={maxCompetitors}
          onChange={(e) => setMaxCompetitors(+e.target.value)}
          required
          className="w-full border p-2 rounded text-gray-800 focus:ring-green-300"
        />
      </div>

      {/* CÁLCULO DE EDAD */}
      <div>
        <label className="block mb-1 font-medium text-gray-700">Cálculo de edad</label>
        <div className="space-x-4">
          <label className="inline-flex items-center text-gray-800">
            <input
              type="radio"
              value="endOfYear"
              checked={ageBasis === "endOfYear"}
              onChange={() => setAgeBasis("endOfYear")}
              className="form-radio"
            />
            <span className="ml-2">Fin de año</span>
          </label>
          <label className="inline-flex items-center text-gray-800">
            <input
              type="radio"
              value="eventDate"
              checked={ageBasis === "eventDate"}
              onChange={() => setAgeBasis("eventDate")}
              className="form-radio"
            />
            <span className="ml-2">Fecha del evento</span>
          </label>
        </div>
      </div>

      {/* IMAGEN PRINCIPAL */}
      <div>
        <label className="block mb-1 font-medium text-gray-700 flex items-center">
          <PhotoIcon className="w-5 h-5 mr-2 text-gray-600" />
          Imagen principal
        </label>
        {imagenUrl && (
          <div className="flex items-center mb-2">
            <img src={imagenUrl} alt="Principal" className="h-24 rounded mr-4" />
            <button type="button" onClick={() => setImagenUrl(undefined)} className="text-red-600">
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImagenFile(e.target.files?.[0] ?? null)}
          className="text-gray-800"
        />
      </div>

      {/* BANNER */}
      <div>
        <label className="block mb-1 font-medium text-gray-700 flex items-center">
          <PhotoIcon className="w-5 h-5 mr-2 text-gray-600" />
          Banner superior
        </label>
        {bannerUrl && (
          <div className="flex items-center mb-2">
            <img src={bannerUrl} alt="Banner" className="h-32 rounded mr-4 object-cover w-full" />
            <button type="button" onClick={() => setBannerUrl(undefined)} className="text-red-600">
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
          className="text-gray-800"
        />
      </div>

      {/* DISTANCIAS */}
      <div>
        <h3 className="font-medium text-gray-800">Distancias</h3>
        <div className="flex mt-2">
          <input
            type="text"
            value={nuevaDistancia}
            onChange={(e) => setNuevaDistancia(e.target.value)}
            placeholder="Ej. 5K, 10K, 300m"
            className="flex-1 border p-2 rounded text-gray-800"
          />
          <button
            type="button"
            onClick={handleAddDistancia}
            className="ml-2 bg-green-600 text-dh-ink px-3 py-1 rounded"
          >
            Agregar
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {distancias.map((d, dIndex) => (
            <div key={d.distancia} className="border p-4 rounded">
              <h4 className="text-gray-800 font-semibold">Distancia: {d.distancia}</h4>
              <ul className="mt-2 space-y-1">
                {d.categorias.map((c, cIndex) => (
                  <li key={cIndex} className="flex justify-between items-center text-gray-800">
                    <span>
                      {c.nombre} ({c.minAge}-{c.maxAge}) – ${Number(c.price).toFixed(2)}
                    </span>
                    <div className="flex space-x-2">
                      <button type="button" onClick={() => handleEditCategoria(dIndex, cIndex)}>
                        <PencilIcon className="w-4 h-4 text-blue-600" />
                      </button>
                      <button type="button" onClick={() => handleDeleteCategoria(dIndex, cIndex)}>
                        <TrashIcon className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* AGREGAR CATEGORÍA */}
      <div>
        <h4 className="font-medium text-gray-800">Agregar / Editar Categoría</h4>
        <select
          value={distanciaSeleccionada}
          onChange={(e) => setDistanciaSeleccionada(normalizeDist(e.target.value))}
          className="w-full border p-2 rounded text-gray-800"
        >
          <option value="">Selecciona una distancia</option>
          {distancias.map((d) => (
            <option key={d.distancia} value={d.distancia}>
              {d.distancia}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-4 gap-2 mt-2">
          <input
            type="text"
            placeholder="Nombre"
            value={nuevaCat.nombre}
            onChange={(e) => setNuevaCat((s) => ({ ...s, nombre: e.target.value }))}
            className="border p-2 rounded text-gray-800"
          />
          <input
            type="number"
            placeholder="Edad min"
            value={nuevaCat.minAge}
            onChange={(e) => setNuevaCat((s) => ({ ...s, minAge: +e.target.value }))}
            className="border p-2 rounded text-gray-800"
          />
          <input
            type="number"
            placeholder="Edad max"
            value={nuevaCat.maxAge}
            onChange={(e) => setNuevaCat((s) => ({ ...s, maxAge: +e.target.value }))}
            className="border p-2 rounded text-gray-800"
          />
          <div className="flex items-center border p-2 rounded">
            <CurrencyDollarIcon className="w-5 h-5 mr-1 text-gray-600" />
            <input
              type="number"
              placeholder="Precio"
              value={nuevaCat.price}
              onChange={(e) => setNuevaCat((s) => ({ ...s, price: +e.target.value }))}
              className="flex-1 text-gray-800"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddOrSaveCategoria}
          className="mt-2 w-full bg-purple-600 text-dh-ink py-2 rounded hover:bg-purple-700 transition"
        >
          <PlusCircleIcon className="w-5 h-5 inline-block mr-1" />
          {editCatIndex !== null ? "Guardar Categoría" : "Agregar Categoría"}
        </button>
      </div>

      {/* ENTREGA DE KITS */}
      <div>
        <h3 className="font-medium text-gray-800">Entrega de Kits</h3>
        <input
          type="date"
          value={kitFecha}
          onChange={(e) => setKitFecha(e.target.value)}
          className="w-full border p-2 rounded mt-2 text-gray-800"
        />
        <input
          type="text"
          value={kitLugar}
          onChange={(e) => setKitLugar(e.target.value)}
          placeholder="Lugar de entrega"
          className="w-full border p-2 rounded mt-2 text-gray-800"
        />
        <input
          type="text"
          value={kitHorario}
          onChange={(e) => setKitHorario(e.target.value)}
          placeholder="Horario de entrega"
          className="w-full border p-2 rounded mt-2 text-gray-800"
        />
      </div>

      <button type="submit" className="w-full bg-green-600 text-dh-ink py-3 rounded hover:bg-green-700 transition">
        Guardar Carrera
      </button>
    </form>
  );
}
