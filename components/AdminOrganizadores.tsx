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

        // Recargamos Firestore para mostrar
        // inmediatamente la información actualizada.
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
  // ABRIR ONBOARDING STRIPE
  // ============================================================

  const abrirOnboarding =
    async (
      organizador: Organizador
    ) => {
      setError("");
      setSuccess("");

      try {
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

        /*
         * Stripe nos devuelve un Account Link.
         *
         * El administrador será enviado al
         * onboarding de Stripe.
         */
        window.location.href =
          data.url;

      } catch (err: any) {
        console.error(
          "Error generando onboarding:",
          err
        );

        setError(
          err?.message ||
            "Error generando onboarding."
        );
      }
    };

  // ============================================================
  // OBTENER ESTADO VISUAL
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
          "bg-green-100 text-green-700 border-green-200",
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
          "bg-yellow-100 text-yellow-700 border-yellow-200",
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
          "bg-blue-100 text-blue-700 border-blue-200",
      };
    }

    if (
      organizador.stripeStatus ===
      "error"
    ) {
      return {
        texto: "Error",
        clase:
          "bg-red-100 text-red-700 border-red-200",
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
          "bg-purple-100 text-purple-700 border-purple-200",
      };
    }

    return {
      texto: "Pendiente",
      clase:
        "bg-gray-100 text-gray-700 border-gray-200",
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
        <h2 className="text-3xl font-extrabold text-gray-900">
          Organizadores
        </h2>

        <p className="mt-2 text-gray-600">
          Administra los organizadores externos y
          sus cuentas de Stripe Connect.
        </p>
      </div>

      {/* ====================================================== */}
      {/* MENSAJES */}
      {/* ====================================================== */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* ====================================================== */}
      {/* CREAR ORGANIZADOR */}
      {/* ====================================================== */}

      <section className="rounded-2xl border border-dh-purple/10 bg-white p-6 shadow-dh">

        <h3 className="text-xl font-bold text-gray-900">
          Nuevo organizador
        </h3>

        <p className="mt-1 text-sm text-gray-500">
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
            <label className="mb-2 block text-sm font-semibold text-gray-900">
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
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:border-dh-purple focus:ring-2 focus:ring-dh-purple/20"
              disabled={loading}
            />
          </div>

          {/* CORREO */}

<div>
  <label className="mb-2 block text-sm font-semibold text-gray-900">
    Correo
  </label>

  <input
    type="email"
    value={email}
    onChange={(e) =>
      setEmail(e.target.value)
    }
    placeholder="organizador@ejemplo.com"
    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:border-dh-purple focus:ring-2 focus:ring-dh-purple/20"
    disabled={loading}
  />
</div>

          {/* BOTÓN */}

          <div className="flex items-end">

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-dh-purple px-6 py-3 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
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

      <section className="rounded-2xl border border-dh-purple/10 bg-white p-6 shadow-dh">

        <div className="mb-5 flex items-center justify-between">

          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Organizadores registrados
            </h3>

            <p className="text-sm text-gray-500">
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
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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

          <div className="py-12 text-center text-gray-500">
            Cargando organizadores...
          </div>

        ) : organizadores.length === 0 ? (

          <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-gray-500">
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

                const stripeActivo =
                  organizador.chargesEnabled === true &&
                  organizador.payoutsEnabled === true;

                return (
                  <div
                    key={
                      organizador.id
                    }
                    className="rounded-2xl border border-gray-200 p-5 transition hover:shadow-md"
                  >

                    {/* ======================================== */}
                    {/* CABECERA */}
                    {/* ======================================== */}

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                      <div>

                        <div className="flex flex-wrap items-center gap-3">

                          <h4 className="text-lg font-bold text-gray-500">
                            {organizador.nombre}
                          </h4>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${estado.clase}`}
                          >
                            {estado.texto}
                          </span>

                        </div>

                        <p className="mt-1 text-sm text-gray-500">
                          {organizador.email}
                        </p>

                        {organizador.connectedAccountId && (
                          <p className="mt-2 font-mono text-xs text-gray-400">
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
                            actualizando
                          }
                          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actualizando
                            ? "Consultando Stripe..."
                            : "↻ Actualizar estado"}
                        </button>

                        {/* CONFIGURAR STRIPE */}

                        {!stripeActivo && (
                          <button
                            type="button"
                            onClick={() =>
                              abrirOnboarding(
                                organizador
                              )
                            }
                            disabled={
                              actualizando
                            }
                            className="rounded-xl bg-dh-purple px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {organizador.detailsSubmitted
                              ? "Continuar configuración"
                              : "Configurar Stripe"}
                          </button>
                        )}

                      </div>

                    </div>

                    {/* ======================================== */}
                    {/* ESTADO DETALLADO */}
                    {/* ======================================== */}

                    <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">

                      {/* DATOS */}

                      <div>
                        <p className="text-xs text-gray-400">
                          Datos enviados
                        </p>

                        <p className="mt-1 text-sm font-semibold">
                          {organizador.detailsSubmitted
                            ? "✓ Sí"
                            : "Pendiente"}
                        </p>
                      </div>

                      {/* COBROS */}

                      <div>
                        <p className="text-xs text-gray-400">
                          Cobros
                        </p>

                        <p className="mt-1 text-sm font-semibold">
                          {organizador.chargesEnabled
                            ? "✓ Habilitados"
                            : "Pendientes"}
                        </p>
                      </div>

                      {/* RETIROS */}

                      <div>
                        <p className="text-xs text-gray-400">
                          Retiros
                        </p>

                        <p className="mt-1 text-sm font-semibold">
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

                        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">

                          <p className="text-sm font-bold text-yellow-800">
                            Stripe tiene información pendiente
                          </p>

                          <p className="mt-1 text-xs text-yellow-700">
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

                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">

                        <p className="text-sm font-bold text-red-800">
                          Stripe reporta una restricción
                        </p>

                        <p className="mt-1 text-xs text-red-700">
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