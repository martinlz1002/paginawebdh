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
    <div className="space-y-4">
      {sorted.map((c) => {
        const abiertas = c.inscripcionesAbiertas !== false;
        const distList = Array.isArray(c.distancias) ? c.distancias : [];

        return (
          <div
            key={c.id}
            className="flex items-center justify-between bg-white p-4 rounded-lg shadow hover:shadow-lg transition"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{c.titulo}</h3>

              <p className="text-sm text-gray-500">
                Fecha: <time>{formatDateSafe((c as any).fecha)}</time>
              </p>

              {/* ✅ badge de estado */}
              <p className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    abiertas ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
                  }`}
                >
                  {abiertas ? "Inscripciones abiertas" : "Inscripciones pausadas"}
                </span>
              </p>

              {/* ✅ no truena aunque no haya distancias */}
              {distList.length > 0 && (
                <p className="text-sm text-gray-500">
                  Distancias: {distList.map((d: any) => d.distancia).filter(Boolean).join(", ")}
                </p>
              )}

              {(c.kitFecha || c.kitLugar || c.kitHorario) && (
                <p className="text-sm text-gray-500">
                  Kit: {c.kitFecha || "Fecha indefinida"} – {c.kitLugar || "Lugar indefinido"} –{" "}
                  {c.kitHorario || "Horario indefinido"}
                </p>
              )}

              {/* ✅ mensaje si está pausada */}
              {!abiertas && (
                <p className="text-xs text-red-600 mt-1">
                  {(c.inscripcionesMensaje || "").trim() || "Inscripciones pausadas temporalmente."}
                </p>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => onEdit(c)}
                className="p-2 bg-purple-600 text-dh-ink rounded-full hover:bg-purple-700 transition"
                title="Editar"
              >
                <PencilIcon className="w-5 h-5" />
              </button>

              <button
                onClick={() => handleDelete(c.id)}
                className="p-2 bg-red-600 text-dh-ink rounded-full hover:bg-red-700 transition"
                title="Eliminar"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        );
      })}

      {sorted.length === 0 && (
        <p className="text-center text-gray-500">No hay carreras creadas.</p>
      )}
    </div>
  );
}
