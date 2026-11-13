import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ensureEntregaAuth, type MesaRange } from "@/lib/entregaKits";

type Delivery = {
  estado: string;
  mesaId: string;
  mesaNombre: string;
  bib: number;
};

export default function AdminEntregas() {
  const [items, setItems] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [ranges, setRanges] = useState<MesaRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let activeLoaded = false;
    let configLoaded = false;
    let cleanup: () => void = () => {};
    const finishLoading = () => {
      if (alive && activeLoaded && configLoaded) setLoading(false);
    };

    ensureEntregaAuth()
      .then(() => {
        if (!alive) return;

        const unsubActive = onSnapshot(doc(db, "busquedaCompetidor", "active"), (snapshot) => {
          if (!alive) return;
          setTotal(Number(snapshot.data()?.totalCompetidores || 0));
          activeLoaded = true;
          finishLoading();
        }, (reason) => {
          console.error(reason);
          if (alive) setError("No se pudo leer el evento activo.");
          activeLoaded = true;
          finishLoading();
        });

        const unsubConfig = onSnapshot(doc(db, "configuracionEntrega", "active"), (snapshot) => {
          if (!alive) return;
          setRanges(Array.isArray(snapshot.data()?.ranges) ? snapshot.data()!.ranges : []);
          configLoaded = true;
          finishLoading();
        }, (reason) => {
          console.error(reason);
          if (alive) setError("No se pudo leer la configuración de mesas.");
          configLoaded = true;
          finishLoading();
        });

        const unsubDeliveries = onSnapshot(collection(db, "busquedaCompetidor", "active", "entregas"), (snapshot) => {
          if (!alive) return;
          setItems(snapshot.docs.map((item) => item.data() as Delivery));
        }, (reason) => {
          console.error(reason);
          if (alive) setError("No se pudieron leer los movimientos de entrega.");
          setLoading(false);
        });

        cleanup = () => {
          unsubActive();
          unsubConfig();
          unsubDeliveries();
        };
      })
      .catch((reason) => {
        console.error(reason);
        if (alive) {
          setError("No se pudo iniciar la conexión con Firestore.");
          setLoading(false);
        }
      });

    return () => {
      alive = false;
      cleanup();
    };
  }, []);

  const enProceso = items.filter((item) => item.estado === "en_proceso").length;
  const entregados = items.filter((item) => item.estado === "entregado").length;
  const pendientes = Math.max(0, total - enProceso - entregados);

  const byMesa = useMemo(() => ranges.map((mesa) => {
    const rows = items.filter((item) => item.mesaId === mesa.id);
    const process = rows.filter((item) => item.estado === "en_proceso").length;
    const done = rows.filter((item) => item.estado === "entregado").length;
    const assigned = rows.length;
    return {
      ...mesa,
      process,
      done,
      pending: Math.max(0, Number(mesa.totalCompetidores || 0) - assigned),
    };
  }), [ranges, items]);

  return (
    <section className="max-w-6xl space-y-6 text-dh-ink">
      <div>
        <h2 className="text-2xl font-black">Control de entregas</h2>
        <p className="mt-1 text-sm text-dh-muted">Seguimiento en tiempo real de recepción y entrega de kits.</p>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">{error}</div>}

      {loading ? <p className="text-dh-muted">Cargando estadísticas...</p> : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-dh-border bg-dh-panel p-5"><p className="text-sm text-dh-muted">Pendientes por encontrar</p><p className="mt-2 text-3xl font-black">{pendientes.toLocaleString("es-MX")}</p></div>
            <div className="rounded-2xl border border-blue-500/20 bg-dh-panel p-5"><p className="text-sm text-blue-500">En proceso</p><p className="mt-2 text-3xl font-black">{enProceso.toLocaleString("es-MX")}</p></div>
            <div className="rounded-2xl border border-emerald-500/20 bg-dh-panel p-5"><p className="text-sm text-emerald-600">Entregados</p><p className="mt-2 text-3xl font-black">{entregados.toLocaleString("es-MX")}</p></div>
          </div>

          <div className="rounded-2xl border border-dh-border bg-dh-panel p-5">
            <h3 className="mb-4 font-bold">Avance por mesa</h3>
            {byMesa.length === 0 ? <p className="text-sm text-dh-muted">Configura primero los rangos de las mesas.</p> : (
              <div className="space-y-4">
                {byMesa.map((mesa) => (
                  <div key={mesa.id} className="space-y-2">
                    <div className="flex flex-wrap justify-between gap-2"><strong>{mesa.nombre}</strong><span className="text-sm text-dh-muted">Rango {mesa.desde} a {mesa.hasta}</span></div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg bg-dh-soft p-3"><b>{mesa.pending}</b><p className="text-xs text-dh-muted">Pendientes</p></div>
                      <div className="rounded-lg bg-blue-500/10 p-3"><b>{mesa.process}</b><p className="text-xs text-blue-500">En proceso</p></div>
                      <div className="rounded-lg bg-emerald-500/10 p-3"><b>{mesa.done}</b><p className="text-xs text-emerald-600">Entregados</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
