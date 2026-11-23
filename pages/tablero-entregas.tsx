
import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { ensureEntregaAuth } from "@/lib/entregaKits";

type Participante = {
  id: string;
  Bib?: string | number;
  Participant?: string;
  estadoEntrega?: string;
  mesaId?: string | null;
  mesaNombre?: string | null;
  encontradoAt?: {
    toMillis?: () => number;
  } | null;
};

export default function TableroEntregasPage() {
  const [authReady, setAuthReady] = useState(false);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [tituloEvento, setTituloEvento] = useState("ENTREGA DE KITS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionActive, setSessionActive] = useState(false);

  // Autenticación utilizada por las estaciones de entrega.
  useEffect(() => {
    let mounted = true;

    ensureEntregaAuth()
      .then(() => {
        if (mounted) setAuthReady(true);
      })
      .catch((err) => {
        console.error("Error de autenticación:", err);
        if (mounted) {
          setError("No se pudo conectar con el tablero.");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Escuchar la sesión activa y sus participantes.
  useEffect(() => {
    if (!authReady) return;

    let unsubscribeSession: (() => void) | undefined;
    let unsubscribeParticipants: (() => void) | undefined;
    let currentSessionId = "";

    const controlRef = doc(
      db,
      "entregasKitsControl",
      "active"
    );

    const unsubscribeControl = onSnapshot(
      controlRef,
      (controlSnapshot) => {
        const sessionId = controlSnapshot.exists()
          ? controlSnapshot.data()?.sessionId
          : null;

        if (sessionId === currentSessionId) return;

        unsubscribeSession?.();
        unsubscribeParticipants?.();

        unsubscribeSession = undefined;
        unsubscribeParticipants = undefined;
        currentSessionId = sessionId || "";

        setParticipantes([]);
        setSessionActive(false);
        setLoading(true);
        setError("");

        if (!sessionId) {
          setLoading(false);
          return;
        }

        const sessionRef = doc(
          db,
          "entregasKits",
          sessionId
        );

        unsubscribeSession = onSnapshot(
          sessionRef,
          (sessionSnapshot) => {
            if (
              !sessionSnapshot.exists() ||
              sessionSnapshot.data().estado !== "activa"
            ) {
              unsubscribeParticipants?.();
              unsubscribeParticipants = undefined;

              setParticipantes([]);
              setSessionActive(false);
              setLoading(false);
              return;
            }

            const sessionData = sessionSnapshot.data();

            setTituloEvento(
              sessionData.tituloEvento || "ENTREGA DE KITS"
            );

            setSessionActive(true);

            if (!unsubscribeParticipants) {
              const participantsRef = collection(
                db,
                "entregasKits",
                sessionId,
                "participantes"
              );

              unsubscribeParticipants = onSnapshot(
                participantsRef,
                (snapshot) => {
                  const rows = snapshot.docs
                    .map((participantDoc) => ({
                      id: participantDoc.id,
                      ...participantDoc.data(),
                    } as Participante))
                    .filter(
                      (item) =>
                        item.estadoEntrega === "en_proceso" &&
                        Boolean(item.mesaId)
                    )
                    .sort((a, b) => {
                      const timeA =
                        a.encontradoAt?.toMillis?.() ?? 0;
                      const timeB =
                        b.encontradoAt?.toMillis?.() ?? 0;

                      return timeB - timeA;
                    });

                  setParticipantes(rows);
                  setLoading(false);
                  setError("");
                },
                (err) => {
                  console.error(
                    "Error leyendo participantes:",
                    err
                  );
                  setError("No se pudieron cargar los llamados.");
                  setLoading(false);
                }
              );
            }
          },
          (err) => {
            console.error("Error leyendo sesión:", err);
            setError("No se pudo consultar la sesión activa.");
            setLoading(false);
          }
        );
      },
      (err) => {
        console.error("Error leyendo control:", err);
        setError("No se pudo conectar con el tablero.");
        setLoading(false);
      }
    );

    return () => {
      unsubscribeControl();
      unsubscribeSession?.();
      unsubscribeParticipants?.();
    };
  }, [authReady]);

  const pantallaCompleta = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("No se pudo activar pantalla completa:", err);
    }
  };

  return (
    <main className="min-h-screen bg-[#08090D] text-white">
      <div className="mx-auto min-h-screen max-w-[1900px] px-5 py-6 md:px-10 md:py-8">

        {/* ENCABEZADO */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-6">

          <div>
            <p className="text-sm font-black uppercase tracking-[0.35em] text-violet-400">
              DHTime
            </p>

            <h1 className="mt-2 text-3xl font-black md:text-5xl">
              ENTREGA DE KITS
            </h1>

            <p className="mt-2 text-lg font-semibold text-white/50 md:text-xl">
              {tituloEvento}
            </p>
          </div>

          <div className="flex items-center gap-5">

            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                Llamados pendientes
              </p>

              <p className="text-4xl font-black tabular-nums text-emerald-400 md:text-6xl">
                {participantes.length}
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 md:flex">
              <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-sm font-bold text-emerald-300">
                EN VIVO
              </span>
            </div>

            <button
              onClick={pantallaCompleta}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold transition hover:bg-white/10"
            >
              Pantalla completa
            </button>

          </div>
        </header>

        {/* ENCABEZADOS DE COLUMNAS */}
        <div className="mb-4 hidden grid-cols-[230px_1fr_330px] gap-5 px-6 md:grid">
          <p className="text-sm font-black tracking-widest text-white/40">
            NÚMERO
          </p>

          <p className="text-sm font-black tracking-widest text-white/40">
            COMPETIDOR
          </p>

          <p className="text-sm font-black tracking-widest text-white/40">
            DIRÍGETE A
          </p>
        </div>

        {/* ESTADOS */}
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <p className="text-2xl font-bold text-white/50">
              Conectando con el tablero...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-8 text-center">
            <p className="text-xl font-bold text-red-300">
              {error}
            </p>
          </div>
        ) : !sessionActive ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <div className="text-7xl">📦</div>

            <h2 className="mt-6 text-3xl font-black md:text-5xl">
              ENTREGA DE KITS
            </h2>

            <p className="mt-3 text-xl text-white/45">
              Esperando el inicio de una sesión de entrega
            </p>
          </div>
        ) : participantes.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <div className="text-7xl">🏁</div>

            <h2 className="mt-6 text-3xl font-black md:text-5xl">
              SIN LLAMADOS PENDIENTES
            </h2>

            <p className="mt-3 text-xl text-white/45">
              Los competidores aparecerán aquí al pasar por recepción
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">

            {participantes.map((item) => (
              <article
                key={item.id}
                className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-white/10 bg-[#171820] p-5 shadow-xl shadow-black/20 transition-all duration-300 md:grid-cols-[230px_1fr_330px] md:gap-5 md:px-6 md:py-5"
              >

                {/* NÚMERO */}
                <div>
                  <p className="mb-1 text-xs font-bold tracking-widest text-violet-300 md:hidden">
                    NÚMERO
                  </p>

                  <p className="text-5xl font-black tabular-nums text-white md:text-7xl">
                    #{item.Bib ?? "--"}
                  </p>
                </div>

                {/* NOMBRE */}
                <div className="min-w-0">
                  <p className="mb-1 text-xs font-bold tracking-widest text-white/40 md:hidden">
                    COMPETIDOR
                  </p>

                  <p className="break-words text-xl font-black uppercase leading-tight text-white md:text-3xl">
                    {item.Participant || "SIN NOMBRE"}
                  </p>
                </div>

                {/* MESA */}
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-center md:px-4 md:py-5">
                  <p className="text-xs font-black tracking-widest text-emerald-300/70">
                    DIRÍGETE A
                  </p>

                  <p className="mt-1 text-2xl font-black uppercase text-emerald-300 md:text-4xl">
                    {item.mesaNombre || "MESA"}
                  </p>
                </div>

              </article>
            ))}

          </div>
        )}

        {/* PIE */}
        <footer className="mt-10 border-t border-white/10 pt-5 text-center">
          <p className="text-xs font-semibold tracking-widest text-white/25">
            DHTime · SISTEMA DE ENTREGA DE KITS
          </p>
        </footer>

      </div>
    </main>
  );
}
