import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CarreraData } from "@/types/carrera";
import * as XLSX from "xlsx";
import {
  ArrowDownTrayIcon,
  PencilSquareIcon,
  XMarkIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  ArrowsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

interface CarreraItem extends CarreraData {
  id: string;
}

interface PerfilData {
  nombre?: string;
  paterno?: string;
  materno?: string;
  nombres?: string;

  rama?: string;
  ruta?: string;

  celular?: string;
  email?: string;

  pais?: string;
  estado?: string;
  ciudad?: string;
  club?: string;

  fechaNacimiento?: Date | null;
  edad?: number;
}

interface InscripcionItem {
  id: string;
  perfil: PerfilData;

  categoria: string;
  ruta?: string;
  rama?: string;

  timestamp: Date;
  sessionId?: string | null;
  paymentStatus?: string;

  competitorNumber: number;
  ficha?: number | null;
  bib?: number | null;
}

type RawData = Record<string, any>;

function fullName(nombre?: string, paterno?: string, materno?: string) {
  return `${(nombre || "").trim()} ${(paterno || "").trim()} ${(materno || "").trim()}`
    .replace(/\s+/g, " ")
    .trim();
}

function safeDateFromAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function computeAge(birthDate: Date, basisDate: Date): number {
  let age = basisDate.getFullYear() - birthDate.getFullYear();
  const m = basisDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && basisDate.getDate() < birthDate.getDate())) age--;
  return age;
}

function pickNumber(raw: any): number {
  const n =
    (typeof raw.competitorNumber === "number" && raw.competitorNumber > 0 && raw.competitorNumber) ||
    (typeof raw.ficha === "number" && raw.ficha > 0 && raw.ficha) ||
    (typeof raw.bib === "number" && raw.bib > 0 && raw.bib) ||
    (Number(raw.competitorNumber) > 0 ? Number(raw.competitorNumber) : 0) ||
    (Number(raw.ficha) > 0 ? Number(raw.ficha) : 0) ||
    (Number(raw.bib) > 0 ? Number(raw.bib) : 0) ||
    0;

  return Number.isFinite(n) ? n : 0;
}

// UI tokens DH
const pageWrap = "min-h-screen bg-dh-soft";
const cardBase = "bg-white rounded-2xl border border-dh-purple/10 shadow-dh";
const labelBase = "block text-sm font-semibold text-dh-ink mb-2";
const selectBase =
  "w-full rounded-xl border border-dh-purple/15 bg-white px-3 py-2.5 text-dh-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-green/40";
const inputBase =
  "w-full rounded-xl border border-dh-purple/15 bg-white px-3 py-2.5 text-dh-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-green/40";
const btnBase =
  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed";

function statusLabel(s?: string) {
  if (s === "paid") return "Pagado";
  if (s === "pending") return "Pendiente";
  if (s === "manual") return "Manual";
  if (s === "expired") return "Expirado";
  if (s === "unpaid") return "No pagado";
  if (s === "failed") return "Fallido";
  return s || "Desconocido";
}

function statusPillClass(s?: string) {
  if (s === "paid") return "bg-dh-green/15 text-dh-ink border-dh-green/30";
  if (s === "pending") return "bg-yellow-50 text-yellow-900 border-yellow-200";
  if (s === "manual") return "bg-blue-50 text-blue-900 border-blue-200";
  if (s === "expired") return "bg-orange-50 text-orange-900 border-orange-200";
  if (s === "unpaid" || s === "failed") return "bg-red-50 text-red-900 border-red-200";
  return "bg-gray-50 text-gray-800 border-gray-200";
}

type SortKey =
  | "competitorNumber"
  | "nombres"
  | "rama"
  | "ruta"
  | "categoria"
  | "edad"
  | "celular"
  | "paymentStatus"
  | "timestamp";

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraItem[]>([]);
  const [selectedCarrera, setSelectedCarrera] = useState("");
  const [inscripciones, setInscripciones] = useState<InscripcionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<
    "all" | "paid" | "pending" | "manual" | "expired" | "unpaid" | "failed"
  >("all");

  // ✅ Buscador
  const [search, setSearch] = useState("");

  // ✅ Ordenador
  const [sortKey, setSortKey] = useState<SortKey>("competitorNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InscripcionItem | null>(null);

  const [form, setForm] = useState({
    competitorNumber: 0,
    ficha: 0,
    bib: 0,

    nombre: "",
    paterno: "",
    materno: "",
    nombres: "",

    rama: "",
    ruta: "",
    categoria: "",

    email: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",

    fechaNacimiento: "",
  });

  const selectedCarreraInfo = useMemo(
    () => carreras.find((c) => c.id === selectedCarrera) || null,
    [carreras, selectedCarrera]
  );

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "carreras"));
      setCarreras(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CarreraData) })));
    })();
  }, []);

  // 🔁 Cargar inscripciones por carrera + filtro
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([]);
      return;
    }

    setLoading(true);

    (async () => {
      try {
        const baseQ = query(
          collection(db, "inscripciones"),
          where("carreraId", "==", selectedCarrera)
        );

        const qy =
          statusFilter === "all"
            ? baseQ
            : query(
                collection(db, "inscripciones"),
                where("carreraId", "==", selectedCarrera),
                where("paymentStatus", "==", statusFilter)
              );

        const snap = await getDocs(qy);

        const carreraInfo = carreras.find((c) => c.id === selectedCarrera);

        const raceFecha = safeDateFromAny((carreraInfo as any)?.fecha);
        const basis =
          raceFecha && carreraInfo
            ? carreraInfo.ageBasis === "eventDate"
              ? raceFecha
              : new Date(raceFecha.getFullYear(), 11, 31)
            : null;

        const items: InscripcionItem[] = snap.docs.map((d) => {
          const raw = d.data() as RawData;

          const ts = safeDateFromAny(raw.timestamp) || new Date();
          const num = pickNumber(raw);

          const nombre = raw.nombre ?? raw.perfilNombre ?? "";
          const paterno = raw.paterno ?? raw.perfilApPaterno ?? "";
          const materno = raw.materno ?? raw.perfilApMaterno ?? "";
          const nombres =
            (raw.nombres && String(raw.nombres).trim()) || fullName(nombre, paterno, materno);

          const fechaNacimiento = safeDateFromAny(raw.fechaNacimiento ?? raw.birthDate);
          const edad = fechaNacimiento && basis ? computeAge(fechaNacimiento, basis) : undefined;

          const paymentStatus = (raw.paymentStatus || raw.payment_status || "desconocido").toString();
          const ruta = (raw.ruta ?? raw.distancia ?? "").toString();

          const perfil: PerfilData = {
            nombre,
            paterno,
            materno,
            nombres,
            rama: raw.rama ?? "",
            ruta,
            email: raw.email ?? "",
            celular: raw.celular ?? "",
            pais: raw.pais ?? "",
            estado: raw.estado ?? "",
            ciudad: raw.ciudad ?? "",
            club: raw.club ?? "",
            fechaNacimiento,
            edad,
          };

          return {
            id: d.id,
            perfil,
            categoria: raw.categoria || "",
            ruta,
            rama: raw.rama ?? "",
            timestamp: ts,
            sessionId: raw.sessionId ?? null,
            paymentStatus,
            competitorNumber: num,
            ficha: Number.isFinite(Number(raw.ficha)) ? Number(raw.ficha) : null,
            bib: Number.isFinite(Number(raw.bib)) ? Number(raw.bib) : null,
          };
        });

        // default: orden por número
        items.sort((a, b) => {
          const na = a.competitorNumber > 0 ? a.competitorNumber : 9_999_999;
          const nb = b.competitorNumber > 0 ? b.competitorNumber : 9_999_999;
          return na - nb;
        });

        setInscripciones(items);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedCarrera, carreras, statusFilter]);

  // ✅ helper: valores para ordenar
  const sortValue = (i: InscripcionItem, key: SortKey): string | number => {
    const nombres =
      (i.perfil.nombres || fullName(i.perfil.nombre, i.perfil.paterno, i.perfil.materno) || "").toString();

    switch (key) {
      case "competitorNumber":
        return i.competitorNumber > 0 ? i.competitorNumber : 9_999_999;
      case "nombres":
        return nombres.toLowerCase();
      case "rama":
        return (i.rama ?? i.perfil.rama ?? "").toLowerCase();
      case "ruta":
        return (i.ruta ?? i.perfil.ruta ?? "").toLowerCase();
      case "categoria":
        return (i.categoria ?? "").toLowerCase();
      case "edad":
        return typeof i.perfil.edad === "number" ? i.perfil.edad : 9_999_999;
      case "celular":
        return (i.perfil.celular ?? "").toLowerCase();
      case "paymentStatus":
        return (i.paymentStatus ?? "").toLowerCase();
      case "timestamp":
        return i.timestamp?.getTime?.() ? i.timestamp.getTime() : 0;
      default:
        return "";
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowsUpDownIcon className="w-4 h-4 opacity-50" />;
    return sortDir === "asc" ? (
      <ChevronUpIcon className="w-4 h-4" />
    ) : (
      <ChevronDownIcon className="w-4 h-4" />
    );
  };

  // ✅ Lista final: filtro búsqueda + orden
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = !q
      ? inscripciones
      : inscripciones.filter((i) => {
          const nombres =
            i.perfil.nombres ||
            fullName(i.perfil.nombre, i.perfil.paterno, i.perfil.materno);

          const blob = [
            i.competitorNumber,
            i.ficha ?? "",
            i.bib ?? "",
            nombres ?? "",
            i.perfil.email ?? "",
            i.perfil.celular ?? "",
            i.perfil.club ?? "",
            i.ruta ?? i.perfil.ruta ?? "",
            i.categoria ?? "",
            i.rama ?? i.perfil.rama ?? "",
            i.paymentStatus ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return blob.includes(q);
        });

    const sorted = [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);

      // number vs string
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs, "es") : bs.localeCompare(as, "es");
    });

    return sorted;
  }, [inscripciones, search, sortKey, sortDir]);

  const openEdit = (it: InscripcionItem) => {
    setEditError(null);
    setEditing(it);

    const bd = it.perfil.fechaNacimiento;
    const yyyyMmDd =
      bd instanceof Date
        ? `${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, "0")}-${String(
            bd.getDate()
          ).padStart(2, "0")}`
        : "";

    const nombre = it.perfil.nombre || "";
    const paterno = it.perfil.paterno || "";
    const materno = it.perfil.materno || "";

    setForm({
      competitorNumber: it.competitorNumber || 0,
      ficha: (it.ficha ?? it.competitorNumber) || 0,
      bib: (it.bib ?? it.competitorNumber) || 0,

      nombre,
      paterno,
      materno,
      nombres: it.perfil.nombres || fullName(nombre, paterno, materno),

      rama: it.rama || it.perfil.rama || "",
      ruta: it.ruta || it.perfil.ruta || "",
      categoria: it.categoria || "",

      email: it.perfil.email || "",
      celular: it.perfil.celular || "",
      pais: it.perfil.pais || "",
      estado: it.perfil.estado || "",
      ciudad: it.perfil.ciudad || "",
      club: it.perfil.club || "",

      fechaNacimiento: yyyyMmDd,
    });

    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditError(null);

    if (!form.nombre.trim() || !form.paterno.trim() || !form.materno.trim()) {
      setEditError("Nombre/Paterno/Materno son obligatorios.");
      return;
    }
    if (!form.rama.trim()) {
      setEditError("Rama es obligatoria.");
      return;
    }
    if (!form.ruta.trim()) {
      setEditError("Ruta es obligatoria.");
      return;
    }
    if (!form.categoria.trim()) {
      setEditError("Categoría es obligatoria.");
      return;
    }
    if (!form.email.trim()) {
      setEditError("Email es obligatorio.");
      return;
    }
    if (!form.celular.trim()) {
      setEditError("Celular es obligatorio.");
      return;
    }
    if (!form.ciudad.trim() || !form.estado.trim() || !form.pais.trim()) {
      setEditError("Ciudad/Estado/País son obligatorios.");
      return;
    }
    if (!form.fechaNacimiento) {
      setEditError("Fecha de nacimiento es obligatoria.");
      return;
    }

    const cn = Number(form.competitorNumber || 0);
    if (!Number.isFinite(cn) || cn <= 0) {
      setEditError("CompetitorNumber inválido.");
      return;
    }

    const ficha = Number(form.ficha || cn);
    const bib = Number(form.bib || cn);
    const nombres = fullName(form.nombre, form.paterno, form.materno);

    setSaving(true);
    try {
      const ref = doc(db, "inscripciones", editing.id);

      await updateDoc(ref, {
        competitorNumber: cn,
        ficha,
        bib,

        nombre: form.nombre.trim(),
        paterno: form.paterno.trim(),
        materno: form.materno.trim(),
        nombres,

        rama: form.rama.trim(),
        ruta: form.ruta.trim(),
        distancia: form.ruta.trim(),

        categoria: form.categoria.trim(),

        email: form.email.trim(),
        celular: form.celular.trim(),
        pais: form.pais.trim(),
        estado: form.estado.trim(),
        ciudad: form.ciudad.trim(),
        club: form.club.trim() || null,

        fechaNacimiento: Timestamp.fromDate(new Date(form.fechaNacimiento)),
      });

      setInscripciones((prev) => {
        const next = prev.map((x) => {
          if (x.id !== editing.id) return x;

          const updated: InscripcionItem = {
            ...x,
            competitorNumber: cn,
            ficha,
            bib,
            categoria: form.categoria.trim(),
            ruta: form.ruta.trim(),
            rama: form.rama.trim(),
            perfil: {
              ...x.perfil,
              nombre: form.nombre.trim(),
              paterno: form.paterno.trim(),
              materno: form.materno.trim(),
              nombres,
              rama: form.rama.trim(),
              ruta: form.ruta.trim(),
              email: form.email.trim(),
              celular: form.celular.trim(),
              pais: form.pais.trim(),
              estado: form.estado.trim(),
              ciudad: form.ciudad.trim(),
              club: form.club.trim(),
              fechaNacimiento: new Date(form.fechaNacimiento),
            },
          };

          const raceFecha = safeDateFromAny((selectedCarreraInfo as any)?.fecha);
          if (raceFecha && selectedCarreraInfo) {
            const basis =
              selectedCarreraInfo.ageBasis === "eventDate"
                ? raceFecha
                : new Date(raceFecha.getFullYear(), 11, 31);
            updated.perfil.edad = computeAge(new Date(form.fechaNacimiento), basis);
          }

          return updated;
        });

        return next;
      });

      setEditOpen(false);
      setEditing(null);
    } catch (e: any) {
      setEditError(e?.message || "Error guardando cambios");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    const rows = visible.map((i) => ({
      Ficha: i.ficha ?? i.competitorNumber,
      Bib: i.bib ?? i.competitorNumber,
      Nombre: i.perfil.nombre ?? "",
      Paterno: i.perfil.paterno ?? "",
      Materno: i.perfil.materno ?? "",
      Nombres: i.perfil.nombres ?? fullName(i.perfil.nombre, i.perfil.paterno, i.perfil.materno),
      Rama: i.rama ?? i.perfil.rama ?? "",
      Ruta: i.ruta ?? i.perfil.ruta ?? "",
      Categoría: i.categoria ?? "",
      País: i.perfil.pais ?? "",
      Estado: i.perfil.estado ?? "",
      Ciudad: i.perfil.ciudad ?? "",
      Celular: i.perfil.celular ?? "",
      Club: i.perfil.club ?? "",
      FechaNacimiento: i.perfil.fechaNacimiento ? i.perfil.fechaNacimiento.toLocaleDateString("es-MX") : "",
      Email: i.perfil.email ?? "",
      PaymentStatus: i.paymentStatus ?? "desconocido",
      Evento: selectedCarreraInfo?.titulo ?? "",
      Registrado: i.timestamp.toLocaleString("es-MX"),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inscripciones");
    XLSX.writeFile(wb, `inscripciones_${selectedCarrera}.xlsx`);
  };

  const thBtn = (key: SortKey, label: string, className = "") => (
    <button
      onClick={() => toggleSort(key)}
      className={`inline-flex items-center gap-2 hover:text-dh-ink ${className}`}
      title={`Ordenar por ${label}`}
      type="button"
    >
      <span>{label}</span>
      <SortIcon k={key} />
    </button>
  );

  return (
  <div className="min-h-screen bg-[#0c0c0f] text-white py-12 px-6">
    <div className="max-w-7xl mx-auto">

      <div className="bg-[#16161d] border border-white/5 rounded-3xl p-8 space-y-8">

        {/* HEADER */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-black">
              Ver <span className="text-dh-green">Inscripciones</span>
            </h2>
            <p className="text-sm text-white/50 mt-2">
              Busca, ordena, filtra por estado y exporta a Excel.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">

            <select
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [k, d] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
                setSortKey(k);
                setSortDir(d);
              }}
              disabled={!selectedCarrera}
              className="bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
            >
              <option value="competitorNumber:asc"># (asc)</option>
              <option value="competitorNumber:desc"># (desc)</option>
              <option value="nombres:asc">Nombre (A-Z)</option>
              <option value="nombres:desc">Nombre (Z-A)</option>
              <option value="ruta:asc">Ruta (A-Z)</option>
              <option value="ruta:desc">Ruta (Z-A)</option>
              <option value="categoria:asc">Categoría (A-Z)</option>
              <option value="categoria:desc">Categoría (Z-A)</option>
              <option value="paymentStatus:asc">Pago (A-Z)</option>
              <option value="paymentStatus:desc">Pago (Z-A)</option>
              <option value="timestamp:desc">Registrado (nuevo)</option>
              <option value="timestamp:asc">Registrado (viejo)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              disabled={!selectedCarrera}
              className="bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
            >
              <option value="all">Todos</option>
              <option value="paid">Pagado</option>
              <option value="pending">Pendiente</option>
              <option value="manual">Manual</option>
              <option value="expired">Expirado</option>
              <option value="unpaid">No pagado</option>
              <option value="failed">Fallido</option>
            </select>

            <button
              onClick={exportExcel}
              disabled={!visible.length}
              className="inline-flex items-center gap-2 bg-dh-green text-black font-extrabold px-6 py-3 rounded-2xl hover:scale-105 transition disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Exportar Excel
            </button>

          </div>
        </div>

        {/* FILTROS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div>
            <label className="text-sm text-white/60 font-semibold">
              Carrera
            </label>
            <select
              value={selectedCarrera}
              onChange={(e) => {
                setSelectedCarrera(e.target.value);
                setSearch("");
              }}
              className="mt-2 w-full bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
            >
              <option value="">-- Elige una carrera --</option>
              {carreras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/60 font-semibold">
              Buscar
            </label>
            <div className="relative mt-2">
              <MagnifyingGlassIcon className="w-5 h-5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!selectedCarrera}
                placeholder="Número, nombre, email, celular…"
                className="pl-10 w-full bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30"
              />
            </div>

            {selectedCarrera && (
              <div className="mt-3 text-xs text-white/50">
                Mostrando <span className="font-bold text-white">{visible.length}</span> de{" "}
                <span className="font-bold text-white">{inscripciones.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* TABLA */}
        <div>
          {loading ? (
            <div className="text-white/50">Cargando inscripciones…</div>
          ) : visible.length > 0 ? (

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-[#141418] text-white/60 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 text-left">#</th>
                    <th className="p-4 text-left">Nombre</th>
                    <th className="p-4 text-left">Rama</th>
                    <th className="p-4 text-left">Ruta</th>
                    <th className="p-4 text-left">Categoría</th>
                    <th className="p-4 text-left">Edad</th>
                    <th className="p-4 text-left">Celular</th>
                    <th className="p-4 text-left">Pago</th>
                    <th className="p-4 text-left">Registrado</th>
                    <th className="p-4 text-left">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map((i) => (
                    <tr
                      key={i.id}
                      className="border-t border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="p-4 font-extrabold text-dh-purple">
                        {i.competitorNumber || "—"}
                      </td>

                      <td className="p-4">
                        <div className="font-semibold">
                          {i.perfil.nombres ||
                            fullName(i.perfil.nombre, i.perfil.paterno, i.perfil.materno)}
                        </div>
                        <div className="text-xs text-white/40">
                          {i.perfil.email || "—"}
                        </div>
                      </td>

                      <td className="p-4">{i.rama ?? "-"}</td>
                      <td className="p-4">{i.ruta ?? "-"}</td>
                      <td className="p-4">{i.categoria}</td>
                      <td className="p-4">{i.perfil.edad ?? "-"}</td>
                      <td className="p-4">{i.perfil.celular ?? "-"}</td>

                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusPillClass(i.paymentStatus)}`}>
                          {statusLabel(i.paymentStatus)}
                        </span>
                      </td>

                      <td className="p-4 text-sm text-white/50">
                        {i.timestamp.toLocaleString("es-MX")}
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => openEdit(i)}
                          className="bg-dh-purple/20 text-dh-purple px-4 py-2 rounded-xl font-semibold hover:bg-dh-purple/30 transition"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          ) : selectedCarrera ? (
            <div className="text-white/50">
              No hay resultados con ese filtro/búsqueda.
            </div>
          ) : (
            <div className="text-white/50">
              Elige una carrera para ver inscripciones.
            </div>
          )}
        </div>

      </div>
    </div>
  </div>
);
}
