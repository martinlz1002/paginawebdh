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
} from "firebase/firestore";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import type { TempUsuario } from "@/types/tempusuario";
import type { CarreraOption } from "@/components/EliminarInscripciones";

interface TempAccessRecord extends TempUsuario {
  id: string;
  link?: string;
}

// ✅ parse seguro para <input type="datetime-local">
function parseDateTimeLocal(value: string): Date | null {
  // value: "YYYY-MM-DDTHH:mm"
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, ys, ms, ds, hs, mins] = m;
  const y = Number(ys);
  const mo = Number(ms) - 1;
  const d = Number(ds);
  const h = Number(hs);
  const mi = Number(mins);
  const dt = new Date(y, mo, d, h, mi, 0, 0); // ✅ LOCAL explícito
  return Number.isFinite(dt.getTime()) ? dt : null;
}

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
  const [error, setError] = useState<string | null>(null);

  // 1) Cargar carreras y accesos existentes
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
          data.expiresAt?.toDate ? (data.expiresAt as Timestamp).toDate() : new Date(data.expiresAt);

        const created =
          data.createdAt?.toDate ? (data.createdAt as Timestamp).toDate() : new Date();

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

    // ✅ evita crear enlaces ya expirados
    if (expDate.getTime() <= Date.now()) {
      setError("La fecha de expiración debe ser futura.");
      return;
    }

    setLoading(true);

    try {
      const docRef = (await addDoc(collection(db, "tempusuarios"), {
        carreraId,
        range: { start: startNumber, end: endNumber },
        // ✅ guardar como Timestamp consistente
        expiresAt: Timestamp.fromDate(expDate),
        username: username.trim(),
        password,
        createdAt: serverTimestamp(),
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
      setError("Error al crear el acceso temporal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="max-w-4xl mx-auto p-6 space-y-8 bg-white rounded shadow">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-800"
        >
          <ChevronLeftIcon className="w-5 h-5 mr-1" />
          <span className="text-gray-800">Volver</span>
        </button>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Crear Inscripciones Manuales
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-gray-800">Carrera</label>
              <select
                className="w-full border p-2 rounded text-gray-900"
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

            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block font-medium text-gray-800">Número inicio</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border p-2 rounded text-gray-900"
                  value={startNumber}
                  onChange={(e) => setStartNumber(Number(e.target.value))}
                />
              </div>
              <div className="flex-1">
                <label className="block font-medium text-gray-800">Número fin</label>
                <input
                  type="number"
                  min={startNumber}
                  className="w-full border p-2 rounded text-gray-900"
                  value={endNumber}
                  onChange={(e) => setEndNumber(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-gray-800">Expiración</label>
              <input
                type="datetime-local"
                className="w-full border p-2 rounded text-gray-900"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Se toma como hora local del dispositivo.
              </p>
            </div>

            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block font-medium text-gray-800">Usuario</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded text-gray-900"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block font-medium text-gray-800">Contraseña</label>
                <input
                  type="password"
                  className="w-full border p-2 rounded text-gray-900"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <p className="text-red-600">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear Acceso"}
          </button>

          {link && (
            <div className="bg-green-50 border border-green-200 p-4 rounded">
              <p className="font-medium text-gray-800">Link generado:</p>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline break-all"
              >
                {link}
              </a>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800">
            Accesos Temporales Creados
          </h2>

          {accesses.length === 0 ? (
            <p className="text-gray-500">No hay accesos temporales.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full table-auto border-collapse rounded-lg shadow">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left text-gray-800">Carrera</th>
                    <th className="p-2 text-left text-gray-800">Usuario</th>
                    <th className="p-2 text-left text-gray-800">Contraseña</th>
                    <th className="p-2 text-left text-gray-800">Rango</th>
                    <th className="p-2 text-left text-gray-800">Expira</th>
                    <th className="p-2 text-left text-gray-800">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {accesses.map((acc) => {
                    const carrera = carreras.find((c) => c.id === acc.carreraId);
                    return (
                      <tr key={acc.id} className="hover:bg-gray-50">
                        <td className="p-2 text-gray-800">{carrera?.titulo || acc.carreraId}</td>
                        <td className="p-2 text-gray-800">{acc.username}</td>
                        <td className="p-2 text-gray-800">{acc.password}</td>
                        <td className="p-2 text-gray-800">{`${acc.range.start}–${acc.range.end}`}</td>
                        <td className="p-2 text-gray-800">
                          {(acc.expiresAt as Date).toLocaleString()}
                        </td>
                        <td className="p-2 text-gray-800">
                          {acc.link ? (
                            <a
                              href={acc.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline"
                            >
                              Ver
                            </a>
                          ) : (
                            "-"
                          )}
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
    </AuthGuard>
  );
}