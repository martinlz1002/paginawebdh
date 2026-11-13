import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  createEntregaSalt,
  createEntregaSession,
  deleteEntregaSession,
  finalizeEntregaSession,
  getMesaForBib,
  hashEntregaPin,
  loadActiveEntregaSession,
  normalizeBib,
  validateMesaRanges,
  type EntregaSession,
  type MesaRange,
} from "@/lib/entregaKits";

type Participant = {
  Bib?: string | number;
  estadoEntrega?: "pendiente" | "en_proceso" | "entregado" | string;
  mesaId?: string | null;
  mesaNombre?: string | null;
};

const SESSIONS_COLLECTION = "entregasKits";

export default function AdminMesasEntrega() {
  const [session, setSession] = useState<EntregaSession | null>(null);
  const [history, setHistory] = useState<EntregaSession[]>([]);
  const [ranges, setRanges] = useState<MesaRange[]>([
    { id: "mesa-1", nombre: "Mesa 1", desde: 1, hasta: 100 },
  ]);
  const [pin, setPin] = useState("");
  const [origin, setOrigin] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    let mounted = true;

    const load = async () => {
      try {
        const active = await loadActiveEntregaSession();
        if (mounted) setSession(active);
      } catch (error) {
        console.error("Error cargando sesión activa:", error);
        if (mounted) setMessage("No se pudo consultar la sesión activa.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  // Historial de sesiones finalizadas. Las sesiones activas o en preparación no aparecen aquí.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, SESSIONS_COLLECTION),
      (snapshot) => {
        const items = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as EntregaSession))
          .filter((item) => item.estado === "finalizada")
          .sort((a, b) => {
            const aTime = a.finalizedAt?.toMillis?.() ?? 0;
            const bTime = b.finalizedAt?.toMillis?.() ?? 0;
            return bTime - aTime;
          });
        setHistory(items);
      },
      (error) => {
        console.error("Error cargando historial de entregas:", error);
        setMessage("No se pudo cargar el historial de sesiones.");
      }
    );

    return () => unsubscribe();
  }, []);

  // Participantes y estadísticas pertenecen exclusivamente a la sesión activa.
  useEffect(() => {
    if (!session?.id) {
      setParticipants([]);
      setLoadingStats(false);
      setRanges([{ id: "mesa-1", nombre: "Mesa 1", desde: 1, hasta: 100 }]);
      return;
    }

    setLoadingStats(true);
    const participantsRef = collection(
      db,
      SESSIONS_COLLECTION,
      session.id,
      "participantes"
    );

    const unsubscribe = onSnapshot(
      participantsRef,
      (snapshot) => {
        const rows = snapshot.docs.map((item) => item.data() as Participant);
        setParticipants(rows);
        setStatsError("");
        setLoadingStats(false);

        if (Array.isArray(session.ranges) && session.ranges.length) {
          setRanges(session.ranges);
        } else if (rows.length) {
          const bibs = rows.map((row) => normalizeBib(row.Bib)).filter(Number.isFinite);
          const minBib = Math.min(...bibs);
          const maxBib = Math.max(...bibs);
          setRanges([
            {
              id: "mesa-1",
              nombre: "Mesa 1",
              desde: Number.isFinite(minBib) ? minBib : 1,
              hasta: Number.isFinite(maxBib) ? maxBib : 100,
            },
          ]);
        }
      },
      (error) => {
        console.error("Error cargando participantes de sesión:", error);
        setStatsError("No se pudieron cargar los participantes de esta sesión.");
        setLoadingStats(false);
      }
    );

    return () => unsubscribe();
    // Se vuelve a suscribir cuando cambia la sesión, no cuando se editan rangos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const configured = Boolean(session?.pinSalt && session?.pinHash);
  const isActive = session?.estado === "activa";

  const stats = useMemo(() => {
    const result = {
      total: participants.length,
      pendientes: 0,
      enProceso: 0,
      entregados: 0,
      sinRango: 0,
      mesas: ranges.map((range) => ({
        ...range,
        total: 0,
        pendientes: 0,
        enProceso: 0,
        entregados: 0,
        porcentaje: 0,
      })),
    };

    participants.forEach((participant) => {
      const bib = normalizeBib(participant.Bib);
      const mesa = Number.isFinite(bib) ? getMesaForBib(ranges, bib) : undefined;
      if (!mesa) result.sinRango += 1;

      const estado = participant.estadoEntrega || "pendiente";
      if (estado === "entregado") result.entregados += 1;
      else if (estado === "en_proceso") result.enProceso += 1;
      else result.pendientes += 1;

      if (mesa) {
        const mesaStats = result.mesas.find((item) => item.id === mesa.id);
        if (mesaStats) {
          mesaStats.total += 1;
          if (estado === "entregado") mesaStats.entregados += 1;
          else if (estado === "en_proceso") mesaStats.enProceso += 1;
          else mesaStats.pendientes += 1;
        }
      }
    });

    result.mesas = result.mesas.map((mesa) => ({
      ...mesa,
      porcentaje: mesa.total ? Math.round((mesa.entregados / mesa.total) * 100) : 0,
    }));

    return {
      ...result,
      porcentaje: result.total ? Math.round((result.entregados / result.total) * 100) : 0,
    };
  }, [participants, ranges]);

  const updateRange = (index: number, field: keyof MesaRange, value: string) => {
    setRanges((current) =>
      current.map((range, i) =>
        i === index
          ? {
              ...range,
              [field]: field === "nombre" || field === "id" ? value : Number(value),
            }
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

  const startNewSession = async () => {
    setMessage("");
    if (!window.confirm("¿Crear una nueva sesión usando la lista publicada actualmente? El avance comenzará desde cero.")) return;

    setCreating(true);
    try {
      const sessionId = await createEntregaSession();
      const created = await loadActiveEntregaSession();
      if (!created || created.id !== sessionId) {
        throw new Error("La sesión se creó, pero no se pudo recuperar como sesión activa.");
      }
      setSession(created);
      setPin("");
      setMessage(`Nueva sesión creada correctamente con ${created.totalCompetidores} competidores.`);
    } catch (error: any) {
      console.error("Error creando sesión de entrega:", error);
      setMessage(error?.message || "No se pudo crear la nueva sesión.");
    } finally {
      setCreating(false);
    }
  };

  const save = async () => {
    setMessage("");
    if (!session?.id || !isActive) {
      setMessage("Primero crea una sesión activa.");
      return;
    }

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
      const invalid = participants
        .map((item) => normalizeBib(item.Bib))
        .filter(
          (bib) =>
            !Number.isFinite(bib) ||
            !ranges.some((range) => bib >= range.desde && bib <= range.hasta)
        );

      if (invalid.length) {
        setMessage(
          `${invalid.length} competidor(es) no tienen un Bib válido o quedan fuera de los rangos. Ejemplos: ${invalid
            .slice(0, 8)
            .map((bib) => (Number.isFinite(bib) ? String(bib) : "sin número"))
            .join(", ")}.`
        );
        return;
      }

      const rangesWithCounts = ranges.map((range) => ({
        ...range,
        totalCompetidores: participants.filter((item) => {
          const bib = normalizeBib(item.Bib);
          return Number.isFinite(bib) && bib >= range.desde && bib <= range.hasta;
        }).length,
      }));

      const salt = createEntregaSalt();
      const pinHash = await hashEntregaPin(pin, salt);

      await setDoc(
        doc(db, SESSIONS_COLLECTION, session.id),
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
      setSession((current) =>
        current ? { ...current, ranges: rangesWithCounts, pinSalt: salt, pinHash } : current
      );
      setPin("");
      setMessage(`Configuración guardada. ${participants.length} competidores distribuidos en ${ranges.length} mesa(s).`);
    } catch (error: any) {
      console.error("Error guardando configuración de mesas:", error);
      setMessage(error?.message || "No se pudo guardar la configuración. Revisa los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  };

  const finishSession = async () => {
    if (!session?.id) return;
    if (!window.confirm("¿Finalizar esta sesión? Las estaciones dejarán de trabajar en ella, pero quedará guardada en el historial.")) return;

    try {
      await finalizeEntregaSession(session.id);
      setSession(null);
      setParticipants([]);
      setPin("");
      setMessage("Sesión finalizada y guardada en el historial.");
    } catch (error: any) {
      console.error("Error finalizando sesión:", error);
      setMessage(error?.message || "No se pudo finalizar la sesión.");
    }
  };

  const removeHistorySession = async (item: EntregaSession) => {
    if (!window.confirm(`¿Eliminar definitivamente la sesión "${item.tituloEvento || item.id}" y sus ${item.totalCompetidores || 0} participantes? Esta acción no se puede deshacer.`)) return;

    try {
      await deleteEntregaSession(item.id);
      setMessage("Sesión eliminada del historial.");
    } catch (error: any) {
      console.error("Error eliminando sesión:", error);
      setMessage(error?.message || "No se pudo eliminar la sesión.");
    }
  };

  const removeAllHistory = async () => {
    if (!history.length) return;
    if (!window.confirm(`¿Eliminar las ${history.length} sesiones finalizadas y todos sus participantes? Esta acción no se puede deshacer.`)) return;

    for (const item of history) {
      try {
        await deleteEntregaSession(item.id);
      } catch (error: any) {
        console.error(`Error eliminando la sesión ${item.id}:`, error);
        setMessage(`Se detuvo la eliminación al procesar ${item.tituloEvento || item.id}: ${error?.message || "error desconocido"}`);
        return;
      }
    }
    setMessage("Se eliminó todo el historial de sesiones finalizadas.");
  };

  if (loading) {
    return <div className="p-8 text-dh-muted">Cargando sesiones de entrega...</div>;
  }

  const StatCard = ({
    label,
    value,
    detail,
    tone,
  }: {
    label: string;
    value: number | string;
    detail: string;
    tone: "neutral" | "amber" | "blue" | "green";
  }) => {
    const tones = {
      neutral: "border-dh-border",
      amber: "border-amber-500/30",
      blue: "border-blue-500/30",
      green: "border-emerald-500/30",
    };
    return (
      <div className={`rounded-2xl border ${tones[tone]} bg-dh-panel p-5`}>
        <p className="text-sm text-dh-muted">{label}</p>
        <p className="mt-2 text-3xl font-black tabular-nums">
          {typeof value === "number" ? value.toLocaleString("es-MX") : value}
        </p>
        <p className="mt-1 text-xs text-dh-muted">{detail}</p>
      </div>
    );
  };

  return (
    <section className="max-w-5xl space-y-6 text-dh-ink">
      <div>
        <h2 className="text-2xl font-black">Sesiones y entrega de kits</h2>
        <p className="mt-2 text-sm text-dh-muted">
          Cada sesión conserva su propia lista, configuración, avance e historial.
        </p>
      </div>

      {!session ? (
        <div className="rounded-2xl border border-dh-border bg-dh-panel p-5 space-y-3">
          <h3 className="text-lg font-bold">No hay una sesión activa</h3>
          <p className="text-sm text-dh-muted">
            Crea una sesión nueva a partir de los competidores publicados actualmente en Buscar Competidor. El progreso comenzará desde cero.
          </p>
          <button
            onClick={startNewSession}
            disabled={creating}
            className="rounded-xl bg-dh-purple px-5 py-3 font-bold text-dh-dark disabled:opacity-50"
          >
            {creating ? "Creando sesión..." : "+ Nueva entrega de kits"}
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-emerald-500/30 bg-dh-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Sesión activa</p>
                <h3 className="mt-1 text-xl font-black">{session.tituloEvento || "Entrega de kits"}</h3>
                <p className="mt-1 text-xs text-dh-muted">ID: {session.id}</p>
                <p className="mt-1 text-sm text-dh-muted">{participants.length.toLocaleString("es-MX")} competidores copiados</p>
              </div>
              <button
                onClick={finishSession}
                className="rounded-xl border border-amber-500/40 px-4 py-2 text-sm font-bold text-amber-600"
              >
                Finalizar sesión
              </button>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-dh-border bg-dh-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Resultados en vivo</h3>
                <p className="mt-1 text-xs text-dh-muted">Estadísticas independientes de esta sesión.</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">● Actualización en tiempo real</span>
            </div>

            {loadingStats ? (
              <p className="py-6 text-center text-sm text-dh-muted">Cargando estadísticas...</p>
            ) : statsError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">{statsError}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Total de competidores" value={stats.total} detail="Copiados a esta sesión" tone="neutral" />
                  <StatCard label="Pendientes" value={stats.pendientes} detail="Aún no pasan por recepción" tone="amber" />
                  <StatCard label="En proceso" value={stats.enProceso} detail="Asignados a una mesa" tone="blue" />
                  <StatCard label="Entregados" value={stats.entregados} detail={`${stats.porcentaje}% del total completado`} tone="green" />
                </div>
                <div className="rounded-xl border border-dh-border bg-dh-soft p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">Avance general</p>
                      <p className="text-xs text-dh-muted">{stats.entregados} de {stats.total} kits entregados</p>
                    </div>
                    <p className="text-2xl font-black tabular-nums">{stats.porcentaje}%</p>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/10">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${stats.porcentaje}%` }} />
                  </div>
                  {stats.sinRango > 0 && <p className="mt-3 text-xs font-medium text-amber-600">Atención: {stats.sinRango} competidor(es) no tienen un Bib válido o no pertenecen a ningún rango.</p>}
                </div>
                <div>
                  <h4 className="mb-3 font-bold">Avance por mesa</h4>
                  {stats.mesas.length === 0 ? (
                    <p className="text-sm text-dh-muted">Configura primero los rangos de las mesas.</p>
                  ) : (
                    <div className="space-y-4">
                      {stats.mesas.map((mesa) => (
                        <div key={mesa.id} className="rounded-xl border border-dh-border bg-dh-soft p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-bold">{mesa.nombre}</p>
                              <p className="text-xs text-dh-muted">Bib {mesa.desde} al {mesa.hasta} · {mesa.total} competidores</p>
                            </div>
                            <p className="text-lg font-black tabular-nums">{mesa.porcentaje}%</p>
                          </div>
                          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${mesa.porcentaje}%` }} />
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-lg bg-amber-500/10 p-2"><p className="text-lg font-bold text-amber-600">{mesa.pendientes}</p><p className="text-dh-muted">Pendientes</p></div>
                            <div className="rounded-lg bg-blue-500/10 p-2"><p className="text-lg font-bold text-blue-600">{mesa.enProceso}</p><p className="text-dh-muted">En proceso</p></div>
                            <div className="rounded-lg bg-emerald-500/10 p-2"><p className="text-lg font-bold text-emerald-600">{mesa.entregados}</p><p className="text-dh-muted">Entregados</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <h3 className="text-xl font-black">Rangos de competidores</h3>
            <p className="mt-1 text-sm text-dh-muted">Define qué números Bib atenderá cada mesa. Recepción asignará automáticamente al competidor según su número.</p>
          </div>
          <div className="space-y-4 rounded-2xl border border-dh-border bg-dh-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">Mesas configuradas</h3>
              <button onClick={addRange} className="rounded-xl bg-dh-purple px-4 py-2 text-sm font-bold text-dh-dark">+ Agregar mesa</button>
            </div>
            {ranges.map((range, index) => (
              <div key={range.id} className="grid grid-cols-1 items-end gap-3 rounded-xl bg-dh-soft p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]">
                <label className="text-sm font-semibold">Nombre de mesa<input value={range.nombre} onChange={(event) => updateRange(index, "nombre", event.target.value)} className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2" /></label>
                <label className="text-sm font-semibold">Desde<input type="number" min="1" value={range.desde} onChange={(event) => updateRange(index, "desde", event.target.value)} className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2" /></label>
                <label className="text-sm font-semibold">Hasta<input type="number" min="1" value={range.hasta} onChange={(event) => updateRange(index, "hasta", event.target.value)} className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2" /></label>
                <button onClick={() => removeRange(index)} disabled={ranges.length === 1} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-30">Eliminar</button>
                <p className="text-xs text-dh-muted md:col-span-4">{participants.filter((item) => { const bib = normalizeBib(item.Bib); return Number.isFinite(bib) && bib >= range.desde && bib <= range.hasta; }).length} competidores dentro de este rango.</p>
              </div>
            ))}
            <p className="text-xs text-dh-muted">Los rangos no pueden encimarse y todos los competidores deben quedar dentro de uno.</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-dh-border bg-dh-panel p-5">
            <h3 className="font-bold">PIN de las estaciones</h3>
            <p className="text-sm text-dh-muted">{configured ? "Introduce un PIN nuevo para reemplazar el actual." : "Define el PIN que utilizarán recepción y las mesas."}</p>
            <input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="PIN de 4 a 8 dígitos" className="w-full max-w-sm rounded-xl border border-dh-border bg-dh-soft px-4 py-3 tracking-[0.35em]" />
            <p className="text-xs text-dh-muted">El PIN funciona como control operativo de la interfaz. No es una barrera de seguridad validada por un backend.</p>
          </div>

          {configured && origin && (
            <div className="space-y-3 rounded-2xl border border-dh-border bg-dh-panel p-5">
              <h3 className="font-bold">Enlaces de las estaciones</h3>
              <div className="rounded-lg bg-dh-soft p-3">
                <p className="text-sm font-semibold">Recepción</p>
                <a className="break-all text-xs text-dh-purple underline" href={`${origin}/buscar-competidor?session=${encodeURIComponent(session.id)}`} target="_blank" rel="noreferrer">{origin}/buscar-competidor?session={session.id}</a>
              </div>
              {ranges.map((range) => (
                <div key={range.id} className="rounded-lg bg-dh-soft p-3">
                  <p className="text-sm font-semibold">{range.nombre}</p>
                  <a className="break-all text-xs text-dh-purple underline" href={`${origin}/entrega-kits?session=${encodeURIComponent(session.id)}&mesa=${encodeURIComponent(range.id)}`} target="_blank" rel="noreferrer">{origin}/entrega-kits?session={session.id}&mesa={range.id}</a>
                </div>
              ))}
            </div>
          )}

          <button onClick={save} disabled={saving || !pin || ranges.length === 0} className="rounded-xl bg-dh-purple px-6 py-3 font-bold text-dh-dark disabled:opacity-50">{saving ? "Guardando..." : "Guardar configuración"}</button>
        </>
      )}

      <div className="space-y-4 rounded-2xl border border-dh-border bg-dh-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Historial de entregas</h3>
            <p className="mt-1 text-xs text-dh-muted">Las sesiones finalizadas se conservan hasta que decidas eliminarlas.</p>
          </div>
          <button onClick={removeAllHistory} disabled={!history.length} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-40">Eliminar todo el historial</button>
        </div>
        {!history.length ? (
          <p className="rounded-xl bg-dh-soft p-4 text-sm text-dh-muted">Todavía no hay sesiones finalizadas.</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-dh-soft p-4">
                <div>
                  <p className="font-bold">{item.tituloEvento || "Entrega de kits"}</p>
                  <p className="mt-1 text-xs text-dh-muted">{item.totalCompetidores || 0} competidores · Finalizada: {item.finalizedAt?.toDate?.().toLocaleString("es-MX") || "Fecha no disponible"}</p>
                  <p className="mt-1 text-[11px] text-dh-muted">ID: {item.id}</p>
                </div>
                <button onClick={() => removeHistorySession(item)} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-600">Eliminar sesión</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {message && <div className="rounded-xl bg-dh-soft p-3 text-sm">{message}</div>}
    </section>
  );
}
