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
    className="space-y-8 bg-dh-panel p-8 rounded-3xl shadow-dh border border-dh-border"
  >
    <h2 className="text-3xl font-extrabold text-dh-ink">
      {initialValues ? "Editar Carrera" : "Nueva Carrera"}
    </h2>

    {/* ================= CONTROL INSCRIPCIONES ================= */}
    <div className="rounded-3xl bg-[#16161d] border border-dh-purple/20 p-8 space-y-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-lg font-extrabold text-white">
        Inscripciones en línea
      </p>
      <p className="text-sm text-white/60">
        Activa o pausa el registro y los pagos Stripe.
      </p>
    </div>

    {/* SWITCH MODERNO */}
    <button
      type="button"
      onClick={() => setInscripcionesAbiertas((v) => !v)}
      className={`relative w-32 h-12 rounded-full transition-all duration-300 font-bold ${
        inscripcionesAbiertas
          ? "bg-dh-green text-black"
          : "bg-red-600 text-white"
      }`}
    >
      <span
        className={`absolute top-1.5 transition-all duration-300 w-9 h-9 bg-white rounded-full shadow-md ${
          inscripcionesAbiertas ? "right-1.5" : "left-1.5"
        }`}
      />
      <span className="relative z-10">
        {inscripcionesAbiertas ? "Abiertas" : "Pausadas"}
      </span>
    </button>
  </div>

  {!inscripcionesAbiertas && (
    <div className="bg-[#1f1f27] border border-red-500/30 rounded-2xl p-5 space-y-3">
      <label className="block text-sm font-semibold text-red-400">
        Mensaje visible al usuario
      </label>

      <input
        type="text"
        value={inscripcionesMensaje}
        onChange={(e) => setInscripcionesMensaje(e.target.value)}
        placeholder="Ej. Inscripciones pausadas por cupo lleno."
        className="w-full bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
      />

      <p className="text-xs text-white/50">
        Este mensaje se mostrará en la página de inscripción.
      </p>
    </div>
  )}
</div>

    {/* ================= RESULTADOS ================= */}
    {carreraFinalizada && (
      <div className="border border-dh-border rounded-2xl p-6 bg-dh-soft space-y-4">
        <p className="font-bold text-dh-ink">🏁 Resultados oficiales</p>

        <input
          type="url"
          value={resultadosUrl}
          onChange={(e) => setResultadosUrl(e.target.value)}
          placeholder="https://..."
          className="w-full border border-dh-border rounded-xl px-3 py-2"
        />

        <label className="flex items-center gap-2 text-sm">
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
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <label className="block font-semibold text-dh-ink mb-2">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          className="w-full border border-dh-border rounded-xl px-3 py-2"
        />
      </div>

      <div>
        <label className="block font-semibold text-dh-ink mb-2">Lugar</label>
        <input
          type="text"
          value={lugar}
          onChange={(e) => setLugar(e.target.value)}
          required
          className="w-full border border-dh-border rounded-xl px-3 py-2"
        />
      </div>

      <div>
        <label className="block font-semibold text-dh-ink mb-2">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
          className="w-full border border-dh-border rounded-xl px-3 py-2"
        />
      </div>

      <div>
        <label className="block font-semibold text-dh-ink mb-2">Hora salida</label>
        <input
          type="time"
          value={horaSalida}
          onChange={(e) => setHoraSalida(e.target.value)}
          required
          className="w-full border border-dh-border rounded-xl px-3 py-2"
        />
      </div>
    </div>

    <div>
      <label className="block font-semibold text-dh-ink mb-2">Descripción</label>
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        required
        className="w-full border border-dh-border rounded-xl px-3 py-2"
      />
    </div>

    {/* ================= DISTANCIAS ================= */}
    <div className="rounded-3xl bg-[#16161d] border border-dh-purple/20 p-8 space-y-6">
  <h3 className="text-xl font-extrabold text-dh-purple tracking-wide">
    Distancias
  </h3>

  <div className="flex gap-3">
    <input
      type="text"
      value={nuevaDistancia}
      onChange={(e) => setNuevaDistancia(e.target.value)}
      placeholder="Ej. 5K, 10K, 300m"
      className="flex-1 bg-[#1f1f27] border border-white/10 rounded-xl px-4 py-3 text-white"
    />

    <button
      type="button"
      onClick={handleAddDistancia}
      className="px-6 py-3 rounded-xl bg-dh-green text-black font-bold hover:scale-105 transition"
    >
      Agregar
    </button>
  </div>

  <div className="space-y-5">
    {distancias.map((d, dIndex) => (
      <div
        key={d.distancia}
        className="bg-[#1b1b22] border border-white/10 rounded-2xl p-5 space-y-3"
      >
        <h4 className="font-bold text-white">
          {normalizeDist(d.distancia)}
        </h4>

        <ul className="space-y-2">
          {d.categorias.map((c, cIndex) => (
            <li
              key={cIndex}
              className="flex justify-between items-center bg-[#141418] px-4 py-3 rounded-xl"
            >
              <span className="text-white/80">
                {c.nombre} ({c.minAge}-{c.maxAge}) — $
                {Number(c.price).toFixed(2)}
              </span>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => handleEditCategoria(dIndex, cIndex)}
                  className="text-dh-purple hover:scale-110 transition"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteCategoria(dIndex, cIndex)}
                  className="text-red-500 hover:scale-110 transition"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
</div>

    {/* ================= AGREGAR / EDITAR CATEGORÍA ================= */}
    <div className="rounded-3xl bg-[#16161d] border border-dh-purple/20 p-8 space-y-6">
  <h4 className="text-lg font-extrabold text-dh-green">
    Agregar / Editar Categoría
  </h4>

  <select
    value={distanciaSeleccionada}
    onChange={(e) =>
      setDistanciaSeleccionada(normalizeDist(e.target.value))
    }
    className="w-full bg-[#1f1f27] border border-white/10 rounded-xl px-4 py-3 text-white"
  >
    <option value="">Selecciona una distancia</option>
    {distancias.map((d) => (
      <option key={d.distancia} value={d.distancia}>
        {normalizeDist(d.distancia)}
      </option>
    ))}
  </select>

  <div className="grid md:grid-cols-4 gap-4">
    <input
      type="text"
      placeholder="Nombre"
      value={nuevaCat.nombre}
      onChange={(e) =>
        setNuevaCat((s) => ({ ...s, nombre: e.target.value }))
      }
      className="bg-[#1f1f27] border border-white/10 rounded-xl px-4 py-3 text-white"
    />

    <input
      type="number"
      placeholder="Edad min"
      value={nuevaCat.minAge}
      onChange={(e) =>
        setNuevaCat((s) => ({ ...s, minAge: +e.target.value }))
      }
      className="bg-[#1f1f27] border border-white/10 rounded-xl px-4 py-3 text-white"
    />

    <input
      type="number"
      placeholder="Edad max"
      value={nuevaCat.maxAge}
      onChange={(e) =>
        setNuevaCat((s) => ({ ...s, maxAge: +e.target.value }))
      }
      className="bg-[#1f1f27] border border-white/10 rounded-xl px-4 py-3 text-white"
    />

    <div className="flex items-center bg-[#1f1f27] border border-white/10 rounded-xl px-4">
      <CurrencyDollarIcon className="w-5 h-5 text-white/50 mr-2" />
      <input
        type="number"
        placeholder="Precio"
        value={nuevaCat.price}
        onChange={(e) =>
          setNuevaCat((s) => ({ ...s, price: +e.target.value }))
        }
        className="flex-1 py-3 bg-transparent text-white outline-none"
      />
    </div>
  </div>

  <button
    type="button"
    onClick={handleAddOrSaveCategoria}
    className="w-full py-4 rounded-2xl bg-dh-purple text-white font-extrabold hover:opacity-90 transition"
  >
    {editCatIndex !== null
      ? "Guardar Categoría"
      : "Agregar Categoría"}
  </button>
</div>

    {/* ================= ENTREGA DE KITS ================= */}
    <div className="rounded-3xl bg-[#16161d] border border-dh-purple/20 p-8 space-y-5">
  <h3 className="text-lg font-extrabold text-white">
    Entrega de Kits
  </h3>

  <input
    type="date"
    value={kitFecha}
    onChange={(e) => setKitFecha(e.target.value)}
    className="w-full bg-[#1f1f27] border border-white/10 rounded-xl px-4 py-3 text-white"
  />

  <input
    type="text"
    value={kitLugar}
    onChange={(e) => setKitLugar(e.target.value)}
    placeholder="Lugar de entrega"
    className="w-full bg-[#1f1f27] border border-white/10 rounded-xl px-4 py-3 text-white"
  />

  <input
    type="text"
    value={kitHorario}
    onChange={(e) => setKitHorario(e.target.value)}
    placeholder="Horario de entrega"
    className="w-full bg-[#1f1f27] border border-white/10 rounded-xl px-4 py-3 text-white"
  />
</div>

    {/* ================= GUARDAR ================= */}
    <button
      type="submit"
      className="w-full py-4 rounded-2xl bg-dh-green text-dh-dark font-extrabold text-lg"
    >
      Guardar Carrera
    </button>
  </form>
);
}
