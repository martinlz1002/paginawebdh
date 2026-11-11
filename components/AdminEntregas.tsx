import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Delivery = { estado: string; mesaId: string; mesaNombre: string; bib: number };
export default function AdminEntregas() {
  const [items, setItems] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [ranges, setRanges] = useState<Array<{id:string;nombre:string;desde:number;hasta:number}>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    Promise.all([
      getDoc(doc(db, "busquedaCompetidor", "active")),
      getDoc(doc(db, "configuracionEntrega", "active")),
    ]).then(([activeSnap, configSnap]) => {
      if (!alive) return;
      setTotal(Number(activeSnap.data()?.totalCompetidores || 0));
      setRanges(configSnap.data()?.ranges || []);
    }).catch(console.error);
    const unsub = onSnapshot(collection(db, "busquedaCompetidor", "active", "entregas"), (snap) => {
      setItems(snap.docs.map((d) => d.data() as Delivery));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => { alive = false; unsub(); };
  }, []);
  const enProceso = items.filter((x) => x.estado === "en_proceso").length;
  const entregados = items.filter((x) => x.estado === "entregado").length;
  const pendientes = Math.max(0, total - enProceso - entregados);
  const byMesa = useMemo(() => ranges.map((mesa) => {
    const rows = items.filter((x) => x.mesaId === mesa.id);
    const process = rows.filter((x) => x.estado === "en_proceso").length;
    const done = rows.filter((x) => x.estado === "entregado").length;
    const assigned = rows.length;
    return { ...mesa, process, done, assigned, pending: Math.max(0, Number((mesa as any).totalCompetidores || 0) - assigned) };
  }), [ranges, items]);
  return <section className="max-w-6xl space-y-6 text-dh-ink">
    <div><h2 className="text-2xl font-black">Control de entregas</h2><p className="mt-1 text-sm text-dh-muted">Seguimiento en tiempo real de recepción y entrega de kits.</p></div>
    {loading ? <p className="text-dh-muted">Cargando estadísticas...</p> : <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-dh-border bg-dh-panel p-5"><p className="text-sm text-dh-muted">Pendientes por encontrar</p><p className="mt-2 text-3xl font-black">{pendientes.toLocaleString("es-MX")}</p></div>
        <div className="rounded-2xl border border-blue-500/20 bg-dh-panel p-5"><p className="text-sm text-blue-500">En proceso</p><p className="mt-2 text-3xl font-black">{enProceso.toLocaleString("es-MX")}</p></div>
        <div className="rounded-2xl border border-emerald-500/20 bg-dh-panel p-5"><p className="text-sm text-emerald-600">Entregados</p><p className="mt-2 text-3xl font-black">{entregados.toLocaleString("es-MX")}</p></div>
      </div>
      <div className="rounded-2xl border border-dh-border bg-dh-panel p-5"><h3 className="mb-4 font-bold">Avance por mesa</h3>{byMesa.length === 0 ? <p className="text-sm text-dh-muted">Configura primero los rangos de las mesas.</p> : <div className="space-y-4">{byMesa.map((m) => <div key={m.id} className="space-y-2"><div className="flex flex-wrap justify-between gap-2"><strong>{m.nombre}</strong><span className="text-sm text-dh-muted">Rango {m.desde} a {m.hasta}</span></div><div className="grid grid-cols-3 gap-2 text-sm"><div className="rounded-lg bg-dh-soft p-3"><b>{m.pending}</b><p className="text-xs text-dh-muted">Pendientes</p></div><div className="rounded-lg bg-blue-500/10 p-3"><b>{m.process}</b><p className="text-xs text-blue-500">En proceso</p></div><div className="rounded-lg bg-emerald-500/10 p-3"><b>{m.done}</b><p className="text-xs text-emerald-600">Entregados</p></div></div></div>)}</div>}</div>
    </>}
  </section>;
}
