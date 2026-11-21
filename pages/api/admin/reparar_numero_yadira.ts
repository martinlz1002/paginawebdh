import type { NextApiRequest, NextApiResponse } from "next";
import { admin, adminDb } from "@/lib/firebaseAdmin";

const CARRERA_ID = "3FHEQtsEftYTG9F5icIh";
const INSCRIPCION_ID = "Hbw7ExPjWcgM1CyStp1e";
const PAYMENT_ATTEMPT_ID = "fnsq4Am7f4DtrrlIkUUI";
const NUMERO_ANTERIOR = 22;
const NUMERO_NUEVO = 24;

const ESTADOS_CONFIRMADOS = new Set([
  "paid",
  "pagado",
  "approved",
  "aprobado",
  "manual",
]);

function fechaMs(value: any): number | null {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const ms = value.toDate().getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "object" && typeof value._seconds === "number") {
    return value._seconds * 1000;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function numeroDeCampos(data: FirebaseFirestore.DocumentData): number[] {
  return [data.competitorNumber, data.ficha, data.bib]
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const configuredSecret = String(
    process.env.REPARAR_YADIRA_SECRET || ""
  ).trim();
  const receivedSecret = String(
    req.headers["x-repair-secret"] || ""
  ).trim();

  if (!configuredSecret) {
    return res.status(500).json({
      ok: false,
      error: "Falta configurar REPARAR_YADIRA_SECRET en variables de entorno.",
    });
  }

  if (!receivedSecret || receivedSecret !== configuredSecret) {
    return res.status(401).json({ ok: false, error: "No autorizado" });
  }

  try {
    const inscriptionRef = adminDb
      .collection("inscripciones")
      .doc(INSCRIPCION_ID);
    const attemptRef = adminDb
      .collection("paymentAttempts")
      .doc(PAYMENT_ATTEMPT_ID);
      console.info("[DIAGNOSTICO YADIRA]", {
  projectId: admin.app().options.projectId,
  databaseId: adminDb.databaseId,
  attemptPath: attemptRef.path,
});
    const raceRef = adminDb.collection("carreras").doc(CARRERA_ID);
    const allocatorRef = adminDb
      .collection("numberAllocators")
      .doc(CARRERA_ID);

    let result:
      | { changed: false; reason: string; currentNumbers: number[] }
      | { changed: true; previousNumbers: number[]; assignedNumber: number };

    await adminDb.runTransaction(async (tx) => {
      // Todas las lecturas se completan antes de escribir.
      const [inscriptionSnap, attemptSnap, raceSnap, allocatorSnap] =
        await Promise.all([
          tx.get(inscriptionRef),
          tx.get(attemptRef),
          tx.get(raceRef),
          tx.get(allocatorRef),
        ]);

      if (!inscriptionSnap.exists) {
        throw new Error("No existe la inscripción indicada.");
      }
      if (!attemptSnap.exists) {
        throw new Error("No existe el paymentAttempt indicado.");
      }
      if (!raceSnap.exists) {
        throw new Error("No existe la carrera indicada.");
      }

      const inscription = inscriptionSnap.data()!;
      const attempt = attemptSnap.data()!;
      const currentNumbers = numeroDeCampos(inscription);

      if (String(inscription.carreraId || "") !== CARRERA_ID) {
        throw new Error("La inscripción no pertenece a la carrera indicada.");
      }
      if (
        String(inscription.paymentAttemptId || "") !== PAYMENT_ATTEMPT_ID ||
        String(attempt.paymentProvider || "").toLowerCase() !== "mercadopago"
      ) {
        throw new Error("La inscripción y el intento de Mercado Pago no coinciden.");
      }
      if (!ESTADOS_CONFIRMADOS.has(
        String(inscription.paymentStatus || "").trim().toLowerCase()
      )) {
        throw new Error("La inscripción no tiene un estado de pago confirmado.");
      }
      if (
        currentNumbers.length === 0 ||
        !currentNumbers.includes(NUMERO_ANTERIOR)
      ) {
        throw new Error(
          `El número actual no coincide con el esperado (${NUMERO_ANTERIOR}). Encontrados: ${currentNumbers.join(", ") || "ninguno"}.`
        );
      }

      const [allInscripcionesSnap, tempUsuariosSnap] = await Promise.all([
        tx.get(
          adminDb
            .collection("inscripciones")
            .where("carreraId", "==", CARRERA_ID)
        ),
        tx.get(
          adminDb
            .collection("tempusuarios")
            .where("carreraId", "==", CARRERA_ID)
        ),
      ]);

      const occupiedBy: string[] = [];
      for (const otherDoc of allInscripcionesSnap.docs) {
        if (otherDoc.id === INSCRIPCION_ID) continue;
        const other = otherDoc.data();
        const status = String(other.paymentStatus || other.payment_status || "")
          .trim()
          .toLowerCase();
        if (!ESTADOS_CONFIRMADOS.has(status)) continue;
        if (numeroDeCampos(other).includes(NUMERO_NUEVO)) {
          occupiedBy.push(otherDoc.id);
        }
      }

      if (occupiedBy.length > 0) {
        throw new Error(
          `El número ${NUMERO_NUEVO} ya está asignado a otra(s) inscripción(es): ${occupiedBy.join(", ")}`
        );
      }

      const now = Date.now();
      const reservedBy: string[] = [];
      for (const tempDoc of tempUsuariosSnap.docs) {
        const temp = tempDoc.data();
        const range = temp.range;
        if (!range) continue;

        const expiry = fechaMs(temp.expiresAt);
        if (expiry !== null && expiry <= now) continue;

        const start = Number(range.start);
        const end = Number(range.end);
        if (
          Number.isSafeInteger(start) &&
          Number.isSafeInteger(end) &&
          start > 0 &&
          end >= start &&
          NUMERO_NUEVO >= start &&
          NUMERO_NUEVO <= end
        ) {
          reservedBy.push(tempDoc.id);
        }
      }

      if (reservedBy.length > 0) {
        throw new Error(
          `El número ${NUMERO_NUEVO} está dentro de un rango manual reservado: ${reservedBy.join(", ")}`
        );
      }

      const maxCupo = Number(raceSnap.get("maxCompetitors") || 0);
      if (maxCupo > 0 && NUMERO_NUEVO > maxCupo) {
        throw new Error(
          `El número ${NUMERO_NUEVO} supera el cupo máximo (${maxCupo}).`
        );
      }

      // Si ya quedó reparada, la operación es idempotente.
      if (
        currentNumbers.every((number) => number === NUMERO_NUEVO)
      ) {
        result = {
          changed: false,
          reason: "La inscripción ya tiene el número 24 en sus tres campos.",
          currentNumbers,
        };
        return;
      }

      const revisionActual = Number(
        allocatorSnap.exists ? allocatorSnap.get("revision") || 0 : 0
      );
      const nowServer = admin.firestore.FieldValue.serverTimestamp();

      tx.update(inscriptionRef, {
        competitorNumber: NUMERO_NUEVO,
        ficha: NUMERO_NUEVO,
        bib: NUMERO_NUEVO,
        updatedAt: nowServer,
        numberManuallyRepairedAt: nowServer,
        numberManuallyRepairedFrom: NUMERO_ANTERIOR,
      });

      tx.set(
        allocatorRef,
        {
          revision:
            Number.isSafeInteger(revisionActual) && revisionActual >= 0
              ? revisionActual + 1
              : 1,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      result = {
        changed: true,
        previousNumbers: currentNumbers,
        assignedNumber: NUMERO_NUEVO,
      };
    });

    console.info("[REPARACION YADIRA]", {
      projectId: admin.app().options.projectId,
      carreraId: CARRERA_ID,
      inscripcionId: INSCRIPCION_ID,
      paymentAttemptId: PAYMENT_ATTEMPT_ID,
      result: result!,
    });

    return res.status(200).json({
      ok: true,
      message: result!.changed
        ? "Número de competidora actualizado correctamente."
        : result!.reason,
      ...result!,
      carreraId: CARRERA_ID,
      inscripcionId: INSCRIPCION_ID,
    });
  } catch (error: any) {
    console.error("[REPARACION YADIRA] Error:", error?.message || error);
    return res.status(409).json({
      ok: false,
      error: error?.message || "No se pudo completar la reparación.",
    });
  }
}
