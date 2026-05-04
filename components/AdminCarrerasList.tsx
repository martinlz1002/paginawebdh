import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CarreraData } from "@/types/carrera";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

export interface CarreraItem extends CarreraData {
  id: string;

  // ✅ nuevos campos para pausar inscripciones
  inscripcionesAbiertas?: boolean;
  inscripcionesMensaje?: string;
}

interface Props {
  onEdit: (c: CarreraItem) => void;
}

// ✅ convierte cualquier cosa a Date (string YYYY-MM-DD / Timestamp / Date)
function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "string") {
    // soporta YYYY-MM-DD
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const dt = new Date(y, mo, d);
      return Number.isFinite(dt.getTime()) ? dt : null;
    }
    const dt = new Date(v);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  return null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// ✅ Formatea a DD/MM/YYYY sin romperse
function formatDateSafe(v: any): string {
  const dt = toDateAny(v);
  if (!dt) return "—";
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

export default function AdminCarrerasList({ onEdit }: Props) {
  const [list, setList] = useState<CarreraItem[]>([]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "carreras"));

      setList(
        snap.docs.map((d) => {
          const data = d.data() as any;

          // ✅ Normaliza distancias por si hay docs viejos
          const distancias = Array.isArray(data.distancias) ? data.distancias : [];

          return {
            id: d.id,
            ...(data as CarreraData),
            distancias,

            // ✅ defaults seguros
            inscripcionesAbiertas: data.inscripcionesAbiertas !== false,
            inscripcionesMensaje: data.inscripcionesMensaje || "",
          } as CarreraItem;
        })
      );
    })();
  }, []);

  // ✅ opcional: ordenar por fecha (más nuevas arriba)
  const sorted = useMemo(() => {
    const copy = [...list];
    copy.sort((a, b) => {
      const da = toDateAny((a as any).fecha)?.getTime?.() ?? 0;
      const dbb = toDateAny((b as any).fecha)?.getTime?.() ?? 0;
      return dbb - da;
    });
    return copy;
  }, [list]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta carrera?")) return;
    await deleteDoc(doc(db, "carreras", id));
    setList((prev) => prev.filter((c) => c.id !== id));
  };

  return (
  <div className="space-y-6">
    {sorted.map((c) => {
      const abiertas = c.inscripcionesAbiertas !== false;
      const distList = Array.isArray(c.distancias) ? c.distancias : [];

      return (
        <div
          key={c.id}
          className="bg-dh-panel border border-dh-border rounded-2xl p-6 shadow-dhSm hover:shadow-dh transition"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

            {/* INFO */}
            <div className="space-y-2">

              <h3 className="text-xl font-extrabold text-dh-ink">
                {c.titulo}
              </h3>

              <p className="text-sm text-dh-muted">
                Fecha:{" "}
                <time className="font-semibold text-dh-ink">
                  {formatDateSafe((c as any).fecha)}
                </time>
              </p>

              {/* Badge estado */}
              <div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold border ${
                    abiertas
                      ? "bg-dh-purple/10 text-dh-purple border-dh-purple/20"
                      : "bg-red-50 text-red-600 border-red-200"
                  }`}
                >
                  {abiertas
                    ? "Inscripciones abiertas"
                    : "Inscripciones pausadas"}
                </span>
              </div>

              {/* Distancias */}
              {distList.length > 0 && (
                <p className="text-sm text-dh-muted">
                  <span className="font-semibold text-dh-ink">
                    Distancias:
                  </span>{" "}
                  {distList
                    .map((d: any) => d.distancia)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}

              {/* Kit */}
              {(c.kitFecha || c.kitLugar || c.kitHorario) && (
                <p className="text-sm text-dh-muted">
                  <span className="font-semibold text-dh-ink">Kit:</span>{" "}
                  {c.kitFecha || "Fecha indefinida"} –{" "}
                  {c.kitLugar || "Lugar indefinido"} –{" "}
                  {c.kitHorario || "Horario indefinido"}
                </p>
              )}

              {/* Mensaje pausa */}
              {!abiertas && (
                <p className="text-xs text-red-600 mt-2">
                  {(c.inscripcionesMensaje || "").trim() ||
                    "Inscripciones pausadas temporalmente."}
                </p>
              )}
            </div>

            {/* ACCIONES */}
            <div className="flex items-center gap-3">

              <button
                onClick={() => onEdit(c)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-dh-purple/10 text-dh-purple hover:bg-dh-purple hover:text-white transition"
                title="Editar"
              >
                <PencilIcon className="w-5 h-5" />
              </button>

              <button
                onClick={() => handleDelete(c.id)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition"
                title="Eliminar"
              >
                <TrashIcon className="w-5 h-5" />
              </button>

            </div>
          </div>
        </div>
      );
    })}

    {sorted.length === 0 && (
      <div className="text-center py-16 text-dh-muted">
        <p className="text-lg font-semibold">
          No hay carreras creadas.
        </p>
        <p className="text-sm mt-1">
          Crea tu primera carrera para comenzar.
        </p>
      </div>
    )}
  </div>
);
}
