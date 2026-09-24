import { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import AuthGuard from "@/components/AuthGuard";
import { app } from "@/lib/firebase";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  UsersIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

type Inscripcion = {
  id: string;
  carreraId: string;
  competitorNumber?: number | null;
  ficha?: number | null;
  bib?: number | null;
  nombre?: string | null;
  paterno?: string | null;
  materno?: string | null;
  nombres?: string | null;
  rama?: string | null;
  ruta?: string | null;
  distancia?: string | null;
  categoria?: string | null;
  email?: string | null;
  celular?: string | null;
  ciudad?: string | null;
  estado?: string | null;
  pais?: string | null;
  club?: string | null;
  paymentStatus?: string | null;
  monto: number;
  timestamp?: string | null;
};

type Carrera = {
  id: string;
  titulo: string;
  fecha?: string | null;
  horaSalida?: string | null;
  lugar?: string | null;
  imagenUrl?: string | null;
  inscripcionesAbiertas?: boolean;
  totalInscritos: number;
  pagados: number;
  pendientes: number;
  manuales: number;
  cancelados: number;
  ingresosPagados: number;
  ingresosPendientes: number;
  ingresosManuales: number;
  importeCancelado: number;
  inscripciones: Inscripcion[];
};

type DashboardData = {
  organizer: {
    id: string;
    nombre: string;
    email: string;
  };
  carreras: Carrera[];
  stats: {
    carreras: number;
    inscritos: number;
    pagados: number;
    pendientes: number;
    cancelados: number;
    ingresosPagados: number;
    ingresosPendientes: number;
    ingresosManuales: number;
    importeCancelado: number;
  };
};

function nombreCompleto(i: Inscripcion) {
  return (
    i.nombres ||
    [i.nombre, i.paterno, i.materno]
      .filter(Boolean)
      .join(" ")
  ).replace(/\s+/g, " ").trim();
}

function fechaBonita(value?: string | null) {
  if (!value) return "Sin fecha";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(
      "es-MX"
    );
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es-MX");
}

function moneda(value?: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function esCancelado(value?: string | null) {
  return ["cancelled", "canceled", "cancelado", "cancelada"].includes(
    String(value || "").toLowerCase()
  );
}

function fechaRegistro(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("es-MX");
}

function estadoLabel(value?: string | null) {
  switch (value) {
    case "paid":
      return "Pagado";
    case "pending":
      return "Pendiente";
    case "manual":
      return "Manual";
    case "expired":
      return "Expirado";
    case "failed":
      return "Fallido";
    case "unpaid":
      return "No pagado";
    case "cancelled":
    case "canceled":
    case "cancelado":
    case "cancelada":
      return "Cancelado";
    case "approved":
      return "Pagado";
    default:
      return value || "Desconocido";
  }
}

function estadoClass(value?: string | null) {
  switch (value) {
    case "paid":
      return "bg-green-500/15 text-green-300 border-green-500/20";
    case "pending":
      return "bg-yellow-500/15 text-yellow-300 border-yellow-500/20";
    case "manual":
      return "bg-blue-500/15 text-blue-300 border-blue-500/20";
    case "expired":
    case "failed":
    case "unpaid":
    case "cancelled":
    case "canceled":
    case "cancelado":
    case "cancelada":
      return "bg-red-500/15 text-red-300 border-red-500/20";
    case "approved":
      return "bg-green-500/15 text-green-300 border-green-500/20";
    default:
      return "bg-white/5 text-white/60 border-white/10";
  }
}

function csvEscape(value: any) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function OrganizadorPage() {
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedCarreraId, setSelectedCarreraId] =
    useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarDashboard = async (currentUser?: User) => {
    try {
      setLoading(true);
      setError("");

      const u = currentUser || auth.currentUser;

      if (!u) {
        setLoading(false);
        return;
      }

      const token = await u.getIdToken(true);

      const response = await fetch(
        "/api/organizer/dashboard",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(
          json?.error ||
            "No fue posible cargar el dashboard."
        );
      }

      setData(json);

      if (
        !selectedCarreraId &&
        json.carreras?.length
      ) {
        setSelectedCarreraId(json.carreras[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          "No fue posible cargar el dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);

        if (currentUser) {
          cargarDashboard(currentUser);
        } else {
          setLoading(false);
        }
      }
    );

    return unsub;
  }, [auth]);

  const carreraSeleccionada = useMemo(
    () =>
      data?.carreras.find(
        (c) => c.id === selectedCarreraId
      ) || null,
    [data, selectedCarreraId]
  );

  const visibles = useMemo(() => {
    if (!carreraSeleccionada) return [];

    const q = search.trim().toLowerCase();

    return carreraSeleccionada.inscripciones.filter(
      (i) => {
        if (
          status !== "all" &&
          (status === "cancelled"
            ? !esCancelado(i.paymentStatus)
            : (i.paymentStatus || "") !== status)
        ) {
          return false;
        }

        if (!q) return true;

        const blob = [
          i.competitorNumber,
          i.ficha,
          i.bib,
          nombreCompleto(i),
          i.email,
          i.celular,
          i.club,
          i.ruta,
          i.distancia,
          i.categoria,
          i.rama,
          i.ciudad,
          i.estado,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return blob.includes(q);
      }
    );
  }, [
    carreraSeleccionada,
    search,
    status,
  ]);

  const exportarCSV = () => {
    if (!carreraSeleccionada) return;

    const rows = visibles.map((i) => [
      i.competitorNumber ?? "",
      nombreCompleto(i),
      i.rama ?? "",
      i.ruta ?? i.distancia ?? "",
      i.categoria ?? "",
      i.email ?? "",
      i.celular ?? "",
      moneda(i.monto),
      i.club ?? "",
      i.ciudad ?? "",
      i.estado ?? "",
      estadoLabel(i.paymentStatus),
      fechaRegistro(i.timestamp),
    ]);

    const header = [
      "#",
      "Nombre",
      "Rama",
      "Ruta",
      "Categoría",
      "Email",
      "Celular",
      "Importe (MXN)",
      "Club",
      "Ciudad",
      "Estado",
      "Pago",
      "Registrado",
    ];

    const csv = [
      header,
      ...rows,
    ]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");

    const blob = new Blob(
      ["\ufeff" + csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download =
      `inscripciones_${carreraSeleccionada.titulo
        .replace(/[^a-z0-9áéíóúñ ]/gi, "")
        .trim()
        .replace(/\s+/g, "_")}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#0c0c0f] text-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
            <div>
              <p className="text-sm text-dh-purple font-bold uppercase tracking-wider">
                DHTime
              </p>
              <h1 className="text-4xl font-black mt-2">
                Panel del{" "}
                <span className="text-dh-purple">
                  Organizador
                </span>
              </h1>

              {data?.organizer && (
                <p className="text-white/50 mt-2">
                  {data.organizer.nombre} ·{" "}
                  {data.organizer.email}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => cargarDashboard(user || undefined)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50"
            >
              <ArrowPathIcon
                className={`w-5 h-5 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Actualizar
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-300">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="rounded-3xl border border-white/10 bg-[#16161d] p-10 text-white/50">
              Cargando tu panel...
            </div>
          ) : !data ? (
            <div className="rounded-3xl border border-white/10 bg-[#16161d] p-10 text-white/50">
              No fue posible cargar el panel.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <StatCard
                  label="Carreras"
                  value={data.stats.carreras}
                  icon={<CalendarIcon className="w-6 h-6" />}
                />
                <StatCard
                  label="Inscritos"
                  value={data.stats.inscritos}
                  icon={<UsersIcon className="w-6 h-6" />}
                />
                <StatCard
                  label="Pagados"
                  value={data.stats.pagados}
                  icon={<CheckCircleIcon className="w-6 h-6" />}
                />
                <StatCard
                  label="Pendientes"
                  value={data.stats.pendientes}
                  icon={<ClockIcon className="w-6 h-6" />}
                />
                <StatCard
                  label="Ingresos pagados"
                  value={moneda(data.stats.ingresosPagados)}
                  icon={<CheckCircleIcon className="w-6 h-6" />}
                />
                <StatCard
                  label="Dinero pendiente"
                  value={moneda(data.stats.ingresosPendientes)}
                  icon={<ClockIcon className="w-6 h-6" />}
                />
                <StatCard
                  label="Importe cancelado"
                  value={moneda(data.stats.importeCancelado)}
                  icon={<XCircleIcon className="w-6 h-6" />}
                />
                <StatCard
                  label="Pagos manuales"
                  value={moneda(data.stats.ingresosManuales)}
                  icon={<UsersIcon className="w-6 h-6" />}
                />
              </div>

              <section className="rounded-3xl border border-white/10 bg-[#16161d] overflow-hidden">
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-2xl font-black">
                    Mis carreras
                  </h2>
                  <p className="text-sm text-white/45 mt-1">
                    Solo aparecen las carreras vinculadas a
                    tu cuenta de organizador.
                  </p>
                </div>

                {data.carreras.length === 0 ? (
                  <div className="p-8 text-white/50">
                    Todavía no tienes carreras asignadas.
                  </div>
                ) : (
                  <div className="p-4 grid gap-3">
                    {data.carreras.map((carrera) => {
                      const selected =
                        carrera.id ===
                        selectedCarreraId;

                      return (
                        <button
                          key={carrera.id}
                          type="button"
                          onClick={() =>
                            setSelectedCarreraId(
                              carrera.id
                            )
                          }
                          className={`w-full text-left rounded-2xl border p-5 transition ${
                            selected
                              ? "border-dh-purple/50 bg-dh-purple/10"
                              : "border-white/10 bg-[#141418] hover:bg-white/5"
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                              <h3 className="font-black text-lg">
                                {carrera.titulo}
                              </h3>

                              <div className="flex flex-wrap gap-4 mt-2 text-sm text-white/50">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarIcon className="w-4 h-4" />
                                  {fechaBonita(
                                    carrera.fecha
                                  )}
                                </span>

                                {carrera.lugar && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPinIcon className="w-4 h-4" />
                                    {carrera.lugar}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs font-bold">
                              <Badge
                                label={`${carrera.totalInscritos} inscritos`}
                              />
                              <Badge
                                label={`${carrera.pagados} pagados`}
                              />
                              {carrera.pendientes > 0 && (
                                <Badge
                                  label={`${carrera.pendientes} pendientes`}
                                  warning
                                />
                              )}
                              <Badge label={`Pagado: ${moneda(carrera.ingresosPagados)}`} />
                              <Badge label={`Pendiente: ${moneda(carrera.ingresosPendientes)}`} warning />
                              {carrera.cancelados > 0 && (
                                <Badge label={`Cancelado: ${moneda(carrera.importeCancelado)}`} />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {carreraSeleccionada && (
                <section className="mt-8 rounded-3xl border border-white/10 bg-[#16161d] overflow-hidden">
                  <div className="p-6 border-b border-white/10">
                    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
                      <div>
                        <h2 className="text-2xl font-black">
                          {carreraSeleccionada.titulo}
                        </h2>
                        <p className="text-sm text-white/45 mt-1">
                          {carreraSeleccionada.totalInscritos}{" "}
                          inscripciones
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
                        <MiniFinanceCard label="Ingresos pagados" value={moneda(carreraSeleccionada.ingresosPagados)} />
                        <MiniFinanceCard label="Dinero pendiente" value={moneda(carreraSeleccionada.ingresosPendientes)} />
                        <MiniFinanceCard label="Pagos manuales" value={moneda(carreraSeleccionada.ingresosManuales)} />
                        <MiniFinanceCard label="Importe cancelado" value={moneda(carreraSeleccionada.importeCancelado)} />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={status}
                          onChange={(e) =>
                            setStatus(
                              e.target.value
                            )
                          }
                          className="bg-[#141418] border border-white/10 rounded-xl px-4 py-3"
                        >
                          <option value="all">
                            Todos los estados
                          </option>
                          <option value="paid">
                            Pagados
                          </option>
                          <option value="pending">
                            Pendientes
                          </option>
                          <option value="manual">
                            Manuales
                          </option>
                          <option value="expired">
                            Expirados
                          </option>
                          <option value="failed">
                            Fallidos
                          </option>
                          <option value="cancelled">
                            Cancelados
                          </option>
                        </select>

                        <div className="relative">
                          <MagnifyingGlassIcon className="w-5 h-5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            value={search}
                            onChange={(e) =>
                              setSearch(
                                e.target.value
                              )
                            }
                            placeholder="Buscar corredor..."
                            className="w-full sm:w-72 bg-[#141418] border border-white/10 rounded-xl pl-10 pr-4 py-3 placeholder-white/30"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={exportarCSV}
                          disabled={!visibles.length}
                          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-dh-purple text-black font-black disabled:opacity-40"
                        >
                          <ArrowDownTrayIcon className="w-5 h-5" />
                          Exportar CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {visibles.length === 0 ? (
                    <div className="p-8 text-white/50">
                      No hay inscripciones con esos
                      filtros.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1050px]">
                        <thead className="bg-[#141418] text-white/50 text-xs uppercase tracking-wider">
                          <tr>
                            <th className="p-4 text-left">
                              #
                            </th>
                            <th className="p-4 text-left">
                              Corredor
                            </th>
                            <th className="p-4 text-left">
                              Ruta
                            </th>
                            <th className="p-4 text-left">
                              Categoría
                            </th>
                            <th className="p-4 text-left">
                              Celular
                            </th>
                            <th className="p-4 text-left">
                              Importe
                            </th>
                            <th className="p-4 text-left">
                              Club
                            </th>
                            <th className="p-4 text-left">
                              Pago
                            </th>
                            <th className="p-4 text-left">
                              Registrado
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {visibles.map((i) => (
                            <tr
                              key={i.id}
                              className="border-t border-white/5 hover:bg-white/5"
                            >
                              <td className="p-4 font-black text-dh-purple">
                                {i.competitorNumber ??
                                  i.ficha ??
                                  i.bib ??
                                  "—"}
                              </td>

                              <td className="p-4">
                                <div className="font-bold">
                                  {nombreCompleto(i) ||
                                    "—"}
                                </div>
                                <div className="text-xs text-white/35 mt-1">
                                  {i.email || "—"}
                                </div>
                              </td>

                              <td className="p-4">
                                {i.ruta ||
                                  i.distancia ||
                                  "—"}
                              </td>

                              <td className="p-4">
                                {i.categoria || "—"}
                              </td>

                              <td className="p-4">
                                {i.celular || "—"}
                              </td>

                              <td className="p-4 font-bold whitespace-nowrap">
                                {moneda(i.monto)}
                              </td>

                              <td className="p-4">
                                {i.club || "—"}
                              </td>

                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${estadoClass(
                                    i.paymentStatus
                                  )}`}
                                >
                                  {estadoLabel(
                                    i.paymentStatus
                                  )}
                                </span>
                              </td>

                              <td className="p-4 text-sm text-white/45">
                                {fechaRegistro(
                                  i.timestamp
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#16161d] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/45">
          {label}
        </span>
        <span className="text-dh-purple">
          {icon}
        </span>
      </div>
      <div className="text-3xl font-black mt-3">
        {value}
      </div>
    </div>
  );
}

function MiniFinanceCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#141418] p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-2 text-lg sm:text-xl font-black break-words">{value}</p>
    </div>
  );
}

function Badge({
  label,
  warning = false,
}: {
  label: string;
  warning?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 ${
        warning
          ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
          : "border-white/10 bg-white/5 text-white/60"
      }`}
    >
      {label}
    </span>
  );
}
