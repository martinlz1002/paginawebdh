import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ensureEntregaAuth,
  loadEntregaConfig,
  verifyEntregaPin,
} from "@/lib/entregaKits";

type Delivery = {
  competitorId: string;
  estadoEntrega: string;
  mesaId: string;
  mesaNombre: string;
  Bib?: string | number;
  Participant?: string;
  RouteName?: string;
  CategoryName?: string;
  talla?: string;
  details?: Record<string, any>;
  [key: string]: any;
};

export default function EntregaKitsPage() {
  const router = useRouter();

  const mesaId =
    typeof router.query.mesa === "string" ? router.query.mesa : "";
  const sessionId =
    typeof router.query.session === "string" ? router.query.session : "";

  const [pin, setPin] = useState("");
  const [items, setItems] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    ensureEntregaAuth()
      .then(() => {
        if (active) setAuthReady(true);
      })
      .catch((error) => {
        console.error("No se pudo iniciar la sesión de estación:", error);
        if (active) {
          setMessage("No se pudo iniciar la estación. Recarga la página.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!router.isReady || !mesaId || !sessionId || !authReady) return;

    setLoading(true);
    setSessionValid(null);
    setMessage("");

    const sessionRef = doc(db, "entregasKits", sessionId);
    const participantsRef = collection(
      db,
      "entregasKits",
      sessionId,
      "participantes"
    );

    let unsubscribeParticipants: (() => void) | undefined;

    const unsubscribeSession = onSnapshot(
      sessionRef,
      (sessionSnapshot) => {
        if (!sessionSnapshot.exists() || sessionSnapshot.data().estado !== "activa") {
          setSessionValid(false);
          setItems([]);
          setLoading(false);
          setMessage("Esta sesión de entrega ya no está activa.");
          unsubscribeParticipants?.();
          return;
        }

        setSessionValid(true);

        if (!unsubscribeParticipants) {
          const deliveriesQuery = query(
            participantsRef,
            where("mesaId", "==", mesaId)
          );

          unsubscribeParticipants = onSnapshot(
            deliveriesQuery,
            (snapshot) => {
              const rows = snapshot.docs
                .map((item) => ({
                  ...(item.data() as Delivery),
                  competitorId: item.id,
                }))
                .filter((item) => item.estadoEntrega === "en_proceso")
                .sort(
                  (a, b) =>
                    Number(a.Bib ?? 0) - Number(b.Bib ?? 0)
                );

              setItems(rows);
              setLoading(false);
            },
            (error) => {
              console.error("Error escuchando participantes de mesa:", error);
              setMessage(
                "No se pudieron cargar los competidores. Revisa los permisos de Firestore."
              );
              setLoading(false);
            }
          );
        }
      },
      (error) => {
        console.error("Error verificando sesión de entrega:", error);
        setMessage("No se pudo verificar la sesión de entrega.");
        setSessionValid(false);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeSession();
      unsubscribeParticipants?.();
    };
  }, [router.isReady, mesaId, sessionId, authReady]);

  const entregar = async (id: string) => {
    if (!sessionId || !mesaId) {
      setMessage("El enlace de esta estación está incompleto.");
      return;
    }

    if (!/^\d{4,8}$/.test(pin)) {
      setMessage("Ingresa el PIN de 4 a 8 dígitos.");
      return;
    }

    setBusyId(id);
    setMessage("");

    try {
      const config = await loadEntregaConfig();

      if (!config || config.id !== sessionId) {
        throw new Error("Esta estación no corresponde a la sesión activa.");
      }

      if (!(await verifyEntregaPin(pin, config))) {
        throw new Error("PIN incorrecto.");
      }

      const sessionRef = doc(db, "entregasKits", sessionId);
      const participantRef = doc(
        db,
        "entregasKits",
        sessionId,
        "participantes",
        id
      );
      const controlRef = doc(db, "entregasKitsControl", "active");

      await runTransaction(db, async (transaction) => {
        const sessionSnapshot = await transaction.get(sessionRef);
        const controlSnapshot = await transaction.get(controlRef);
        const participantSnapshot = await transaction.get(participantRef);

        if (!sessionSnapshot.exists() || sessionSnapshot.data().estado !== "activa") {
          throw new Error("La sesión de entrega ya no está activa.");
        }

        if (
          !controlSnapshot.exists() ||
          controlSnapshot.data().sessionId !== sessionId
        ) {
          throw new Error("Esta ya no es la sesión activa.");
        }

        if (!participantSnapshot.exists()) {
          throw new Error("El participante ya no existe en esta sesión.");
        }

        const participant = participantSnapshot.data();

        if (participant.mesaId !== mesaId) {
          throw new Error("Este competidor pertenece a otra mesa.");
        }

        if (participant.estadoEntrega !== "en_proceso") {
          throw new Error("Este kit ya fue entregado o cambió de estado.");
        }

        transaction.update(participantRef, {
          estadoEntrega: "entregado",
          entregadoAt: serverTimestamp(),
        });
      });

      setItems((current) =>
        current.filter((item) => item.competitorId !== id)
      );
      setMessage("Entrega registrada correctamente.");
    } catch (error: any) {
      console.error("Error registrando entrega:", error);
      setMessage(error?.message || "No se pudo registrar la entrega.");
    } finally {
      setBusyId("");
    }
  };

  const title = useMemo(
    () =>
      items[0]?.mesaNombre ||
      (mesaId ? mesaId.replaceAll("-", " ") : "Mesa de entrega"),
    [items, mesaId]
  );

  if (!router.isReady) {
    return (
      <main className="min-h-screen bg-[#0c0c0f] p-8 text-white">
        Cargando estación...
      </main>
    );
  }

  if (!mesaId || !sessionId) {
    return (
      <main className="min-h-screen bg-[#0c0c0f] p-8 text-white">
        Enlace incompleto. Solicita al administrador el enlace actualizado de tu mesa.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0c0c0f] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-violet-400">
              DHTime · Entrega de kits
            </p>
            <h1 className="mt-1 text-3xl font-black">{title}</h1>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <div className="text-2xl font-black">{items.length}</div>
            <div className="text-xs text-white/50">En espera de entrega</div>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="block text-sm font-semibold">
            PIN de la estación
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
              }
              placeholder="Ingresa el PIN"
              className="mt-2 w-full max-w-xs rounded-xl border border-white/10 bg-black/30 px-4 py-3 tracking-[0.35em] outline-none focus:border-violet-400"
            />
          </label>
          <p className="mt-2 text-xs text-white/45">
            El PIN se solicita para confirmar cada entrega.
          </p>
        </section>

        {message && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
            {message}
          </div>
        )}

        {loading || !authReady || sessionValid === null ? (
          <p className="py-12 text-center text-white/50">
            Conectando con la estación...
          </p>
        ) : sessionValid === false ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <div className="text-4xl">⏸️</div>
            <h2 className="mt-3 text-xl font-bold">Sesión no disponible</h2>
            <p className="mt-1 text-sm text-white/50">
              Solicita al administrador un enlace de una sesión activa.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <div className="text-4xl">📦</div>
            <h2 className="mt-3 text-xl font-bold">Sin entregas pendientes</h2>
            <p className="mt-1 text-sm text-white/50">
              Los competidores aparecerán aquí cuando recepción los marque como encontrados.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const bib = item.Bib ?? "-";
              const participant = item.Participant || "Sin nombre";
              const routeName = item.RouteName || "";
              const categoryName = item.CategoryName || "";
              const talla =
                item.talla ??
                Object.entries(item).find(([key]) =>
                  /talla|playera|camiseta/i.test(key)
                )?.[1];

              const details =
                item.details && typeof item.details === "object"
                  ? Object.entries(item.details).filter(
                      ([key, value]) =>
                        !/participant|bib|routename|categoryname|talla|playera|camiseta/i.test(
                          key
                        ) &&
                        value !== undefined &&
                        value !== null &&
                        String(value).trim() !== ""
                    )
                  : [];

              return (
                <article
                  key={item.competitorId}
                  className="rounded-2xl border border-violet-400/20 bg-white/[0.04] p-5 shadow-lg shadow-black/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-violet-300">
                        NÚMERO
                      </p>
                      <p className="text-4xl font-black">#{bib}</p>
                    </div>
                    <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-300">
                      EN PROCESO
                    </span>
                  </div>

                  <h2 className="mt-3 text-xl font-extrabold">
                    {participant}
                  </h2>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-xs text-white/45">Playera</p>
                      <p className="text-2xl font-black text-emerald-300">
                        {talla ? String(talla) : "Sin dato"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-xs text-white/45">Categoría</p>
                      <p className="mt-1 font-bold">{categoryName || "-"}</p>
                    </div>
                  </div>

                  {routeName && (
                    <p className="mt-3 text-sm text-white/60">
                      Ruta: {routeName}
                    </p>
                  )}

                  {details.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {details.map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-lg bg-white/5 p-2"
                        >
                          <p className="text-[11px] text-white/40">{key}</p>
                          <p className="break-words text-sm font-semibold">
                            {String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => entregar(item.competitorId)}
                    disabled={busyId === item.competitorId || pin.length < 4}
                    className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 font-extrabold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyId === item.competitorId
                      ? "Registrando..."
                      : "Marcar como entregado"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
