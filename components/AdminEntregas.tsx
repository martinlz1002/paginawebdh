import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ensureEntregaAuth,
  type EntregaSession,
  type MesaRange,
} from "@/lib/entregaKits";

type Participant = {
  estadoEntrega?: "pendiente" | "en_proceso" | "entregado" | string;
  mesaId?: string | null;
  mesaNombre?: string | null;
  Bib?: string | number;
};

export default function AdminEntregas() {
  const [items, setItems] = useState<Participant[]>([]);
  const [session, setSession] = useState<EntregaSession | null>(null);
  const [ranges, setRanges] = useState<MesaRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [participantsLoaded, setParticipantsLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    let unsubscribeSession: (() => void) | undefined;
    let unsubscribeParticipants: (() => void) | undefined;

    const start = async () => {
      try {
        await ensureEntregaAuth();
        if (!alive) return;

        const controlRef = doc(db, "entregasKitsControl", "active");

        const unsubscribeControl = onSnapshot(
          controlRef,
          (controlSnapshot) => {
            if (!alive) return;

            unsubscribeSession?.();
            unsubscribeParticipants?.();
            unsubscribeSession = undefined;
            unsubscribeParticipants = undefined;

            setItems([]);
            setSession(null);
            setRanges([]);
            setSessionLoaded(false);
            setParticipantsLoaded(false);

            const sessionId = controlSnapshot.exists()
              ? controlSnapshot.data()?.sessionId
              : null;

            if (typeof sessionId !== "string" || !sessionId) {
              setSessionLoaded(true);
              setParticipantsLoaded(true);
              setLoading(false);
              return;
            }

            const sessionRef = doc(db, "entregasKits", sessionId);

            unsubscribeSession = onSnapshot(
              sessionRef,
              (sessionSnapshot) => {
                if (!alive) return;

                if (!sessionSnapshot.exists()) {
                  setSession(null);
                  setRanges([]);
                  setSessionLoaded(true);
                  setParticipantsLoaded(true);
                  setError("La sesión activa indicada no existe.");
                  setLoading(false);
                  return;
                }

                const data = sessionSnapshot.data();
                const currentSession = {
                  id: sessionSnapshot.id,
                  ...data,
                } as EntregaSession;

                setSession(currentSession);
                setRanges(Array.isArray(data.ranges) ? data.ranges : []);
                setSessionLoaded(true);
                setError("");

                if (!unsubscribeParticipants) {
                  const participantsRef = collection(
                    db,
                    "entregasKits",
                    sessionId,
                    "participantes"
                  );

                  unsubscribeParticipants = onSnapshot(
                    participantsRef,
                    (participantsSnapshot) => {
                      if (!alive) return;
                      setItems(
                        participantsSnapshot.docs.map(
                          (participantDoc) =>
                            participantDoc.data() as Participant
                        )
                      );
                      setParticipantsLoaded(true);
                      setLoading(false);
                    },
                    (reason) => {
                      console.error(
                        "Error leyendo participantes de la sesión:",
                        reason
                      );
                      if (alive) {
                        setError(
                          "No se pudieron leer los participantes de la sesión."
                        );
                        setParticipantsLoaded(true);
                        setLoading(false);
                      }
                    }
                  );
                }
              },
              (reason) => {
                console.error("Error leyendo sesión activa:", reason);
                if (alive) {
                  setError("No se pudo leer la sesión activa.");
                  setSessionLoaded(true);
                  setParticipantsLoaded(true);
                  setLoading(false);
                }
              }
            );
          },
          (reason) => {
            console.error("Error leyendo control de sesión:", reason);
            if (alive) {
              setError("No se pudo consultar cuál es la sesión activa.");
              setSessionLoaded(true);
              setParticipantsLoaded(true);
              setLoading(false);
            }
          }
        );

        return unsubscribeControl;
      } catch (reason) {
        console.error("Error iniciando control de entregas:", reason);
        if (alive) {
          setError("No se pudo iniciar la conexión con Firestore.");
          setLoading(false);
        }
      }
    };

    let unsubscribeControl: (() => void) | undefined;

    void start().then((cleanup) => {
      unsubscribeControl = cleanup;
    });

    return () => {
      alive = false;
      unsubscribeControl?.();
      unsubscribeSession?.();
      unsubscribeParticipants?.();
    };
  }, []);

  useEffect(() => {
    if (sessionLoaded && participantsLoaded) {
      setLoading(false);
    }
  }, [sessionLoaded, participantsLoaded]);

  const total = session?.totalCompetidores ?? items.length;
  const enProceso = items.filter(
    (item) => item.estadoEntrega === "en_proceso"
  ).length;
  const entregados = items.filter(
    (item) => item.estadoEntrega === "entregado"
  ).length;
  const pendientes = items.filter(
    (item) =>
      !item.estadoEntrega || item.estadoEntrega === "pendiente"
  ).length;

  const byMesa = useMemo(
    () =>
      ranges.map((mesa) => {
        const rows = items.filter((item) => item.mesaId === mesa.id);
        const process = rows.filter(
          (item) => item.estadoEntrega === "en_proceso"
        ).length;
        const done = rows.filter(
          (item) => item.estadoEntrega === "entregado"
        ).length;
        const assigned = rows.length;

        return {
          ...mesa,
          process,
          done,
          pending: Math.max(
            0,
            Number(mesa.totalCompetidores || 0) - assigned
          ),
        };
      }),
    [ranges, items]
  );

  return (
    <section className="max-w-6xl space-y-6 text-dh-ink">
      <div>
        <h2 className="text-2xl font-black">Control de entregas</h2>
        <p className="mt-1 text-sm text-dh-muted">
          Seguimiento en tiempo real de recepción y entrega de kits.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-dh-muted">Cargando estadísticas...</p>
      ) : !session ? (
        <div className="rounded-2xl border border-dh-border bg-dh-panel p-6">
          <h3 className="font-bold">No hay una sesión activa</h3>
          <p className="mt-1 text-sm text-dh-muted">
            Crea una nueva entrega de kits desde la sección de configuración
            de mesas para comenzar a mostrar estadísticas.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-dh-border bg-dh-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-dh-muted">
              Sesión activa
            </p>
            <h3 className="mt-1 text-lg font-black">
              {session.tituloEvento || "Entrega de kits"}
            </h3>
            <p className="mt-1 text-xs text-dh-muted">
              {total.toLocaleString("es-MX")} competidores en esta sesión
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-dh-border bg-dh-panel p-5">
              <p className="text-sm text-dh-muted">Pendientes por encontrar</p>
              <p className="mt-2 text-3xl font-black">
                {pendientes.toLocaleString("es-MX")}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-dh-panel p-5">
              <p className="text-sm text-blue-500">En proceso</p>
              <p className="mt-2 text-3xl font-black">
                {enProceso.toLocaleString("es-MX")}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-dh-panel p-5">
              <p className="text-sm text-emerald-600">Entregados</p>
              <p className="mt-2 text-3xl font-black">
                {entregados.toLocaleString("es-MX")}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dh-border bg-dh-panel p-5">
            <h3 className="mb-4 font-bold">Avance por mesa</h3>
            {byMesa.length === 0 ? (
              <p className="text-sm text-dh-muted">
                Todavía no hay rangos de mesas configurados para esta sesión.
              </p>
            ) : (
              <div className="space-y-4">
                {byMesa.map((mesa) => (
                  <div key={mesa.id} className="space-y-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>{mesa.nombre}</strong>
                      <span className="text-sm text-dh-muted">
                        Rango {mesa.desde} a {mesa.hasta}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg bg-dh-soft p-3">
                        <b>{mesa.pending}</b>
                        <p className="text-xs text-dh-muted">Pendientes</p>
                      </div>
                      <div className="rounded-lg bg-blue-500/10 p-3">
                        <b>{mesa.process}</b>
                        <p className="text-xs text-blue-500">En proceso</p>
                      </div>
                      <div className="rounded-lg bg-emerald-500/10 p-3">
                        <b>{mesa.done}</b>
                        <p className="text-xs text-emerald-600">Entregados</p>
                      </div>
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
