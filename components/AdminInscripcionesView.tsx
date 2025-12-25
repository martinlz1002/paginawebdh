import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
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
} from "@heroicons/react/24/outline";

interface CarreraItem extends CarreraData {
  id: string;
}

interface PerfilData {
  // snapshot NUEVO (ya viene en inscripciones)
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

  // snapshot
  perfil: PerfilData;

  categoria: string;
  ruta?: string;
  rama?: string;

  timestamp: Date;
  sessionId?: string | null;
  payment_status?: string;

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
  return isNaN(d.getTime()) ? null : d;
}

function computeAge(birthDate: Date, basisDate: Date): number {
  let age = basisDate.getFullYear() - birthDate.getFullYear();
  const m = basisDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && basisDate.getDate() < birthDate.getDate())) age--;
  return age;
}

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraItem[]>([]);
  const [selectedCarrera, setSelectedCarrera] = useState("");
  const [inscripciones, setInscripciones] = useState<InscripcionItem[]>([]);
  const [loading, setLoading] = useState(false);

  // edición modal
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InscripcionItem | null>(null);

  // form editable (solo snapshot + categoria/ruta/rama + contacto/lugar)
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

    fechaNacimiento: "", // yyyy-mm-dd
  });

  const selectedCarreraInfo = useMemo(
    () => carreras.find((c) => c.id === selectedCarrera) || null,
    [carreras, selectedCarrera]
  );

  // Cargo la lista de carreras
  useEffect(() => {
    getDocs(collection(db, "carreras")).then((snap) => {
      setCarreras(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CarreraData) })));
    });
  }, []);

  // Cuando cambia la carrera, cargo inscripciones
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([]);
      return;
    }
    setLoading(true);

    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "inscripciones"), where("carreraId", "==", selectedCarrera))
        );

        const carreraInfo = carreras.find((c) => c.id === selectedCarrera);

        const items: InscripcionItem[] = await Promise.all(
          snap.docs.map(async (d) => {
            const raw = d.data() as RawData;

            // timestamp
            let ts = new Date();
            if (raw.timestamp instanceof Timestamp) ts = raw.timestamp.toDate();
            else if (raw.timestamp?.toDate) ts = raw.timestamp.toDate();
            else if (typeof raw.timestamp === "string") ts = new Date(raw.timestamp);

            // número
            const num =
              typeof raw.competitorNumber === "number"
                ? raw.competitorNumber
                : Number(raw.competitorNumber) || 0;

            // snapshot NUEVO (prioridad)
            const nombre = raw.nombre ?? raw.perfilNombre ?? "";
            const paterno = raw.paterno ?? raw.perfilApPaterno ?? "";
            const materno = raw.materno ?? raw.perfilApMaterno ?? "";
            const nombres = raw.nombres ?? fullName(nombre, paterno, materno);

            const fechaNacimiento = safeDateFromAny(raw.fechaNacimiento ?? raw.birthDate);
            let edad: number | undefined = undefined;

            if (fechaNacimiento && carreraInfo?.fecha) {
              const raceFecha = new Date(carreraInfo.fecha);
              const basis =
                carreraInfo.ageBasis === "eventDate"
                  ? raceFecha
                  : new Date(raceFecha.getFullYear(), 11, 31);
              edad = computeAge(fechaNacimiento, basis);
            }

            // payment_status (si no existe, intenta API get-session)
            let payment_status: string | undefined = raw.paymentStatus;
            if (!payment_status && raw.sessionId) {
              try {
                const res = await fetch(`/api/get-session?session_id=${raw.sessionId}`);
                if (res.ok) {
                  const js = await res.json();
                  payment_status = js.payment_status;
                }
              } catch {
                /* ignore */
              }
            }

            const perfil: PerfilData = {
              nombre,
              paterno,
              materno,
              nombres,

              rama: raw.rama ?? "",
              ruta: raw.ruta ?? raw.distancia ?? "",

              email: raw.email ?? "",
              celular: raw.celular ?? "",

              pais: raw.pais ?? "",
              estado: raw.estado ?? "",
              ciudad: raw.ciudad ?? "",
              club: raw.club ?? "",

              fechaNacimiento: fechaNacimiento,
              edad,
            };

            return {
              id: d.id,
              perfil,
              categoria: raw.categoria || "",
              ruta: raw.ruta ?? raw.distancia ?? "",
              rama: raw.rama ?? "",
              timestamp: ts,
              sessionId: raw.sessionId ?? null,
              payment_status,
              competitorNumber: num,
              ficha:
                typeof raw.ficha === "number" ? raw.ficha : raw.ficha ? Number(raw.ficha) : null,
              bib: typeof raw.bib === "number" ? raw.bib : raw.bib ? Number(raw.bib) : null,
            };
          })
        );

        items.sort((a, b) => a.competitorNumber - b.competitorNumber);
        setInscripciones(items);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedCarrera, carreras]);

  // abrir modal edición
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

  // guardar edición (updateDoc sobre inscripciones/{id})
  const saveEdit = async () => {
    if (!editing) return;
    setEditError(null);

    // validaciones mínimas
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

      // ⚠️ OJO: esto NO cambia el estado de pago. Solo edita snapshot/campos Excel.
      await updateDoc(ref, {
        competitorNumber: cn,
        ficha: ficha,
        bib: bib,

        nombre: form.nombre.trim(),
        paterno: form.paterno.trim(),
        materno: form.materno.trim(),
        nombres: nombres,

        rama: form.rama.trim(),
        ruta: form.ruta.trim(),
        // (si también guardas "distancia" en algunos lados, lo alineamos)
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

      // refrescar UI local (sin recargar)
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

          // recalcula edad si aplica
          if (selectedCarreraInfo?.fecha) {
            const raceFecha = new Date(selectedCarreraInfo.fecha);
            const basis =
              selectedCarreraInfo.ageBasis === "eventDate"
                ? raceFecha
                : new Date(raceFecha.getFullYear(), 11, 31);
            const bd = new Date(form.fechaNacimiento);
            updated.perfil.edad = computeAge(bd, basis);
          }

          return updated;
        });

        next.sort((a, b) => a.competitorNumber - b.competitorNumber);
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

  // export Excel (nuevo schema)
  const exportExcel = () => {
    const rows = inscripciones.map((i) => ({
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
      FechaNacimiento: i.perfil.fechaNacimiento
        ? i.perfil.fechaNacimiento.toLocaleDateString("es-MX")
        : "",
      Email: i.perfil.email ?? "",
      PaymentStatus: i.payment_status ?? "desconocido",
      Evento: selectedCarreraInfo?.titulo ?? "",
      Registrado: i.timestamp.toLocaleString(),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inscripciones");
    XLSX.writeFile(wb, `inscripciones_${selectedCarrera}.xlsx`);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4 gap-3">
        <h2 className="text-xl font-semibold">Ver Inscripciones</h2>

        <button
          onClick={exportExcel}
          disabled={!inscripciones.length}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <ArrowDownTrayIcon className="w-5 h-5" />
          <span>Exportar Excel</span>
        </button>
      </div>

      <select
        value={selectedCarrera}
        onChange={(e) => setSelectedCarrera(e.target.value)}
        className="w-full border p-2 rounded mb-6"
      >
        <option value="">-- Elige una carrera --</option>
        {carreras.map((c) => (
          <option key={c.id} value={c.id}>
            {c.titulo}
          </option>
        ))}
      </select>

      {loading ? (
        <p>Cargando inscripciones…</p>
      ) : inscripciones.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse rounded-lg shadow">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-gray-800 p-2 text-left">#</th>
                <th className="text-gray-800 p-2 text-left">Nombres</th>
                <th className="text-gray-800 p-2 text-left">Rama</th>
                <th className="text-gray-800 p-2 text-left">Ruta</th>
                <th className="text-gray-800 p-2 text-left">Categoría</th>
                <th className="text-gray-800 p-2 text-left">Edad</th>
                <th className="text-gray-800 p-2 text-left">Celular</th>
                <th className="text-gray-800 p-2 text-left">Pago</th>
                <th className="text-gray-800 p-2 text-left">Registrado</th>
                <th className="text-gray-800 p-2 text-left">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {inscripciones.map((i) => (
                <tr
                  key={i.id}
                  className="bg-blue-900 text-white hover:bg-blue-800 transition-colors"
                >
                  <td className="p-2">{i.competitorNumber}</td>
                  <td className="p-2">
                    {i.perfil.nombres ||
                      fullName(i.perfil.nombre, i.perfil.paterno, i.perfil.materno)}
                  </td>
                  <td className="p-2">{i.rama ?? i.perfil.rama ?? "-"}</td>
                  <td className="p-2">{i.ruta ?? i.perfil.ruta ?? "-"}</td>
                  <td className="p-2">{i.categoria}</td>
                  <td className="p-2">{i.perfil.edad ?? "-"}</td>
                  <td className="p-2">{i.perfil.celular ?? "-"}</td>
                  <td className="p-2">{i.payment_status ?? "-"}</td>
                  <td className="p-2">{i.timestamp.toLocaleString()}</td>
                  <td className="p-2">
                    <button
                      onClick={() => openEdit(i)}
                      className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
                      title="Editar"
                    >
                      <PencilSquareIcon className="w-5 h-5" />
                      <span className="text-sm">Editar</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedCarrera ? (
        <p className="text-gray-500">No hay inscripciones para esta carrera.</p>
      ) : null}

      {/* Modal editar */}
      {editOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Editar inscripción #{editing.competitorNumber}
              </h3>
              <button
                onClick={closeEdit}
                className="p-2 rounded hover:bg-gray-100"
                title="Cerrar"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {editError && (
              <p className="text-sm text-red-600 mb-3">{editError}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-gray-700">Número</label>
                <input
                  type="number"
                  className="w-full border p-2 rounded"
                  value={form.competitorNumber}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      competitorNumber: Number(e.target.value || 0),
                      ficha: Number(e.target.value || 0),
                      bib: Number(e.target.value || 0),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Ficha</label>
                <input
                  type="number"
                  className="w-full border p-2 rounded"
                  value={form.ficha}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ficha: Number(e.target.value || 0) }))
                  }
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Bib</label>
                <input
                  type="number"
                  className="w-full border p-2 rounded"
                  value={form.bib}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bib: Number(e.target.value || 0) }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">Nombre</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Paterno</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.paterno}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paterno: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Materno</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.materno}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, materno: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">Rama</label>
                <select
                  className="w-full border p-2 rounded"
                  value={form.rama}
                  onChange={(e) => setForm((f) => ({ ...f, rama: e.target.value }))}
                >
                  <option value="">--</option>
                  <option value="Femenil">Femenil</option>
                  <option value="Varonil">Varonil</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-700">Ruta</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.ruta}
                  onChange={(e) => setForm((f) => ({ ...f, ruta: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">Categoría</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.categoria}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoria: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">Fecha nacimiento</label>
                <input
                  type="date"
                  className="w-full border p-2 rounded"
                  value={form.fechaNacimiento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">Email</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">Celular</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.celular}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, celular: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">País</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.pais}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pais: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Estado</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.estado}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, estado: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Ciudad</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.ciudad}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ciudad: e.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-sm text-gray-700">Club</label>
                <input
                  className="w-full border p-2 rounded"
                  value={form.club}
                  onChange={(e) => setForm((f) => ({ ...f, club: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={closeEdit}
                disabled={saving}
                className="px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving ? (
                  "Guardando…"
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Tip: esto edita solo el registro en <code>inscripciones</code>. Si quieres
              que también se refleje en el perfil del usuario, eso sería otra acción aparte.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}