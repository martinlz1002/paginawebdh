
// components/AdminUsuarios.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase";
import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

interface Usuario {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  disabled: boolean;
  creationTime: string;
  nombre: string;
  apPaterno: string;
  apMaterno: string;
  ciudad: string;
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Obtener token del administrador
  const getToken = async () => {
    const auth = getAuth(app);
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
    }

    return currentUser.getIdToken();
  };

  // Consultar todas las páginas de usuarios
  const cargarUsuarios = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      let pageToken: string | null = null;
      const todos: Usuario[] = [];

      do {
        const params = new URLSearchParams();

        if (pageToken) {
          params.set("pageToken", pageToken);
        }

        const response = await fetch(
          `/api/admin/usuarios?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "No se pudieron consultar los usuarios.");
        }

        todos.push(...data.usuarios);
        pageToken = data.nextPageToken || null;

      } while (pageToken);

      setUsuarios(todos);

    } catch (err: any) {
      console.error("[AdminUsuarios]", err);
      setError(err.message || "Error al cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  // Filtrar usuarios
  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) return usuarios;

    return usuarios.filter((usuario) => {
      const nombreCompleto = [
        usuario.nombre,
        usuario.apPaterno,
        usuario.apMaterno,
        usuario.displayName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        nombreCompleto.includes(texto) ||
        usuario.email.toLowerCase().includes(texto) ||
        usuario.uid.toLowerCase().includes(texto)
      );
    });
  }, [usuarios, busqueda]);

  const verificados = usuarios.filter(
    (u) => u.emailVerified
  ).length;

  const pendientes = usuarios.length - verificados;

  // Verificar cuenta manualmente
  const verificarUsuario = async (usuario: Usuario) => {
    if (!usuario.email) {
      setError("Esta cuenta no tiene un correo electrónico.");
      return;
    }

    const nombre =
      [usuario.nombre, usuario.apPaterno, usuario.apMaterno]
        .filter(Boolean)
        .join(" ") || usuario.displayName || usuario.email;

    const confirmar = window.confirm(
      `¿Deseas verificar manualmente esta cuenta?\n\n` +
      `Usuario: ${nombre}\n` +
      `Correo: ${usuario.email}\n\n` +
      `Esta acción no enviará ningún correo electrónico.`
    );

    if (!confirmar) return;

    setVerificando(usuario.uid);
    setError("");
    setMensaje("");

    try {
      const token = await getToken();

      const response = await fetch(
        "/api/admin/verificar-correo",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            uid: usuario.uid,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo verificar la cuenta.");
      }

      // Actualizar interfaz inmediatamente
      setUsuarios((actuales) =>
        actuales.map((u) =>
          u.uid === usuario.uid
            ? { ...u, emailVerified: true }
            : u
        )
      );

      setMensaje(
        `La cuenta ${usuario.email} fue verificada correctamente.`
      );

    } catch (err: any) {
      console.error("[verificarUsuario]", err);
      setError(err.message || "Error al verificar la cuenta.");
    } finally {
      setVerificando(null);
    }
  };

  const formatoFecha = (fecha: string) => {
    if (!fecha) return "No disponible";

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) {
      return "No disponible";
    }

    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6 text-dh-ink">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            Administración de usuarios
          </h2>
          <p className="text-sm text-dh-muted mt-1">
            Consulta y administra las cuentas registradas en DHTime.
          </p>
        </div>

        <button
          onClick={cargarUsuarios}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-dh-purple text-white font-semibold hover:opacity-90 disabled:opacity-50 transition"
        >
          <ArrowPathIcon
            className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
          />
          Actualizar
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className="rounded-2xl border border-dh-border bg-dh-panel p-5">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="w-8 h-8 text-dh-purple" />
            <div>
              <p className="text-sm text-dh-muted">
                Total de usuarios
              </p>
              <p className="text-2xl font-bold">
                {usuarios.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dh-border bg-dh-panel p-5">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-dh-muted">
                Correos verificados
              </p>
              <p className="text-2xl font-bold">
                {verificados}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dh-border bg-dh-panel p-5">
          <div className="flex items-center gap-3">
            <ExclamationCircleIcon className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-sm text-dh-muted">
                Pendientes de verificar
              </p>
              <p className="text-2xl font-bold">
                {pendientes}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Mensajes */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 text-sm">
          {mensaje}
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dh-muted" />

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo electrónico o UID..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-dh-border bg-dh-panel text-dh-ink placeholder:text-dh-muted focus:outline-none focus:ring-2 focus:ring-dh-purple"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-dh-border bg-dh-panel overflow-hidden">

        {loading ? (
          <div className="p-12 text-center text-dh-muted">
            <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto mb-3" />
            Cargando usuarios...
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-dh-muted">
            No se encontraron usuarios.
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-dh-border flex justify-between items-center">
              <p className="font-semibold">
                Usuarios registrados
              </p>
              <span className="text-xs text-dh-muted">
                {usuariosFiltrados.length} resultados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-dh-soft text-dh-muted">
                  <tr>
                    <th className="px-5 py-4">Usuario</th>
                    <th className="px-5 py-4">Registro</th>
                    <th className="px-5 py-4">Verificación</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {usuariosFiltrados.map((usuario) => {
                    const nombre = [
                      usuario.nombre,
                      usuario.apPaterno,
                      usuario.apMaterno,
                    ]
                      .filter(Boolean)
                      .join(" ") ||
                      usuario.displayName ||
                      "Sin nombre";

                    return (
                      <tr
                        key={usuario.uid}
                        className="border-t border-dh-border hover:bg-dh-soft/50 transition"
                      >
                        <td className="px-5 py-4 min-w-[240px]">
                          <p className="font-semibold">
                            {nombre}
                          </p>

                          <p className="text-dh-muted text-xs mt-1">
                            {usuario.email || "Sin correo"}
                          </p>

                          <p
                            className="text-dh-muted/70 text-[10px] mt-1"
                            title={usuario.uid}
                          >
                            UID: {usuario.uid}
                          </p>

                          {usuario.ciudad && (
                            <p className="text-dh-muted text-xs mt-1">
                              {usuario.ciudad}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap text-dh-muted">
                          {formatoFecha(usuario.creationTime)}
                        </td>

                        <td className="px-5 py-4">
                          {usuario.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                              <CheckCircleIcon className="w-4 h-4" />
                              Verificado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                              <ExclamationCircleIcon className="w-4 h-4" />
                              Pendiente
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {usuario.disabled ? (
                            <span className="text-red-600 font-semibold">
                              Deshabilitado
                            </span>
                          ) : (
                            <span className="text-green-600">
                              Activo
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          {usuario.emailVerified ? (
                            <span className="text-dh-muted text-xs">
                              <ShieldCheckIcon className="w-4 h-4 inline mr-1" />
                              Sin acciones
                            </span>
                          ) : (
                            <button
                              onClick={() => verificarUsuario(usuario)}
                              disabled={
                                verificando !== null ||
                                usuario.disabled
                              }
                              className="px-3 py-2 rounded-lg bg-dh-purple text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition"
                            >
                              {verificando === usuario.uid
                                ? "Verificando..."
                                : "Verificar cuenta"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-dh-muted">
        El estado de verificación se obtiene directamente de Firebase Authentication.
        Los datos del perfil se consultan desde Firestore.
      </p>

    </div>
  );
}
