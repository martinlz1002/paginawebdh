import type {
  Firestore,
  Transaction,
  DocumentData,
} from "firebase-admin/firestore";

export class CupoAgotadoError extends Error {
  constructor(message = "Esta carrera ya alcanzó su cupo máximo.") {
    super(message);
    this.name = "CupoAgotadoError";
  }
}

export class CupoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CupoError";
  }
}

type TipoReserva = "online" | "manual";
type EstadoReserva = "reservado" | "confirmado" | "liberado";

function normalizarEstado(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Estados que todavía ocupan un lugar en el cupo. */
export function esInscripcionActiva(data: DocumentData): boolean {
  const estado = normalizarEstado(data.paymentStatus);
  if (["failed", "fallido", "cancelled", "canceled", "expired", "unpaid", "refunded", "reembolsado"].includes(estado)) {
    return false;
  }
  // Los estados desconocidos se conservan por seguridad: no liberar cupos
  // cuando no se conoce con certeza el estado de una inscripción.
  return true;
}

function maximoDesdeCarrera(data: DocumentData): number {
  const raw = Number(data.cupoMaximo ?? 0);
  if (!Number.isFinite(raw) || raw < 0) {
    throw new CupoError("El cupo máximo configurado para esta carrera no es válido.");
  }
  return Math.floor(raw);
}

function refs(db: Firestore, carreraId: string, inscripcionId: string) {
  return {
    carreraRef: db.collection("carreras").doc(carreraId),
    controlRef: db.collection("controlCupos").doc(carreraId),
    reservaRef: db.collection("reservasCupo").doc(inscripcionId),
    inscripcionRef: db.collection("inscripciones").doc(inscripcionId),
  };
}

/**
 * Reserva un cupo dentro de la misma transacción que crea la inscripción.
 * El caller debe haber leído todos los documentos/query necesarios antes
 * de realizar cualquier escritura en esa transacción.
 */
export async function reservarCupoEnTransaccion(
  tx: Transaction,
  db: Firestore,
  carreraId: string,
  inscripcionId: string,
  tipo: TipoReserva
): Promise<void> {
  if (!carreraId || !inscripcionId) throw new CupoError("Falta carreraId o inscripcionId para reservar el cupo.");

  const { carreraRef, controlRef, reservaRef } = refs(db, carreraId, inscripcionId);
  const [carreraSnap, controlSnap, reservaSnap] = await Promise.all([
    tx.get(carreraRef),
    tx.get(controlRef),
    tx.get(reservaRef),
  ]);

  if (!carreraSnap.exists) throw new CupoError("La carrera ya no existe.");

  // La misma inscripción no debe consumir dos lugares si el proceso se reintenta.
  if (reservaSnap.exists) {
    const estado = normalizarEstado(reservaSnap.get("estado"));
    if (estado !== "liberado") return;
    throw new CupoError("Esta inscripción ya tuvo una reserva liberada y no puede reutilizarse.");
  }

  const maximo = maximoDesdeCarrera(carreraSnap.data() ?? {});
  let activos = Number(controlSnap.exists ? controlSnap.get("activos") ?? 0 : 0);

  if (!Number.isSafeInteger(activos) || activos < 0) {
    throw new CupoError("El contador de cupos contiene un valor inválido. Requiere revisión administrativa.");
  }

  // Inicialización compatible con inscripciones anteriores al control central.
  // Solo se ejecuta una vez, cuando aún no existe controlCupos/{carreraId}.
  if (!controlSnap.exists) {
    const legacySnap = await tx.get(db.collection("inscripciones").where("carreraId", "==", carreraId));
    activos = legacySnap.docs.filter((d) => esInscripcionActiva(d.data())).length;
  }

  if (maximo > 0 && activos >= maximo) {
    throw new CupoAgotadoError(`Cupo agotado: ${activos} de ${maximo} lugares ocupados.`);
  }

  const siguiente = activos + 1;
  // Una sola escritura del documento de control por transacción.
  tx.set(controlRef, {
    carreraId,
    activos: siguiente,
    cupoMaximo: maximo,
    ilimitado: maximo === 0,
    updatedAt: new Date(),
    ...(controlSnap.exists ? {} : { initializedFromLegacy: true }),
  }, { merge: true });

  tx.create(reservaRef, {
    carreraId,
    inscripcionId,
    tipo,
    estado: tipo === "manual" ? "confirmado" : "reservado",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** Confirma una reserva existente. Es idempotente y nunca revive una liberada. */
export async function confirmarCupoEnTransaccion(
  tx: Transaction,
  db: Firestore,
  carreraId: string,
  inscripcionId: string
): Promise<void> {
  const { reservaRef } = refs(db, carreraId, inscripcionId);
  const reservaSnap = await tx.get(reservaRef);
  if (!reservaSnap.exists) throw new CupoError("No existe la reserva de cupo asociada a esta inscripción.");

  const estado = normalizarEstado(reservaSnap.get("estado"));
  if (estado === "confirmado") return;
  if (estado === "liberado") throw new CupoError("No se puede confirmar una reserva que ya fue liberada.");

  tx.update(reservaRef, { estado: "confirmado", confirmedAt: new Date(), updatedAt: new Date() });
}

/** Libera una reserva no confirmada. Nunca libera reservas confirmadas/manuales. */
export async function liberarCupoEnTransaccion(
  tx: Transaction,
  db: Firestore,
  carreraId: string,
  inscripcionId: string
): Promise<void> {
  const { controlRef, reservaRef } = refs(db, carreraId, inscripcionId);
  const [controlSnap, reservaSnap] = await Promise.all([
    tx.get(controlRef),
    tx.get(reservaRef),
  ]);
  if (!reservaSnap.exists) return;

  const estado = normalizarEstado(reservaSnap.get("estado"));
  if (estado === "liberado") return;
  if (estado === "confirmado") return;

  const activos = Number(controlSnap.exists ? controlSnap.get("activos") ?? 0 : 0);
  if (!Number.isSafeInteger(activos) || activos < 0) {
    throw new CupoError("El contador de cupos contiene un valor inválido. No se liberó la reserva.");
  }

  tx.update(reservaRef, { estado: "liberado", releasedAt: new Date(), updatedAt: new Date() });
  if (controlSnap.exists) {
    tx.update(controlRef, { activos: Math.max(0, activos - 1), updatedAt: new Date() });
  }
}

/** Consulta informativa; la garantía de capacidad siempre se aplica en transacción. */
export async function obtenerCupoCarrera(db: Firestore, carreraId: string) {
  const carreraSnap = await db.collection("carreras").doc(carreraId).get();
  if (!carreraSnap.exists) throw new CupoError("La carrera no existe.");
  const maximo = maximoDesdeCarrera(carreraSnap.data() ?? {});
  const controlSnap = await db.collection("controlCupos").doc(carreraId).get();
  let activos = Number(controlSnap.exists ? controlSnap.get("activos") ?? 0 : NaN);
  if (!Number.isFinite(activos)) {
    const inscripciones = await db.collection("inscripciones").where("carreraId", "==", carreraId).get();
    activos = inscripciones.docs.filter((d) => esInscripcionActiva(d.data())).length;
  }
  return { cupoMaximo: maximo, ocupados: activos, disponibles: maximo > 0 ? Math.max(0, maximo - activos) : null, ilimitado: maximo === 0 };
}
