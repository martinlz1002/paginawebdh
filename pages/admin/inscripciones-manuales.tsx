import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AuthGuard from "@/components/AuthGuard";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  DocumentReference,
  Timestamp,
  deleteDoc,
  doc,
  runTransaction,
  getDoc,
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
  const [carreraId, setCarreraId] = useState<string>("");
  const [startNumber, setStartNumber] = useState<number>(0);
  const [endNumber, setEndNumber] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
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
      const accs: TempAccessRecord[] = snapT.docs.map((d) => {
        const data = d.data() as any;

        const exp =
          data.expiresAt?.toDate
            ? (data.expiresAt as Timestamp).toDate()
            : new Date(data.expiresAt);

        const created =
          data.createdAt?.toDate
            ? (data.createdAt as Timestamp).toDate()
            : new Date();

        return {
          id: d.id,
          carreraId: data.carreraId,
          range: data.range,
          username: data.username,
          password: data.password,
          expiresAt: exp,
          createdAt: created,
          link: data.link,
        };
      });

      setAccesses(accs);
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
      // ✅ 1) crear tempusuario
      const docRef = (await addDoc(collection(db, "tempusuarios"), {
        carreraId,
        range: { start: startNumber, end: endNumber },
        expiresAt: Timestamp.fromDate(expDate),
        username: username.trim(),
        password,
        createdAt: serverTimestamp(),

        // opcional: auditoría
        reservedFrom: startNumber,
        reservedTo: endNumber,
      })) as DocumentReference;

      const url = `${window.location.origin}/inscripcion-manual/${docRef.id}`;
      await updateDoc(docRef, { link: url });

      // ✅ 2) IMPORTANTÍSIMO: asegurar nextNumber para que online empiece después del rango manual
      // nextNumber = max(nextNumber actual, endNumber + 1)
      await runTransaction(db, async (tx) => {
        const carreraRef = doc(db, "carreras", carreraId);
        const snap = (await tx.get(carreraRef)) as any;
        if (!snap.exists()) throw new Error("Carrera no encontrada");

        const currentNext = Number(snap.get("nextNumber") || 1);
        const desiredNext = endNumber + 1;

        if (!Number.isFinite(currentNext)) {
          // si estaba corrupto, lo arreglamos
          tx.set(carreraRef, { nextNumber: desiredNext }, { merge: true });
          return;
        }

        if (desiredNext > currentNext) {
          tx.set(carreraRef, { nextNumber: desiredNext }, { merge: true });
        }
      });

      // ✅ 3) UI
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

  // ✅ Eliminar acceso temporal (UI + Firestore)
  const handleDelete = async (tempId: string) => {
    setError(null);

    const ok = window.confirm(
      "¿Eliminar este acceso temporal?\n\nEsto dejará el link INACTIVO y ya no se podrá usar."
    );
    if (!ok) return;

    setDeletingId(tempId);

    try {
      await deleteDoc(doc(db, "tempusuarios", tempId));

      setAccesses((prev) => prev.filter((a) => a.id !== tempId));
      setLink((prevLink) => (prevLink.includes(tempId) ? "" : prevLink));
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "No se pudo eliminar. Verifica permisos admin (reglas/firestore)."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-dh-soft py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className={`${cardBase} p-5 flex items-center justify-between`}>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-dh-ink hover:text-dh-purple transition"
            >
              <ChevronLeftIcon className="w-5 h-5" />
              <span className="font-semibold">Volver</span>
            </button>

            <div className="text-right">
              <p className="text-sm text-gray-500">Admin</p>
              <h1 className="text-lg font-extrabold text-dh-purple">
                Inscripciones Manuales
              </h1>
            </div>
          </div>

          {/* Crear */}
          <section className={`${cardBase} p-6 space-y-5`}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-extrabold text-dh-ink">
                Crear Acceso Temporal
              </h2>
              <span className="text-xs rounded-full bg-dh-soft border border-dh-purple/10 px-3 py-1 text-gray-600">
                Genera link + usuario + rango
              </span>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Carrera */}
              <div>
                <label className={labelBase}>Carrera</label>
                <div className="relative">
                  <LinkIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    className={selectBase}
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
              </div>

              {/* Expiración */}
              <div>
                <label className={labelBase}>Expiración</label>
                <div className="relative">
                  <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="datetime-local"
                    className={inputBase}
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Se toma como hora local del dispositivo.
                </p>
              </div>

              {/* Rango */}
              <div className="md:col-span-2">
                <label className={labelBase}>Rango de números</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <HashtagIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min={1}
                      className={inputBase}
                      placeholder="Número inicio"
                      value={startNumber}
                      onChange={(e) => setStartNumber(Number(e.target.value))}
                    />
                  </div>
                  <div className="relative">
                    <HashtagIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min={startNumber}
                      className={inputBase}
                      placeholder="Número fin"
                      value={endNumber}
                      onChange={(e) => setEndNumber(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Credenciales */}
              <div className="md:col-span-2">
                <label className={labelBase}>Credenciales</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      className={inputBase}
                      placeholder="Usuario"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <KeyIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      className={inputBase}
                      placeholder="Contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full rounded-xl bg-dh-green text-dh-dark py-3 font-extrabold hover:opacity-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Creando..." : "Crear Acceso"}
            </button>

            {link && (
              <div className="rounded-2xl border border-dh-green/25 bg-green-50 p-4">
                <p className="font-semibold text-dh-ink">Link generado</p>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-dh-purple underline break-all font-medium"
                >
                  {link}
                </a>
                <p className="text-xs text-gray-600 mt-2">
                  Tip: copia el link y mándalo con el usuario/contraseña.
                </p>
              </div>
            )}
          </section>

          {/* Lista */}
          <section className={`${cardBase} p-6 space-y-4`}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-dh-ink">
                Accesos Temporales Creados
              </h2>
              <span className="text-sm text-gray-600">
                Total: <span className="font-semibold">{accesses.length}</span>
              </span>
            </div>

            {accesses.length === 0 ? (
              <p className="text-gray-500">No hay accesos temporales.</p>
            ) : (
              <div className="overflow-auto rounded-2xl border border-dh-purple/10">
                <table className="w-full min-w-[980px] table-auto border-collapse">
                  <thead className="bg-dh-soft">
                    <tr className="text-left">
                      <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                        Carrera
                      </th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                        Usuario
                      </th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                        Contraseña
                      </th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                        Rango
                      </th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                        Expira
                      </th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                        Link
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white">
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
                            className="border-t border-dh-purple/10 hover:bg-gray-50 transition"
                          >
                            <td className="p-3 text-dh-ink font-medium">
                              {carrera?.titulo || acc.carreraId}
                            </td>
                            <td className="p-3 text-dh-ink">{acc.username}</td>
                            <td className="p-3 text-dh-ink">{acc.password}</td>
                            <td className="p-3 text-dh-ink">
                              {`${acc.range.start}–${acc.range.end}`}
                            </td>
                            <td className="p-3 text-dh-ink">
                              {(acc.expiresAt as Date).toLocaleString()}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                {acc.link ? (
                                  <a
                                    href={acc.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-dh-purple underline font-semibold"
                                  >
                                    <LinkIcon className="w-4 h-4" />
                                    Ver
                                  </a>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDelete(acc.id)}
                                  disabled={isDeleting}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Eliminar link"
                                >
                                  <TrashIcon className="w-5 h-5" />
                                  <span className="text-sm font-semibold">
                                    {isDeleting ? "Eliminando…" : "Eliminar"}
                                  </span>
                                </button>
                              </div>
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
