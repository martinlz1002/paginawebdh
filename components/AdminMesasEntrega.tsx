import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "@/lib/firebase";

type MesaRange = { id: string; nombre: string; desde: number; hasta: number };

export default function AdminMesasEntrega() {
  const [ranges, setRanges] = useState<MesaRange[]>([{ id: "mesa-1", nombre: "Mesa 1", desde: 1, hasta: 1000 }]);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const functions = getFunctions(app, "us-central1");
  const saveConfig = httpsCallable(functions, "configurarMesasEntrega");

  useEffect(() => {
    setOrigin(window.location.origin);
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "configuracionEntrega", "active"));
        const config = snap.data();
        if (Array.isArray(config?.ranges) && config.ranges.length) {
          setRanges(config.ranges);
          setConfigured(Boolean(config.pinHash));
        }
      } catch (error) {
        console.error(error);
        setMessage("No se pudo cargar la configuración. Verifica que tengas permisos de administrador.");
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const updateRange = (index: number, field: keyof MesaRange, value: string) => {
    setRanges((prev) => prev.map((r, i) => i === index ? { ...r, [field]: field === "nombre" || field === "id" ? value : Number(value) } : r));
  };

  const addRange = () => {
    const n = ranges.length + 1;
    const last = ranges[ranges.length - 1];
    const next = Number(last?.hasta || 0) + 1;
    const id = `mesa-${n}-${Date.now()}`;
    setRanges((prev) => [...prev, { id, nombre: `Mesa ${n}`, desde: next, hasta: next + 999 }]);
  };

  const removeRange = (index: number) => setRanges((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    setMessage("");
    if (!/^\d{4,8}$/.test(pin)) { setMessage("El PIN debe tener entre 4 y 8 dígitos."); return; }
    setSaving(true);
    try {
      await saveConfig({ ranges, pin });
      setConfigured(true);
      setPin("");
      setMessage("Configuración guardada. El PIN quedó actualizado.");
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "No se pudo guardar la configuración.");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-dh-muted">Cargando configuración de mesas...</div>;

  return (
    <section className="max-w-5xl space-y-6 text-dh-ink">
      <div>
        <h2 className="text-2xl font-black">Configuración de mesas de entrega</h2>
        <p className="mt-2 text-sm text-dh-muted">Define los rangos de números de cada mesa. Al marcar un competidor como encontrado, DHTime lo enviará automáticamente a la mesa correspondiente.</p>
      </div>
      <div className="rounded-2xl border border-dh-border bg-dh-panel p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Rangos de competidores</h3>
          <button onClick={addRange} className="rounded-xl bg-dh-purple px-4 py-2 text-sm font-bold text-dh-dark">+ Agregar mesa</button>
        </div>
        {ranges.map((r, index) => (
          <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-end rounded-xl bg-dh-soft p-4">
            <label className="text-sm font-semibold">Nombre de mesa<input value={r.nombre} onChange={(e) => updateRange(index, "nombre", e.target.value)} className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2" /></label>
            <label className="text-sm font-semibold">Desde<input type="number" min="1" value={r.desde} onChange={(e) => updateRange(index, "desde", e.target.value)} className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2" /></label>
            <label className="text-sm font-semibold">Hasta<input type="number" min="1" value={r.hasta} onChange={(e) => updateRange(index, "hasta", e.target.value)} className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2" /></label>
            <button onClick={() => removeRange(index)} disabled={ranges.length === 1} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-30">Eliminar</button>
          </div>
        ))}
        <p className="text-xs text-dh-muted">Los rangos no pueden encimarse. Los competidores cuyo número no esté dentro de algún rango no podrán marcarse como encontrados.</p>
        {configured && origin && <div className="space-y-2 border-t border-dh-border pt-4"><h4 className="text-sm font-bold">Enlaces para las mesas</h4>{ranges.map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-dh-soft p-3"><span className="text-sm font-semibold">{r.nombre}</span><a className="break-all text-xs text-dh-purple underline" href={`${origin}/entrega-kits?mesa=${encodeURIComponent(r.id)}`} target="_blank" rel="noreferrer">{origin}/entrega-kits?mesa={r.id}</a></div>)}</div>}
      </div>
      <div className="rounded-2xl border border-dh-border bg-dh-panel p-5 space-y-3">
        <h3 className="font-bold">PIN de las estaciones</h3>
        <p className="text-sm text-dh-muted">{configured ? "Ya existe un PIN configurado. Escribe uno nuevo solamente si deseas reemplazarlo." : "Define el PIN que deberán ingresar recepción y las mesas para realizar cambios."}</p>
        <input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="PIN de 4 a 8 dígitos" className="w-full max-w-sm rounded-xl border border-dh-border bg-dh-soft px-4 py-3 tracking-[0.35em]" />
        <p className="text-xs text-dh-muted">El PIN se almacena como hash en Firebase, no en texto visible.</p>
      </div>
      {message && <div className="rounded-xl bg-dh-soft p-3 text-sm">{message}</div>}
      <button onClick={save} disabled={saving || !pin || ranges.length === 0} className="rounded-xl bg-dh-purple px-6 py-3 font-bold text-dh-dark disabled:opacity-50">{saving ? "Guardando..." : "Guardar configuración"}</button>
    </section>
  );
}
