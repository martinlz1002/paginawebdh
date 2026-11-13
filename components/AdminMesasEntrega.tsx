import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  createEntregaSalt,
  hashEntregaPin,
  normalizeBib,
  validateMesaRanges,
  type MesaRange,
} from "@/lib/entregaKits";

const CONFIG_REF = doc(db, "configuracionEntrega", "active");
const PUBLIC_COMPETITORS_REF = collection(db, "busquedaCompetidor", "active", "publicCompetidores");

export default function AdminMesasEntrega() {
  const [ranges, setRanges] = useState<MesaRange[]>([
    { id: "mesa-1", nombre: "Mesa 1", desde: 1, hasta: 100 },
  ]);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const load = async () => {
      try {
        const snapshot = await getDoc(CONFIG_REF);
        const data = snapshot.data();
        if (Array.isArray(data?.ranges) && data.ranges.length) {
          setRanges(data.ranges as MesaRange[]);
          setConfigured(Boolean(data.pinSalt && data.pinHash));
        }
      } catch (error) {
        console.error("Error cargando configuración de entrega:", error);
        setMessage("No se pudo cargar la configuración. Verifica tus permisos de administrador.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const updateRange = (index: number, field: keyof MesaRange, value: string) => {
    setRanges((current) =>
      current.map((range, i) =>
        i === index
          ? { ...range, [field]: field === "nombre" || field === "id" ? value : Number(value) }
          : range
      )
    );
  };

  const addRange = () => {
    const nextNumber = ranges.length + 1;
    const nextBib = Math.max(0, ...ranges.map((range) => Number(range.hasta) || 0)) + 1;
    setRanges((current) => [
      ...current,
      {
        id: `mesa-${Date.now()}-${nextNumber}`,
        nombre: `Mesa ${nextNumber}`,
        desde: nextBib,
        hasta: nextBib + 99,
      },
    ]);
  };

  const removeRange = (index: number) => {
    setRanges((current) => current.filter((_, i) => i !== index));
  };

  const save = async () => {
    setMessage("");
    const validation = validateMesaRanges(ranges);
    if (validation) {
      setMessage(validation);
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setMessage("El PIN debe tener entre 4 y 8 dígitos.");
      return;
    }

    setSaving(true);
    try {
      const competitorsSnapshot = await getDocs(PUBLIC_COMPETITORS_REF);
      const competitors = competitorsSnapshot.docs.map((item) => ({
        id: item.id,
        bib: normalizeBib(item.data().Bib),
      }));
      const invalid = competitors.filter((item) => !Number.isFinite(item.bib) || !ranges.some((range) => item.bib >= range.desde && item.bib <= range.hasta));

      if (invalid.length) {
        const examples = invalid.slice(0, 8).map((item) => {
          const raw = competitorsSnapshot.docs.find((docSnap) => docSnap.id === item.id)?.data().Bib;
          return raw === undefined || raw === null || raw === "" ? "sin número" : String(raw);
        });
        setMessage(`${invalid.length} competidor(es) no tienen un Bib válido o quedan fuera de los rangos. Ejemplos: ${examples.join(", ")}.`);
        return;
      }

      const rangesWithCounts = ranges.map((range) => ({
        ...range,
        totalCompetidores: competitors.filter((item) => item.bib >= range.desde && item.bib <= range.hasta).length,
      }));
      const salt = createEntregaSalt();
      const pinHash = await hashEntregaPin(pin, salt);

      await setDoc(
        CONFIG_REF,
        {
          ranges: rangesWithCounts,
          pinSalt: salt,
          pinHash,
          pinVersion: 2,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setRanges(rangesWithCounts);
      setConfigured(true);
      setPin("");
      setMessage(`Configuración guardada correctamente. ${competitors.length} competidores distribuidos en ${ranges.length} mesa(s).`);
    } catch (error: any) {
      console.error("Error guardando configuración de mesas:", error);
      setMessage(error?.message || "No se pudo guardar la configuración. Revisa los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-dh-muted">Cargando configuración de mesas...</div>;

  return (
    <section className="max-w-5xl space-y-6 text-dh-ink">
      <div>
        <h2 className="text-2xl font-black">Configuración de mesas de entrega</h2>
        <p className="mt-2 text-sm text-dh-muted">
          Define los rangos Bib. Recepción enviará cada competidor a la mesa que corresponda.
        </p>
      </div>

      <div className="rounded-2xl border border-dh-border bg-dh-panel p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Rangos de competidores</h3>
          <button onClick={addRange} className="rounded-xl bg-dh-purple px-4 py-2 text-sm font-bold text-dh-dark">
            + Agregar mesa
          </button>
        </div>

        {ranges.map((range, index) => (
          <div key={range.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-end rounded-xl bg-dh-soft p-4">
            <label className="text-sm font-semibold">
              Nombre de mesa
              <input value={range.nombre} onChange={(event) => updateRange(index, "nombre", event.target.value)} className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2" />
            </label>
            <label className="text-sm font-semibold">
              Desde
              <input type="number" min="1" value={range.desde} onChange={(event) => updateRange(index, "desde", event.target.value)} className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2" />
            </label>
            <label className="text-sm font-semibold">
              Hasta
              <input type="number" min="1" value={range.hasta} onChange={(event) => updateRange(index, "hasta", event.target.value)} className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2" />
            </label>
            <button onClick={() => removeRange(index)} disabled={ranges.length === 1} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-30">
              Eliminar
            </button>
            {"totalCompetidores" in range && (
              <p className="text-xs text-dh-muted md:col-span-4">Competidores en este rango: {range.totalCompetidores ?? 0}</p>
            )}
          </div>
        ))}
        <p className="text-xs text-dh-muted">
          Los rangos no pueden encimarse y todos los competidores publicados deben quedar dentro de uno.
        </p>
      </div>

      <div className="rounded-2xl border border-dh-border bg-dh-panel p-5 space-y-3">
        <h3 className="font-bold">PIN de las estaciones</h3>
        <p className="text-sm text-dh-muted">
          {configured ? "Introduce un PIN nuevo para reemplazar el actual." : "Define el PIN que utilizarán recepción y las mesas."}
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="PIN de 4 a 8 dígitos"
          className="w-full max-w-sm rounded-xl border border-dh-border bg-dh-soft px-4 py-3 tracking-[0.35em]"
        />
        <p className="text-xs text-dh-muted">
          El PIN funciona como control operativo de la interfaz. Al no usar backend, no es una barrera de seguridad contra alguien que inspeccione el navegador o Firestore.
        </p>
      </div>

      {configured && origin && (
        <div className="rounded-2xl border border-dh-border bg-dh-panel p-5 space-y-3">
          <h3 className="font-bold">Enlaces de las estaciones</h3>
          <div className="rounded-lg bg-dh-soft p-3">
            <p className="text-sm font-semibold">Recepción</p>
            <a className="break-all text-xs text-dh-purple underline" href={`${origin}/buscar-competidor`} target="_blank" rel="noreferrer">
              {origin}/buscar-competidor
            </a>
          </div>
          {ranges.map((range) => (
            <div key={range.id} className="rounded-lg bg-dh-soft p-3">
              <p className="text-sm font-semibold">{range.nombre}</p>
              <a className="break-all text-xs text-dh-purple underline" href={`${origin}/entrega-kits?mesa=${encodeURIComponent(range.id)}`} target="_blank" rel="noreferrer">
                {origin}/entrega-kits?mesa={range.id}
              </a>
            </div>
          ))}
        </div>
      )}

      {message && <div className="rounded-xl bg-dh-soft p-3 text-sm">{message}</div>}
      <button onClick={save} disabled={saving || !pin || ranges.length === 0} className="rounded-xl bg-dh-purple px-6 py-3 font-bold text-dh-dark disabled:opacity-50">
        {saving ? "Guardando..." : "Guardar configuración"}
      </button>
    </section>
  );
}
