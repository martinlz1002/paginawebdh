import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";

interface Organizador {
  id: string;
  nombre: string;
  email: string;
  connectedAccountId?: string;
  stripeStatus?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  activo?: boolean;
  currentlyDue?: string[];
  eventuallyDue?: string[];
  disabledReason?: string | null;
}

export default function AdminOrganizadores() {
  const [organizadores, setOrganizadores] =
    useState<Organizador[]>([]);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] =
    useState(true);

  const [actualizandoId, setActualizandoId] =
    useState<string | null>(null);

  const [generandoLinkId, setGenerandoLinkId] =
    useState<string | null>(null);

  const [enlacesStripe, setEnlacesStripe] =
    useState<Record<string, string>>({});

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ============================================================
  // CARGAR ORGANIZADORES
  // ============================================================

  const cargarOrganizadores = async () => {
    try {
      setLoadingList(true);
      setError("");

      const snap = await getDocs(
        collection(db, "organizadores")
      );

      const lista: Organizador[] =
        snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<
            Organizador,
            "id"
          >),
        }));

      lista.sort((a, b) =>
        a.nombre.localeCompare(
          b.nombre,
          "es"
        )
      );

      setOrganizadores(lista);
    } catch (err: any) {
      console.error(
        "Error cargando organizadores:",
        err
      );

      setError(
        err?.message ||
          "No fue posible cargar los organizadores."
      );
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    cargarOrganizadores();
  }, []);

  // ============================================================
  // CREAR ORGANIZADOR
  // ============================================================

  const crearOrganizador = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const nombreLimpio =
      nombre.trim();

    const emailLimpio =
      email.trim().toLowerCase();

    if (!nombreLimpio) {
      setError(
        "Escribe el nombre del organizador."
      );
      return;
    }

    if (!emailLimpio) {
      setError(
        "Escribe el correo del organizador."
      );
      return;
    }

    try {
      setLoading(true);

      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error(
          "Tu sesión de administrador no está disponible."
        );
      }

      const token =
        await user.getIdToken(true);

      const response =
        await fetch(
          "/api/admin/organizers/create",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              nombre:
                nombreLimpio,

              email:
                emailLimpio,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.ok
      ) {
        throw new Error(
          data?.error ||
            "No fue posible crear el organizador."
        );
      }

      setNombre("");
      setEmail("");

      setSuccess(
        "Organizador creado correctamente."
      );

      await cargarOrganizadores();

    } catch (err: any) {
      console.error(
        "Error creando organizador:",
        err
      );

      setError(
        err?.message ||
          "Error creando el organizador."
      );

    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ACTUALIZAR ESTADO STRIPE
  // ============================================================

  const actualizarEstadoStripe =
    async (
      organizerId: string
    ) => {
      try {
        setError("");
        setSuccess("");

        setActualizandoId(
          organizerId
        );

        const auth =
          getAuth();

        const user =
          auth.currentUser;

        if (!user) {
          throw new Error(
            "Tu sesión de administrador no está disponible."
          );
        }

        const token =
          await user.getIdToken(true);

        const response =
          await fetch(
            "/api/admin/organizers/status",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                organizerId,
              }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data?.error ||
              "No fue posible actualizar el estado."
          );
        }

        await cargarOrganizadores();

        setSuccess(
          "Estado de Stripe actualizado correctamente."
        );

      } catch (err: any) {
        console.error(
          "Error actualizando estado Stripe:",
          err
        );

        setError(
          err?.message ||
            "Error actualizando el estado de Stripe."
        );

      } finally {
        setActualizandoId(null);
      }
    };

  // ============================================================
  // GENERAR ENLACE DE ONBOARDING STRIPE
  // ============================================================

  const generarEnlaceStripe =
    async (
      organizador: Organizador
    ) => {
      setError("");
      setSuccess("");

      try {
        setGenerandoLinkId(
          organizador.id
        );

        const auth =
          getAuth();

        const user =
          auth.currentUser;

        if (!user) {
          throw new Error(
            "Tu sesión de administrador no está disponible."
          );
        }

        const token =
          await user.getIdToken(true);

        const response =
          await fetch(
            "/api/admin/organizers/onboarding",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                organizerId:
                  organizador.id,
              }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data?.error ||
              "No fue posible generar el enlace de Stripe."
          );
        }

        if (
          typeof data.url !== "string" ||
          !data.url
        ) {
          throw new Error(
            "Stripe no devolvió un enlace válido."
          );
        }

        setEnlacesStripe(
          (prev) => ({
            ...prev,
            [organizador.id]:
              data.url,
          })
        );

        setSuccess(
          `Enlace de Stripe generado para ${organizador.nombre}.`
        );

      } catch (err: any) {
        console.error(
          "Error generando enlace Stripe:",
          err
        );

        setError(
          err?.message ||
            "Error generando el enlace de Stripe."
        );

      } finally {
        setGenerandoLinkId(null);
      }
    };

  // ============================================================
  // COPIAR ENLACE
  // ============================================================

  const copiarEnlaceStripe =
    async (
      organizerId: string
    ) => {
      const url =
        enlacesStripe[
          organizerId
        ];

      if (!url) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          url
        );

        setError("");

        setSuccess(
          "Enlace de Stripe copiado al portapapeles."
        );

      } catch (err) {
        console.error(
          "Error copiando enlace:",
          err
        );

        setError(
          "No fue posible copiar el enlace automáticamente. Puedes seleccionarlo y copiarlo manualmente."
        );
      }
    };

  // ============================================================
  // ESTADO VISUAL
  // ============================================================

  const obtenerEstado = (
    organizador: Organizador
  ) => {
    if (
      organizador.chargesEnabled &&
      organizador.payoutsEnabled
    ) {
      return {
        texto: "Activo",
        clase:
          "bg-green-500/10 text-green-400 border-green-500/20",
      };
    }

    if (
      organizador.detailsSubmitted &&
      (
        !organizador.chargesEnabled ||
        !organizador.payoutsEnabled
      )
    ) {
      return {
        texto: "Acción requerida",
        clase:
          "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      };
    }

    if (
      organizador.stripeStatus ===
      "creating"
    ) {
      return {
        texto:
          "Creando Stripe...",
        clase:
          "bg-blue-500/10 text-blue-400 border-blue-500/20",
      };
    }

    if (
      organizador.stripeStatus ===
      "error"
    ) {
      return {
        texto: "Error",
        clase:
          "bg-red-500/10 text-red-400 border-red-500/20",
      };
    }

    if (
      organizador.stripeStatus ===
      "onboarding"
    ) {
      return {
        texto:
          "Configuración pendiente",
        clase:
          "bg-dh-purple/10 text-dh-purpleLight border-dh-purple/20",
      };
    }

    return {
      texto: "Pendiente",
      clase:
        "bg-white/5 text-white/50 border-white/10",
    };
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-8">

      {/* ====================================================== */}
      {/* ENCABEZADO */}
      {/* ====================================================== */}

      <div>
        <h2 className="text-3xl font-extrabold text-white">
          Organizadores
        </h2>

        <p className="mt-2 text-white/50">
          Administra los organizadores externos y
          sus cuentas de Stripe Connect.
        </p>
      </div>

      {/* ====================================================== */}
      {/* MENSAJES */}
      {/* ====================================================== */}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      )}

      {/* ====================================================== */}
      {/* CREAR ORGANIZADOR */}
      {/* ====================================================== */}

      <section className="rounded-2xl border border-white/5 bg-dh-panel p-6 shadow-dh">

        <h3 className="text-xl font-bold text-white">
          Nuevo organizador
        </h3>

        <p className="mt-1 text-sm text-white/50">
          Primero crearemos su cuenta Express de
          Stripe. Después podrás enviarle el enlace
          para completar sus datos.
        </p>

        <form
          onSubmit={
            crearOrganizador
          }
          className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto]"
        >

          {/* NOMBRE */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-white/80">
              Nombre
            </label>

            <input
              value={nombre}
              onChange={(e) =>
                setNombre(
                  e.target.value
                )
              }
              placeholder="Ej. Juan Pérez"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-dh-purple focus:ring-2 focus:ring-dh-purple/20"
              disabled={loading}
            />
          </div>

          {/* CORREO */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-white/80">
              Correo
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              placeholder="organizador@ejemplo.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-dh-purple focus:ring-2 focus:ring-dh-purple/20"
              disabled={loading}
            />
          </div>

          {/* BOTÓN */}

          <div className="flex items-end">

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-dh-purple px-6 py-3 font-bold text-white transition hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(126,87,194,0.25)] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              {loading
                ? "Creando..."
                : "Crear organizador"}
            </button>

          </div>

        </form>

      </section>

      {/* ====================================================== */}
      {/* LISTA */}
      {/* ====================================================== */}

      <section className="rounded-2xl border border-white/5 bg-dh-panel p-6 shadow-dh">

        <div className="mb-5 flex items-center justify-between">

          <div>
            <h3 className="text-xl font-bold text-white">
              Organizadores registrados
            </h3>

            <p className="text-sm text-white/40">
              {organizadores.length}{" "}
              {organizadores.length === 1
                ? "organizador"
                : "organizadores"}
            </p>
          </div>

          <button
            type="button"
            onClick={
              cargarOrganizadores
            }
            disabled={loadingList}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            {loadingList
              ? "Cargando..."
              : "↻ Actualizar"}
          </button>

        </div>

        {/* ==================================================== */}
        {/* CARGANDO */}
        {/* ==================================================== */}

        {loadingList ? (

          <div className="py-12 text-center text-white/40">
            Cargando organizadores...
          </div>

        ) : organizadores.length === 0 ? (

          <div className="rounded-xl border border-dashed border-white/10 py-12 text-center text-white/40">
            No hay organizadores registrados todavía.
          </div>

        ) : (

          <div className="space-y-4">

            {organizadores.map(
              (organizador) => {

                const estado =
                  obtenerEstado(
                    organizador
                  );

                const actualizando =
                  actualizandoId ===
                  organizador.id;

                const generandoLink =
                  generandoLinkId ===
                  organizador.id;

                const stripeActivo =
                  organizador.chargesEnabled === true &&
                  organizador.payoutsEnabled === true;

                const enlaceStripe =
                  enlacesStripe[
                    organizador.id
                  ];

                return (
                  <div
                    key={
                      organizador.id
                    }
                    className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-white/10 hover:bg-white/[0.035]"
                  >

                    {/* ======================================== */}
                    {/* CABECERA */}
                    {/* ======================================== */}

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                      <div>

                        <div className="flex flex-wrap items-center gap-3">

                          <h4 className="text-lg font-bold text-white">
                            {organizador.nombre}
                          </h4>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${estado.clase}`}
                          >
                            {estado.texto}
                          </span>

                        </div>

                        <p className="mt-1 text-sm text-white/50">
                          {organizador.email}
                        </p>

                        {organizador.connectedAccountId && (
                          <p className="mt-2 font-mono text-xs text-white/25">
                            {organizador.connectedAccountId}
                          </p>
                        )}

                      </div>

                      {/* ====================================== */}
                      {/* BOTONES */}
                      {/* ====================================== */}

                      <div className="flex flex-wrap gap-2">

                        {/* ACTUALIZAR ESTADO */}

                        <button
                          type="button"
                          onClick={() =>
                            actualizarEstadoStripe(
                              organizador.id
                            )
                          }
                          disabled={
                            actualizando ||
                            generandoLink
                          }
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actualizando
                            ? "Consultando Stripe..."
                            : "↻ Actualizar estado"}
                        </button>

                        {/* GENERAR ENLACE STRIPE */}

                        {!stripeActivo && (
                          <button
                            type="button"
                            onClick={() =>
                              generarEnlaceStripe(
                                organizador
                              )
                            }
                            disabled={
                              actualizando ||
                              generandoLink
                            }
                            className="rounded-xl bg-dh-purple px-5 py-2.5 text-sm font-bold text-white transition hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(126,87,194,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {generandoLink
                              ? "Generando enlace..."
                              : "Generar enlace Stripe"}
                          </button>
                        )}

                      </div>

                    </div>

                    {/* ======================================== */}
                    {/* ENLACE GENERADO */}
                    {/* ======================================== */}

                    {enlaceStripe && (
                      <div className="mt-5 rounded-xl border border-dh-purple/20 bg-dh-purple/5 p-4">

                        <div className="flex flex-col gap-3">

                          <div>
                            <p className="text-sm font-bold text-white">
                              Enlace para el organizador
                            </p>

                            <p className="mt-1 text-xs text-white/50">
                              Envíale este enlace a{" "}
                              <strong className="text-white/80">
                                {organizador.nombre}
                              </strong>{" "}
                              para que complete su configuración de Stripe.
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row">

                            <input
                              type="text"
                              readOnly
                              value={
                                enlaceStripe
                              }
                              onFocus={(e) =>
                                e.target.select()
                              }
                              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs text-white/70 outline-none transition focus:border-dh-purple"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                copiarEnlaceStripe(
                                  organizador.id
                                )
                              }
                              className="rounded-xl bg-dh-purple px-5 py-3 text-sm font-bold text-white transition hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(126,87,194,0.3)]"
                            >
                              📋 Copiar enlace
                            </button>

                          </div>

                          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">

                            <p className="text-xs text-yellow-300">
                              ⚠️ Este enlace de Stripe es temporal y de un solo uso. Si deja de funcionar, genera un nuevo enlace.
                            </p>

                          </div>

                        </div>

                      </div>
                    )}

                    {/* ======================================== */}
                    {/* ESTADO DETALLADO */}
                    {/* ======================================== */}

                    <div className="mt-4 grid gap-3 border-t border-white/5 pt-4 sm:grid-cols-3">

                      {/* DATOS */}

                      <div>
                        <p className="text-xs text-white/30">
                          Datos enviados
                        </p>

                        <p className="mt-1 text-sm font-semibold text-white/80">
                          {organizador.detailsSubmitted
                            ? "✓ Sí"
                            : "Pendiente"}
                        </p>
                      </div>

                      {/* COBROS */}

                      <div>
                        <p className="text-xs text-white/30">
                          Cobros
                        </p>

                        <p className="mt-1 text-sm font-semibold text-white/80">
                          {organizador.chargesEnabled
                            ? "✓ Habilitados"
                            : "Pendientes"}
                        </p>
                      </div>

                      {/* RETIROS */}

                      <div>
                        <p className="text-xs text-white/30">
                          Retiros
                        </p>

                        <p className="mt-1 text-sm font-semibold text-white/80">
                          {organizador.payoutsEnabled
                            ? "✓ Habilitados"
                            : "Pendientes"}
                        </p>
                      </div>

                    </div>

                    {/* ======================================== */}
                    {/* REQUISITOS PENDIENTES */}
                    {/* ======================================== */}

                    {organizador.currentlyDue &&
                      organizador.currentlyDue.length > 0 && (

                        <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">

                          <p className="text-sm font-bold text-yellow-300">
                            Stripe tiene información pendiente
                          </p>

                          <p className="mt-1 text-xs text-yellow-200/70">
                            Hay{" "}
                            {
                              organizador
                                .currentlyDue
                                .length
                            }{" "}
                            requisito(s) pendiente(s).
                          </p>

                        </div>

                      )}

                    {/* ======================================== */}
                    {/* CUENTA DESHABILITADA */}
                    {/* ======================================== */}

                    {organizador.disabledReason && (

                      <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">

                        <p className="text-sm font-bold text-red-300">
                          Stripe reporta una restricción
                        </p>

                        <p className="mt-1 text-xs text-red-200/70">
                          {organizador.disabledReason}
                        </p>

                      </div>

                    )}

                  </div>
                );
              }
            )}

          </div>

        )}

      </section>

    </div>
  );
}