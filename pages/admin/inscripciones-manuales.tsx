import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AuthGuard from "@/components/AuthGuard";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  DocumentReference,
  Timestamp,
  doc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import {
  ChevronLeftIcon,
  TrashIcon,
  LinkIcon,
  KeyIcon,
  UserIcon,
  CalendarIcon,
  HashtagIcon,
} from "@heroicons/react/24/outline";
import type { TempUsuario } from "@/types/tempusuario";
import type { CarreraOption } from "@/components/EliminarInscripciones";

interface TempAccessRecord extends TempUsuario {
  id: string;
  link?: string;
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, ys, ms, ds, hs, mins] = m;
  const y = Number(ys);
  const mo = Number(ms) - 1;
  const d = Number(ds);
  const h = Number(hs);
  const mi = Number(mins);
  const dt = new Date(y, mo, d, h, mi, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

const cardBase = "bg-white rounded-2xl border border-dh-purple/10 shadow-dh";
const inputBase =
  "w-full rounded-xl border border-dh-purple/15 bg-white px-10 py-2.5 text-dh-ink placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-green/40";
const selectBase =
  "w-full rounded-xl border border-dh-purple/15 bg-white px-10 py-2.5 text-dh-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-green/40";
const labelBase = "block text-sm font-semibold text-dh-ink mb-2";

export default function InscripcionesManualesAdmin() {
  const router = useRouter();
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [accesses, setAccesses] = useState<TempAccessRecord[]>([]);
  const [carreraId, setCarreraId] = useState("");
  const [startNumber, setStartNumber] = useState(0);
  const [endNumber, setEndNumber] = useState(0);
  const [expiresAt, setExpiresAt] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const snapC = await getDocs(collection(db, "carreras"));
      setCarreras(
        snapC.docs.map((d) => ({
          id: d.id,
          titulo: (d.data() as any).titulo || "(sin título)",
        }))
      );

      const snapT = await getDocs(collection(db, "tempusuarios"));
      setAccesses(
        snapT.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            carreraId: data.carreraId,
            range: data.range,
            username: data.username,
            password: data.password,
            expiresAt: data.expiresAt?.toDate
              ? (data.expiresAt as Timestamp).toDate()
              : new Date(data.expiresAt),
            createdAt: data.createdAt?.toDate
              ? (data.createdAt as Timestamp).toDate()
              : new Date(),
            link: data.link,
          };
        })
      );
    })();
  }, []);

  const handleCreate = async () => {
    setError(null);
    const expDate = parseDateTimeLocal(expiresAt);

    if (
      !carreraId ||
      startNumber <= 0 ||
      endNumber < startNumber ||
      !expDate ||
      !username.trim() ||
      !password
    ) {
      setError("Por favor completa todos los campos correctamente.");
      return;
    }

    if (expDate.getTime() <= Date.now()) {
      setError("La fecha de expiración debe ser futura.");
      return;
    }

    setLoading(true);

    try {
      const carreraRef = doc(db, "carreras", carreraId);
      const carreraSnap = await getDoc(carreraRef);
      if (!carreraSnap.exists()) throw new Error("Carrera no encontrada");

      const maxCupo = Number(carreraSnap.get("maxCompetitors") || 0);
      if (maxCupo > 0 && endNumber > maxCupo) {
        throw new Error(`El rango excede el cupo máximo (${maxCupo})`);
      }

      const insSnap = await getDocs(
  query(
    collection(db, "inscripciones"),
    where("carreraId", "==", carreraId),
    where("competitorNumber", ">=", startNumber),
    where("competitorNumber", "<=", endNumber),
    where("paymentStatus", "in", ["paid", "manual"])
  )
);

if (!insSnap.empty) {
  const usados = insSnap.docs
    .map((d) => d.data().competitorNumber)
    .filter((n) => typeof n === "number")
    .sort((a, b) => a - b);

  throw new Error(
    `El rango ${startNumber}-${endNumber} choca con números ya usados: ${usados.join(", ")}`
  );
}

      const docRef = (await addDoc(collection(db, "tempusuarios"), {
        carreraId,
        range: { start: startNumber, end: endNumber },
        expiresAt: Timestamp.fromDate(expDate),
        username: username.trim(),
        password,
        createdAt: serverTimestamp(),
        processed: false,
        reservedFrom: startNumber,
        reservedTo: endNumber,
      })) as DocumentReference;

      const url = `${window.location.origin}/inscripcion-manual/${docRef.id}`;
      await updateDoc(docRef, { link: url });

      setAccesses((prev) => [
        ...prev,
        {
          id: docRef.id,
          carreraId,
          range: { start: startNumber, end: endNumber },
          username: username.trim(),
          password,
          expiresAt: expDate,
          createdAt: new Date(),
          link: url,
        },
      ]);

      setLink(url);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Error al crear el acceso temporal.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tempId: string) => {
    setError(null);

    const ok = window.confirm(
      "¿Eliminar este acceso temporal?\n\nLos números no usados serán liberados."
    );
    if (!ok) return;

    setDeletingId(tempId);

    try {
      const fn = httpsCallable(getFunctions(), "eliminarTempUsuario");
      await fn({ tempId });

      setAccesses((prev) => prev.filter((a) => a.id !== tempId));
      setLink((prev) => (prev.includes(tempId) ? "" : prev));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "No se pudo eliminar el acceso.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
  <AuthGuard>
    <div className="min-h-screen bg-[#0c0c0f] py-12 px-6 text-white">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-white/70 hover:text-dh-purple transition"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            <span className="font-semibold">Volver</span>
          </button>

          <div className="text-right">
            <p className="text-xs text-white/40 uppercase tracking-wide">
              Panel Admin
            </p>
            <h1 className="text-2xl font-black bg-gradient-to-r from-dh-purple to-dh-green bg-clip-text text-transparent">
              Inscripciones Manuales
            </h1>
          </div>
        </div>

        {/* Crear acceso */}
        <section className="bg-[#16161d] border border-dh-purple/20 rounded-3xl p-8 space-y-6">

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold">
              Crear Acceso Temporal
            </h2>
            <span className="text-xs rounded-full bg-dh-purple/10 border border-dh-purple/20 px-3 py-1 text-dh-purple">
              Link + Usuario + Rango
            </span>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Carrera */}
            <div>
              <label className="text-sm font-semibold text-white/70">
                Carrera
              </label>
              <select
                className="mt-2 w-full bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
                value={carreraId}
                onChange={(e) => setCarreraId(e.target.value)}
              >
                <option value="">-- Selecciona carrera --</option>
                {carreras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>

            {/* Expiración */}
            <div>
              <label className="text-sm font-semibold text-white/70">
                Expiración
              </label>
              <input
                type="datetime-local"
                className="mt-2 w-full bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-white/40 mt-2">
                Se toma como hora local del dispositivo.
              </p>
            </div>

            {/* Rango */}
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-white/70">
                Rango de números
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <input
                  type="number"
                  min={1}
                  placeholder="Número inicio"
                  className="bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
                  value={startNumber}
                  onChange={(e) => setStartNumber(Number(e.target.value))}
                />
                <input
                  type="number"
                  min={startNumber}
                  placeholder="Número fin"
                  className="bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
                  value={endNumber}
                  onChange={(e) => setEndNumber(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Credenciales */}
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-white/70">
                Credenciales
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <input
                  type="text"
                  placeholder="Usuario"
                  className="bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  className="bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-2xl bg-dh-green text-black py-4 font-extrabold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear Acceso"}
          </button>

          {link && (
            <div className="rounded-2xl border border-dh-green/30 bg-dh-green/10 p-5">
              <p className="font-semibold text-dh-green">Link generado</p>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 underline break-all text-white"
              >
                {link}
              </a>
            </div>
          )}
        </section>

        {/* Lista accesos */}
        <section className="bg-[#16161d] border border-dh-purple/20 rounded-3xl p-8 space-y-6">

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold">
              Accesos Temporales
            </h2>
            <span className="text-sm text-white/70">
              Total: <span className="font-bold text-dh-green">{accesses.length}</span>
            </span>
          </div>

          {accesses.length === 0 ? (
            <div className="text-white/50 text-sm">
              No hay accesos temporales.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[980px] table-auto border-collapse text-sm">
                <thead className="bg-[#1b1b22] text-white/70 uppercase tracking-wide text-xs">
                  <tr>
                    <th className="p-3 text-left">Carrera</th>
                    <th className="p-3 text-left">Usuario</th>
                    <th className="p-3 text-left">Contraseña</th>
                    <th className="p-3 text-left">Rango</th>
                    <th className="p-3 text-left">Expira</th>
                    <th className="p-3 text-left">Acciones</th>
                  </tr>
                </thead>

                <tbody className="bg-[#141418] text-white">
                  {accesses
                    .slice()
                    .sort((a, b) => {
                      const at = (a.expiresAt as Date)?.getTime?.() ?? 0;
                      const bt = (b.expiresAt as Date)?.getTime?.() ?? 0;
                      return bt - at;
                    })
                    .map((acc) => {
                      const carrera = carreras.find((c) => c.id === acc.carreraId);
                      const isDeleting = deletingId === acc.id;

                      return (
                        <tr
                          key={acc.id}
                          className="border-t border-white/5 hover:bg-[#1f1f27] transition"
                        >
                          <td className="p-3 font-semibold">
                            {carrera?.titulo || acc.carreraId}
                          </td>
                          <td className="p-3">{acc.username}</td>
                          <td className="p-3">{acc.password}</td>
                          <td className="p-3">
                            {`${acc.range.start}–${acc.range.end}`}
                          </td>
                          <td className="p-3 text-white/70">
                            {(acc.expiresAt as Date).toLocaleString()}
                          </td>
                          <td className="p-3 flex gap-4 items-center">
                            {acc.link && (
                              <a
                                href={acc.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-dh-purple underline"
                              >
                                Ver
                              </a>
                            )}

                            <button
                              onClick={() => handleDelete(acc.id)}
                              disabled={isDeleting}
                              className="text-red-400 hover:text-red-300 font-semibold disabled:opacity-50"
                            >
                              {isDeleting ? "Eliminando…" : "Eliminar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  </AuthGuard>
);
}
