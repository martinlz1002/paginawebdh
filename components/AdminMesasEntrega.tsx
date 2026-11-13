import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  createEntregaSalt,
  getMesaForBib,
  hashEntregaPin,
  normalizeBib,
  validateMesaRanges,
  type MesaRange,
} from "@/lib/entregaKits";

const CONFIG_REF = doc(db, "configuracionEntrega", "active");
const PUBLIC_COMPETITORS_REF = collection(
  db,
  "busquedaCompetidor",
  "active",
  "publicCompetidores"
);

type PublicCompetitor = {
  Bib?: string | number;
  estadoEntrega?: "pendiente" | "en_proceso" | "entregado" | string;
  mesaId?: string | null;
  mesaNombre?: string | null;
};

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
  const [competitors, setCompetitors] = useState<PublicCompetitor[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");

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
        setMessage(
          "No se pudo cargar la configuración. Verifica tus permisos de administrador."
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  // Estadísticas en vivo basadas en la proyección pública de competidores.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    const start = () => {
      unsubscribe = onSnapshot(
        PUBLIC_COMPETITORS_REF,
        (snapshot) => {
          if (!active) return;
          setCompetitors(
            snapshot.docs.map((item) => item.data() as PublicCompetitor)
          );
          setStatsError("");
          setLoadingStats(false);
        },
        (error) => {
          console.error("Error cargando estadísticas de entrega:", error);
          if (!active) return;
          setStatsError(
            "No se pudieron cargar las estadísticas. Revisa los permisos de lectura de publicCompetidores."
          );
          setLoadingStats(false);
        }
      );
    };

    start();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const updateRange = (
    index: number,
    field: keyof MesaRange,
    value: string
  ) => {
    setRanges((current) =>
      current.map((range, i) =>
        i === index
          ? {
              ...range,
              [field]:
                field === "nombre" || field === "id" ? value : Number(value),
            }
          : range
      )
    );
  };

  const addRange = () => {
    const nextNumber = ranges.length + 1;
    const nextBib =
      Math.max(0, ...ranges.map((range) => Number(range.hasta) || 0)) + 1;

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

  const stats = useMemo(() => {
    const result = {
      total: competitors.length,
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

    competitors.forEach((competitor) => {
      const bib = normalizeBib(competitor.Bib);
      const mesa = Number.isFinite(bib)
        ? getMesaForBib(ranges, bib)
        : undefined;

      if (!mesa) {
        result.sinRango += 1;
      }

      const estado = competitor.estadoEntrega || "pendiente";

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
      porcentaje:
        mesa.total > 0
          ? Math.round((mesa.entregados / mesa.total) * 100)
          : 0,
    }));

    return {
      ...result,
      porcentaje:
        result.total > 0
          ? Math.round((result.entregados / result.total) * 100)
          : 0,
    };
  }, [competitors, ranges]);

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
      const invalid = competitors
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
        totalCompetidores: competitors.filter((item) => {
          const bib = normalizeBib(item.Bib);
          return (
            Number.isFinite(bib) &&
            bib >= range.desde &&
            bib <= range.hasta
          );
        }).length,
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
      setMessage(
        `Configuración guardada correctamente. ${competitors.length} competidores distribuidos en ${ranges.length} mesa(s).`
      );
    } catch (error: any) {
      console.error("Error guardando configuración de mesas:", error);
      setMessage(
        error?.message ||
          "No se pudo guardar la configuración. Revisa los permisos de Firestore."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-dh-muted">
        Cargando configuración de mesas...
      </div>
    );
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
      <div
        className={`rounded-2xl border ${tones[tone]} bg-dh-panel p-5`}
      >
        <p className="text-sm text-dh-muted">{label}</p>
        <p className="mt-2 text-3xl font-black tabular-nums">
          {typeof value === "number"
            ? value.toLocaleString("es-MX")
            : value}
        </p>
        <p className="mt-1 text-xs text-dh-muted">{detail}</p>
      </div>
    );
  };

  return (
    <section className="max-w-5xl space-y-6 text-dh-ink">
      <div>
        <h2 className="text-2xl font-black">
          Configuración y resultados de entrega
        </h2>
        <p className="mt-2 text-sm text-dh-muted">
          Administra los rangos de entrega y monitorea el avance de cada mesa
          en tiempo real.
        </p>
      </div>

      {/* PANEL DE RESULTADOS */}
      <div className="space-y-4 rounded-2xl border border-dh-border bg-dh-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Resultados en vivo</h3>
            <p className="mt-1 text-xs text-dh-muted">
              Los indicadores se actualizan automáticamente desde Firestore.
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
            ● Actualización en tiempo real
          </span>
        </div>

        {loadingStats ? (
          <p className="py-6 text-center text-sm text-dh-muted">
            Cargando estadísticas...
          </p>
        ) : statsError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">
            {statsError}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total de competidores"
                value={stats.total}
                detail="Publicados en el evento activo"
                tone="neutral"
              />
              <StatCard
                label="Pendientes"
                value={stats.pendientes}
                detail="Aún no han pasado por recepción"
                tone="amber"
              />
              <StatCard
                label="En proceso"
                value={stats.enProceso}
                detail="Asignados a una mesa"
                tone="blue"
              />
              <StatCard
                label="Entregados"
                value={stats.entregados}
                detail={`${stats.porcentaje}% del total completado`}
                tone="green"
              />
            </div>

            <div className="rounded-xl border border-dh-border bg-dh-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">Avance general</p>
                  <p className="text-xs text-dh-muted">
                    {stats.entregados} de {stats.total} kits entregados
                  </p>
                </div>
                <p className="text-2xl font-black tabular-nums">
                  {stats.porcentaje}%
                </p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${stats.porcentaje}%` }}
                />
              </div>
              {stats.sinRango > 0 && (
                <p className="mt-3 text-xs font-medium text-amber-600">
                  Atención: {stats.sinRango} competidor(es) no tienen un Bib
                  válido o no pertenecen a ningún rango configurado.
                </p>
              )}
            </div>

            <div>
              <h4 className="mb-3 font-bold">Avance por mesa</h4>
              {stats.mesas.length === 0 ? (
                <p className="text-sm text-dh-muted">
                  Configura primero los rangos de las mesas.
                </p>
              ) : (
                <div className="space-y-4">
                  {stats.mesas.map((mesa) => (
                    <div
                      key={mesa.id}
                      className="rounded-xl border border-dh-border bg-dh-soft p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-bold">{mesa.nombre}</p>
                          <p className="text-xs text-dh-muted">
                            Bib {mesa.desde} al {mesa.hasta} · {mesa.total}{" "}
                            competidores
                          </p>
                        </div>
                        <p className="text-lg font-black tabular-nums">
                          {mesa.porcentaje}%
                        </p>
                      </div>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${mesa.porcentaje}%` }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-amber-500/10 p-2">
                          <p className="text-lg font-bold text-amber-600">
                            {mesa.pendientes}
                          </p>
                          <p className="text-dh-muted">Pendientes</p>
                        </div>
                        <div className="rounded-lg bg-blue-500/10 p-2">
                          <p className="text-lg font-bold text-blue-600">
                            {mesa.enProceso}
                          </p>
                          <p className="text-dh-muted">En proceso</p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/10 p-2">
                          <p className="text-lg font-bold text-emerald-600">
                            {mesa.entregados}
                          </p>
                          <p className="text-dh-muted">Entregados</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* CONFIGURACIÓN DE MESAS */}
      <div>
        <h3 className="text-xl font-black">Rangos de competidores</h3>
        <p className="mt-1 text-sm text-dh-muted">
          Define qué números Bib atenderá cada mesa. Recepción asignará
          automáticamente al competidor según su número.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-dh-border bg-dh-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Mesas configuradas</h3>
          <button
            onClick={addRange}
            className="rounded-xl bg-dh-purple px-4 py-2 text-sm font-bold text-dh-dark"
          >
            + Agregar mesa
          </button>
        </div>

        {ranges.map((range, index) => (
          <div
            key={range.id}
            className="grid grid-cols-1 items-end gap-3 rounded-xl bg-dh-soft p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]"
          >
            <label className="text-sm font-semibold">
              Nombre de mesa
              <input
                value={range.nombre}
                onChange={(event) =>
                  updateRange(index, "nombre", event.target.value)
                }
                className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold">
              Desde
              <input
                type="number"
                min="1"
                value={range.desde}
                onChange={(event) =>
                  updateRange(index, "desde", event.target.value)
                }
                className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold">
              Hasta
              <input
                type="number"
                min="1"
                value={range.hasta}
                onChange={(event) =>
                  updateRange(index, "hasta", event.target.value)
                }
                className="mt-1 w-full rounded-lg border border-dh-border bg-dh-panel px-3 py-2"
              />
            </label>
            <button
              onClick={() => removeRange(index)}
              disabled={ranges.length === 1}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-30"
            >
              Eliminar
            </button>
            <p className="text-xs text-dh-muted md:col-span-4">
              {stats.mesas.find((mesa) => mesa.id === range.id)?.total ?? 0}{" "}
              competidores dentro de este rango según la publicación actual.
            </p>
          </div>
        ))}
        <p className="text-xs text-dh-muted">
          Los rangos no pueden encimarse y todos los competidores publicados
          deben quedar dentro de uno.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-dh-border bg-dh-panel p-5">
        <h3 className="font-bold">PIN de las estaciones</h3>
        <p className="text-sm text-dh-muted">
          {configured
            ? "Introduce un PIN nuevo para reemplazar el actual."
            : "Define el PIN que utilizarán recepción y las mesas."}
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(event) =>
            setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
          }
          placeholder="PIN de 4 a 8 dígitos"
          className="w-full max-w-sm rounded-xl border border-dh-border bg-dh-soft px-4 py-3 tracking-[0.35em]"
        />
        <p className="text-xs text-dh-muted">
          El PIN funciona como control operativo de la interfaz. Al no usar
          backend, no es una barrera de seguridad contra alguien que inspeccione
          el navegador o Firestore.
        </p>
      </div>

      {configured && origin && (
        <div className="space-y-3 rounded-2xl border border-dh-border bg-dh-panel p-5">
          <h3 className="font-bold">Enlaces de las estaciones</h3>
          <div className="rounded-lg bg-dh-soft p-3">
            <p className="text-sm font-semibold">Recepción</p>
            <a
              className="break-all text-xs text-dh-purple underline"
              href={`${origin}/buscar-competidor`}
              target="_blank"
              rel="noreferrer"
            >
              {origin}/buscar-competidor
            </a>
          </div>
          {ranges.map((range) => (
            <div key={range.id} className="rounded-lg bg-dh-soft p-3">
              <p className="text-sm font-semibold">{range.nombre}</p>
              <a
                className="break-all text-xs text-dh-purple underline"
                href={`${origin}/entrega-kits?mesa=${encodeURIComponent(
                  range.id
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                {origin}/entrega-kits?mesa={range.id}
              </a>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className="rounded-xl bg-dh-soft p-3 text-sm">{message}</div>
      )}

      <button
        onClick={save}
        disabled={saving || !pin || ranges.length === 0}
        className="rounded-xl bg-dh-purple px-6 py-3 font-bold text-dh-dark disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar configuración"}
      </button>
    </section>
  );
}
