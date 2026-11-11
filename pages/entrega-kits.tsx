import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "@/lib/firebase";

type Delivery = { competitorId: string; estado: string; mesaId: string; mesaNombre: string; bib: number; participant: string; routeName?: string; categoryName?: string; talla?: string; details?: Record<string, any> };

export default function EntregaKitsPage() {
  const router = useRouter();
  const mesaId = typeof router.query.mesa === "string" ? router.query.mesa : "";
  const [pin, setPin] = useState("");
  const [items, setItems] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const functions = getFunctions(app, "us-central1");
  const markDelivered = httpsCallable(functions, "marcarKitEntregado");

  useEffect(() => {
    if (!mesaId) return;
    const q = query(collection(db, "busquedaCompetidor", "active", "entregas"), where("mesaId", "==", mesaId), where("estado", "==", "en_proceso"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ ...(d.data() as Delivery), competitorId: d.id })).sort((a, b) => a.bib - b.bib));
      setLoading(false);
    }, (error) => { console.error(error); setMessage("No se pudieron cargar los competidores. Verifica las reglas e índices de Firestore."); setLoading(false); });
    return () => unsubscribe();
  }, [mesaId]);

  const entregar = async (id: string) => {
    if (!pin) { setMessage("Ingresa el PIN de la estación."); return; }
    setBusyId(id); setMessage("");
    try { await markDelivered({ competitorId: id, mesaId, pin }); }
    catch (error: any) { setMessage(error?.message || "No se pudo registrar la entrega."); }
    finally { setBusyId(""); }
  };

  const title = useMemo(() => items[0]?.mesaNombre || (mesaId ? mesaId.replaceAll("-", " ") : "Mesa de entrega"), [items, mesaId]);

  if (!mesaId) return <main className="min-h-screen bg-[#0c0c0f] p-8 text-white">Enlace incompleto. Solicita al administrador el enlace de tu mesa.</main>;

  return (
    <main className="min-h-screen bg-[#0c0c0f] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-bold uppercase tracking-widest text-violet-400">DHTime · Entrega de kits</p><h1 className="mt-1 text-3xl font-black">{title}</h1></div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right"><div className="text-2xl font-black">{items.length}</div><div className="text-xs text-white/50">En espera de entrega</div></div>
        </header>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="block text-sm font-semibold">PIN de la estación<input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 8)); }} placeholder="Ingresa el PIN" className="mt-2 w-full max-w-xs rounded-xl border border-white/10 bg-black/30 px-4 py-3 tracking-[0.35em] outline-none focus:border-violet-400" /></label>
          <p className="mt-2 text-xs text-white/45">El PIN se valida al confirmar cada entrega.</p>
        </section>
        {message && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm">{message}</div>}
        {loading ? <p className="py-12 text-center text-white/50">Cargando competidores...</p> : items.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center"><div className="text-4xl">📦</div><h2 className="mt-3 text-xl font-bold">Sin entregas pendientes</h2><p className="mt-1 text-sm text-white/50">Los competidores aparecerán aquí cuando recepción los marque como encontrados.</p></div> : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => <article key={item.competitorId} className="rounded-2xl border border-violet-400/20 bg-white/[0.04] p-5 shadow-lg shadow-black/10">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-violet-300">NÚMERO</p><p className="text-4xl font-black">#{item.bib}</p></div><span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-300">EN PROCESO</span></div>
              <h2 className="mt-3 text-xl font-extrabold">{item.participant}</h2>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/45">Playera</p><p className="text-2xl font-black text-emerald-300">{item.talla || "Sin dato"}</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/45">Categoría</p><p className="mt-1 font-bold">{item.categoryName || "-"}</p></div></div>
              {item.routeName && <p className="mt-3 text-sm text-white/60">Ruta: {item.routeName}</p>}
              {item.details && Object.entries(item.details).filter(([key]) => !/participant|bib|routename|categoryname|talla|playera|camiseta/i.test(key)).length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(item.details).filter(([key, value]) => !/participant|bib|routename|categoryname|talla|playera|camiseta/i.test(key) && value !== undefined && value !== null && String(value).trim() !== "").map(([key, value]) => <div key={key} className="rounded-lg bg-white/5 p-2"><p className="text-[11px] text-white/40">{key}</p><p className="break-words text-sm font-semibold">{String(value)}</p></div>)}</div>}
              <button onClick={() => entregar(item.competitorId)} disabled={busyId === item.competitorId || pin.length < 4} className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 font-extrabold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">{busyId === item.competitorId ? "Registrando..." : "Marcar como entregado"}</button>
            </article>)}
          </div>
        )}
      </div>
    </main>
  );
}
