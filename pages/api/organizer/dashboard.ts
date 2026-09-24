import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { requireOrganizer } from "@/lib/organizerAuth";

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
  inscripciones: Inscripcion[];
    cancelados: number;
  ingresosPagados: number;
  ingresosPendientes: number;
  ingresosManuales: number;
  importeCancelado: number;
};

type ResponseData =
  | {
      ok: true;
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
    }
  | {
      ok: false;
      error: string;
    };

function serializeTimestamp(value: any): string | null {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function clean(value: any): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

function obtenerMontoInscripcion(
  carrera: any,
  inscripcion: any
): number {
  const distancias = Array.isArray(carrera.distancias)
    ? carrera.distancias
    : [];

  const distanciaBuscada = String(
    inscripcion.distancia || inscripcion.ruta || ""
  ).trim().toLowerCase();

  const categoriaBuscada = String(
    inscripcion.categoria || ""
  ).trim().toLowerCase();

  const distancia = distancias.find(
    (d: any) =>
      String(d.distancia || "").trim().toLowerCase() ===
      distanciaBuscada
  );

  if (!distancia) return 0;

  const categoria = (distancia.categorias || []).find(
    (cat: any) =>
      String(cat.nombre || "").trim().toLowerCase() ===
      categoriaBuscada
  );

  if (!categoria) return 0;

  const precio = Number(categoria.price);

  return Number.isFinite(precio) && precio > 0
    ? precio
    : 0;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido",
    });
  }

  try {
    const { db, organizerId, organizer } =
      await requireOrganizer(req);

    // Solo carreras cuyo paymentConfig.organizerId
    // coincide con el organizador autenticado.
    const carrerasSnap = await db
      .collection("carreras")
      .where("paymentConfig.organizerId", "==", organizerId)
      .get();

    const carreras: Carrera[] = [];

    for (const carreraDoc of carrerasSnap.docs) {
      const c = carreraDoc.data();

      const inscripcionesSnap = await db
        .collection("inscripciones")
        .where("carreraId", "==", carreraDoc.id)
        .get();

      const inscripciones: Inscripcion[] =
        inscripcionesSnap.docs.map((insDoc) => {
          const i = insDoc.data();

          return {
            id: insDoc.id,
            carreraId: carreraDoc.id,
            competitorNumber:
              typeof i.competitorNumber === "number"
                ? i.competitorNumber
                : null,
            ficha:
              typeof i.ficha === "number"
                ? i.ficha
                : null,
            bib:
              typeof i.bib === "number"
                ? i.bib
                : null,
            nombre: clean(i.nombre),
            paterno: clean(i.paterno),
            materno: clean(i.materno),
            nombres: clean(i.nombres),
            rama: clean(i.rama),
            ruta: clean(i.ruta),
            distancia: clean(i.distancia),
            categoria: clean(i.categoria),
            email: clean(i.email),
            celular: clean(i.celular),
            ciudad: clean(i.ciudad),
            estado: clean(i.estado),
            pais: clean(i.pais),
            club: clean(i.club),
            paymentStatus: clean(i.paymentStatus),
            monto: obtenerMontoInscripcion(c, i),
            timestamp: serializeTimestamp(i.timestamp),
          };
        });

      const esPagado = (i: Inscripcion) =>
  ["paid", "approved"].includes(
    String(i.paymentStatus || "").toLowerCase()
  );

const esPendiente = (i: Inscripcion) =>
  String(i.paymentStatus || "").toLowerCase() === "pending";

const esManual = (i: Inscripcion) =>
  String(i.paymentStatus || "").toLowerCase() === "manual";

const esCancelado = (i: Inscripcion) =>
  ["cancelled", "canceled", "cancelado", "cancelada"].includes(
    String(i.paymentStatus || "").toLowerCase()
  );

const pagados = inscripciones.filter(esPagado).length;
const pendientes = inscripciones.filter(esPendiente).length;
const manuales = inscripciones.filter(esManual).length;
const cancelados = inscripciones.filter(esCancelado).length;

const ingresosPagados = inscripciones
  .filter(esPagado)
  .reduce((total, i) => total + i.monto, 0);

const ingresosPendientes = inscripciones
  .filter(esPendiente)
  .reduce((total, i) => total + i.monto, 0);

const ingresosManuales = inscripciones
  .filter(esManual)
  .reduce((total, i) => total + i.monto, 0);

const importeCancelado = inscripciones
  .filter(esCancelado)
  .reduce((total, i) => total + i.monto, 0);

      carreras.push({
        id: carreraDoc.id,
        titulo: c.titulo || "(sin título)",
        fecha: clean(c.fecha),
        horaSalida: clean(c.horaSalida),
        lugar: clean(c.lugar || c.ubicacion),
        imagenUrl: clean(c.imagenUrl),
        inscripcionesAbiertas:
          c.inscripcionesAbiertas !== false,
        totalInscritos: inscripciones.length,
        pagados,
        pendientes,
        manuales,
        inscripciones,
        cancelados,
ingresosPagados,
ingresosPendientes,
ingresosManuales,
importeCancelado,
      });
    }

    carreras.sort((a, b) =>
      String(a.fecha || "").localeCompare(
        String(b.fecha || ""),
        "es"
      )
    );

    const stats = carreras.reduce(
  (acc, carrera) => {
    acc.carreras += 1;
    acc.inscritos += carrera.totalInscritos;
    acc.pagados += carrera.pagados;
    acc.pendientes += carrera.pendientes;
    acc.cancelados += carrera.cancelados;

    acc.ingresosPagados += carrera.ingresosPagados;
    acc.ingresosPendientes += carrera.ingresosPendientes;
    acc.ingresosManuales += carrera.ingresosManuales;
    acc.importeCancelado += carrera.importeCancelado;

    return acc;
  },
  {
    carreras: 0,
    inscritos: 0,
    pagados: 0,
    pendientes: 0,
    cancelados: 0,
    ingresosPagados: 0,
    ingresosPendientes: 0,
    ingresosManuales: 0,
    importeCancelado: 0,
  }
);

    const organizerData =
  organizer as Record<string, any>;

return res.status(200).json({
  ok: true,
  organizer: {
    id: organizerId,
    nombre: organizerData.nombre || "",
    email: organizerData.email || "",
  },
  carreras,
  stats,
});
  } catch (error: any) {
    console.error(
      "Error cargando dashboard de organizador:",
      error
    );

    const message =
      error?.message ||
      "No fue posible cargar el dashboard";

    const status =
      message.includes("no autenticado") ||
      message.includes("verificar") ||
      message.includes("No existe un organizador") ||
      message.includes("ya está vinculado") ||
      message.includes("desactivada")
        ? 403
        : 500;

    return res.status(status).json({
      ok: false,
      error: message,
    });
  }
}
