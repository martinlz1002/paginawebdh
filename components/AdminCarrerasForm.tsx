import React, { useEffect, useState } from "react";
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

    // 🏁 RESULTADOS
    resultados?: {
      url?: string;
      publicado?: boolean;
    };
  };
  onSuccess?: () => void;
}

// ✅ Normaliza cualquier "fecha" a yyyy-mm-dd (pero tú guardas string, así que mostly passthrough)
function toYYYYMMDD(v: any): string {
  if (!v) return "";
  if (typeof v === "string") {
    // si ya viene yyyy-mm-dd, perfecto
    if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();

    // fallback: si viene otro formato raro, intenta parsear
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // por si acaso alguien guardó Date/Timestamp en algún doc viejo
  const d =
    v instanceof Date
      ? v
      : typeof v?.toDate === "function"
        ? v.toDate()
        : new Date(v);

  if (!Number.isFinite(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 🏁 RESULTADOS – parse seguro yyyy-mm-dd
function parseISODateYYYYMMDD(iso: string): Date {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date("2000-01-01");
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

export default function AdminCarrerasForm({ initialValues, onSuccess }: AdminCarrerasFormProps) {
  const [titulo, setTitulo] = useState(initialValues?.titulo || "");
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion || "");
  const [lugar, setLugar] = useState(initialValues?.lugar || "");

  // ✅ FIX: inicializa la fecha desde initialValues
  const [fecha, setFecha] = useState<string>(toYYYYMMDD((initialValues as any)?.fecha));

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

  // 🏁 RESULTADOS
const [resultadosUrl, setResultadosUrl] = useState(
  initialValues?.resultados?.url || ""
);
const [resultadosPublicado, setResultadosPublicado] = useState<boolean>(
  initialValues?.resultados?.publicado === true
);

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

  // ✅ FIX: cuando cambias de carrera a editar, refresca TODOS los campos (incluida fecha)
  useEffect(() => {
    setTitulo(initialValues?.titulo || "");
    setDescripcion(initialValues?.descripcion || "");
    setLugar(initialValues?.lugar || "");
    setFecha(toYYYYMMDD((initialValues as any)?.fecha));
    setHoraSalida(initialValues?.horaSalida || "");
    setMaxCompetitors(initialValues?.maxCompetitors || 0);
    setAgeBasis(initialValues?.ageBasis || "endOfYear");

    // 🏁 RESULTADOS
setResultadosUrl(initialValues?.resultados?.url || "");
setResultadosPublicado(initialValues?.resultados?.publicado === true);

    setKitFecha(initialValues?.kitFecha || "");
    setKitLugar(initialValues?.kitLugar || "");
    setKitHorario(initialValues?.kitHorario || "");

    setImagenUrl(initialValues?.imagenUrl);
    setBannerUrl(initialValues?.bannerUrl);

    setDistancias(initialValues?.distancias || []);
    setNuevaDistancia("");
    setDistanciaSeleccionada("");
    setNuevaCat({ nombre: "", minAge: 0, maxAge: 0, price: 0 });
    setEditCatIndex(null);

    setInscripcionesAbiertas(initialValues?.inscripcionesAbiertas !== false);
    setInscripcionesMensaje(
      initialValues?.inscripcionesMensaje || "Inscripciones pausadas temporalmente."
    );

    // si cambiaste de carrera, evita traer archivos seleccionados del form anterior
    setImagenFile(null);
    setBannerFile(null);
  }, [initialValues?.id]);

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
    if (!normalized || distancias.some((dd) => normalizeDist(dd.distancia) === normalized)) return;

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
        if (normalizeDist(d.distancia) !== normalizeDist(distanciaSeleccionada)) return d;

        const cats = [...(d.categorias || [])];
        const catToSave: Categoria = {
          ...nuevaCat,
          nombre,
          price: Number(nuevaCat.price) || 0,
          minAge: Number(nuevaCat.minAge) || 0,
          maxAge: Number(nuevaCat.maxAge) || 0,
        };

        if (editCatIndex !== null) cats[editCatIndex] = catToSave;
        else cats.push(catToSave);

        return { ...d, distancia: normalizeDist(d.distancia), categorias: cats };
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

  // 🏁 RESULTADOS
const fechaDate = parseISODateYYYYMMDD(fecha);
const today = new Date();
today.setHours(0, 0, 0, 0);
const carreraFinalizada = fechaDate < today;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ validación simple de fecha string
    const fechaOk = /^\d{4}-\d{2}-\d{2}$/.test((fecha || "").trim());
    if (!fechaOk) {
      alert("La fecha es inválida. Debe ser formato YYYY-MM-DD.");
      return;
    }

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

    // ✅ normaliza TODAS las distancias existentes al guardar
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
      fecha: (fecha || "").trim(), // ✅ string yyyy-mm-dd
      horaSalida,
      maxCompetitors,
      ageBasis,
      distancias: distanciasNorm,

      // 🏁 RESULTADOS
...(carreraFinalizada
  ? {
      resultados: {
        url: resultadosUrl.trim(),
        publicado: resultadosPublicado,
      },
    }
  : {
      resultados: {
        url: "",
        publicado: false,
      },
    }),

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
      await updateDoc(doc(db, "carreras", initialValues.id), payload);
    } else {
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
  <form
    onSubmit={handleSubmit}
    className="space-y-10 bg-dh-panel border border-dh-border rounded-3xl p-10 shadow-dh"
  >
    {/* HEADER */}
    <div className="flex items-center justify-between">
      <h2 className="text-3xl font-extrabold text-dh-ink">
        {initialValues ? "Editar Carrera" : "Nueva Carrera"}
      </h2>

      <span className="text-sm font-semibold text-dh-muted">
        Panel Administrativo
      </span>
    </div>

    {/* ================= INSCRIPCIONES ================= */}
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-dh-ink">Inscripciones en línea</p>
          <p className="text-sm text-dh-muted">
            Controla si Stripe puede generar pagos para esta carrera.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInscripcionesAbiertas((v) => !v)}
          className={`px-5 py-2 rounded-xl font-semibold transition ${
            inscripcionesAbiertas
              ? "bg-dh-green text-dh-dark hover:opacity-90"
              : "bg-red-100 text-red-600 hover:bg-red-200"
          }`}
        >
          {inscripcionesAbiertas ? "Abiertas" : "Pausadas"}
        </button>
      </div>

      {!inscripcionesAbiertas && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-dh-ink">
            Mensaje visible al usuario
          </label>
          <input
            type="text"
            value={inscripcionesMensaje}
            onChange={(e) => setInscripcionesMensaje(e.target.value)}
            placeholder="Ej. Cupo lleno."
            className="w-full"
          />
          <p className="text-xs text-dh-muted">
            Se mostrará en la página de inscripción.
          </p>
        </div>
      )}
    </div>

    {/* ================= RESULTADOS ================= */}
    {carreraFinalizada && (
      <div className="card p-6 space-y-4">
        <p className="font-bold text-dh-ink text-lg">🏁 Resultados oficiales</p>

        <input
          type="url"
          value={resultadosUrl}
          onChange={(e) => setResultadosUrl(e.target.value)}
          placeholder="https://sportmaniacs.com/..."
          className="w-full"
        />

        <label className="flex items-center gap-2 text-sm text-dh-ink font-semibold">
          <input
            type="checkbox"
            checked={resultadosPublicado}
            onChange={() => setResultadosPublicado((v) => !v)}
          />
          Publicar resultados
        </label>
      </div>
    )}

    {/* ================= DATOS GENERALES ================= */}
    <div className="card p-6 space-y-6">

      <div>
        <label className="text-sm font-semibold text-dh-ink">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          className="w-full mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-dh-ink">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
          className="w-full mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-dh-ink">
          <MapPinIcon className="w-5 h-5 inline mr-1 text-dh-purple" />
          Lugar
        </label>
        <input
          type="text"
          value={lugar}
          onChange={(e) => setLugar(e.target.value)}
          required
          className="w-full mt-1"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-semibold text-dh-ink">
            <CalendarIcon className="w-5 h-5 inline mr-1 text-dh-purple" />
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            className="w-full mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-dh-ink">
            Hora de salida
          </label>
          <input
            type="time"
            value={horaSalida}
            onChange={(e) => setHoraSalida(e.target.value)}
            required
            className="w-full mt-1"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-dh-ink">
          Cupo máximo
        </label>
        <input
          type="number"
          min="1"
          value={maxCompetitors}
          onChange={(e) => setMaxCompetitors(+e.target.value)}
          required
          className="w-full mt-1"
        />
      </div>

    </div>

    {/* ================= DISTANCIAS ================= */}
    <div className="card p-6 space-y-6">
      <h3 className="text-lg font-bold text-dh-ink">Distancias</h3>

      <div className="flex gap-3">
        <input
          type="text"
          value={nuevaDistancia}
          onChange={(e) => setNuevaDistancia(e.target.value)}
          placeholder="Ej. 5K, 10K"
          className="flex-1"
        />
        <button
          type="button"
          onClick={handleAddDistancia}
          className="px-4 py-2 rounded-xl bg-dh-purple text-white font-semibold hover:opacity-90 transition"
        >
          Agregar
        </button>
      </div>

      <div className="space-y-4">
        {distancias.map((d, dIndex) => (
          <div key={d.distancia} className="border border-dh-border rounded-2xl p-4">
            <h4 className="font-bold text-dh-ink">
              {normalizeDist(d.distancia)}
            </h4>

            <ul className="mt-3 space-y-2 text-sm">
              {d.categorias.map((c, cIndex) => (
                <li
                  key={cIndex}
                  className="flex justify-between items-center bg-dh-soft rounded-xl px-3 py-2"
                >
                  <span>
                    {c.nombre} ({c.minAge}-{c.maxAge}) – $
                    {Number(c.price).toFixed(2)}
                  </span>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleEditCategoria(dIndex, cIndex)}
                    >
                      <PencilIcon className="w-4 h-4 text-dh-purple" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteCategoria(dIndex, cIndex)
                      }
                    >
                      <TrashIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>

    {/* ================= GUARDAR ================= */}
    <button
      type="submit"
      className="w-full py-4 rounded-2xl bg-dh-green text-dh-dark font-extrabold hover:opacity-95 transition text-lg"
    >
      Guardar Carrera
    </button>
  </form>
);
}
