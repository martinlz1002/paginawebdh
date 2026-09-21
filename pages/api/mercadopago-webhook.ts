import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import * as admin from "firebase-admin";
import crypto from "crypto";

/**
 * ============================================================
 * FIREBASE ADMIN
 * ============================================================
 */

function getAdminDb() {
  if (!admin.apps.length) {
    const raw =
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;

    if (!raw) {
      throw new Error(
        "Falta FIREBASE_SERVICE_ACCOUNT_KEY_B64"
      );
    }

    const serviceAccount = JSON.parse(
      Buffer.from(raw, "base64").toString("utf8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin.firestore();
}

/**
 * ============================================================
 * ASIGNAR NÚMERO DE COMPETIDOR
 * ============================================================
 */

async function allocateNumberTx(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  carreraId: string
): Promise<number> {

  const carreraRef = db
    .collection("carreras")
    .doc(carreraId);

  const carreraSnap = await tx.get(carreraRef);

  if (!carreraSnap.exists) {
    throw new Error(
      `Carrera no existe: ${carreraId}`
    );
  }

  const maxCupo = Number(
    carreraSnap.get("maxCompetitors") || 0
  );

  /**
   * 1. OBTENER NÚMEROS YA UTILIZADOS
   */

  const usedSnap = await tx.get(
    db.collection("inscripciones")
      .where("carreraId", "==", carreraId)
  );

  const used = new Set<number>();

  usedSnap.docs.forEach((doc) => {

    const data = doc.data();

    const status = String(
      data.paymentStatus || ""
    ).toLowerCase();

    if (
      status !== "paid" &&
      status !== "manual"
    ) {
      return;
    }

    const rawNumber =
      data.competitorNumber ??
      data.ficha ??
      data.bib ??
      null;

    const number = Number(rawNumber);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      used.add(number);
    }
  });

  /**
   * 2. OBTENER RANGOS MANUALES RESERVADOS
   */

  const tempSnap = await tx.get(
    db.collection("tempusuarios")
      .where("carreraId", "==", carreraId)
  );

  const reserved = new Set<number>();
  const now = Date.now();

  tempSnap.docs.forEach((doc) => {

    const data = doc.data();
    const range = data.range;

    if (!range) {
      return;
    }

    const expiresAt = data.expiresAt;

    if (expiresAt) {

      let expiresMs = 0;

      if (
        typeof expiresAt === "object" &&
        typeof expiresAt.toDate === "function"
      ) {
        expiresMs = expiresAt.toDate().getTime();
      } else {
        expiresMs = new Date(expiresAt).getTime();
      }

      if (
        Number.isFinite(expiresMs) &&
        expiresMs <= now
      ) {
        return;
      }
    }

    const start = Number(range.start);
    const end = Number(range.end);

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    ) {
      return;
    }

    for (let n = start; n <= end; n++) {
      if (n > 0) {
        reserved.add(n);
      }
    }
  });

  /**
   * 3. BUSCAR EL PRIMER NÚMERO DISPONIBLE
   */

  const limit =
    maxCupo > 0 ? maxCupo : 100000;

  for (let n = 1; n <= limit; n++) {

    if (
      !used.has(n) &&
      !reserved.has(n)
    ) {
      return n;
    }
  }

  throw new Error(
    `Ya no hay números disponibles para la carrera ${carreraId}`
  );
}

/**
 * ============================================================
 * VALIDAR FIRMA MERCADO PAGO
 * ============================================================
 */

function validarFirmaMercadoPago(
  req: NextApiRequest,
  paymentId: string
): boolean {
  const secret =
    process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    console.error(
      "[MP Webhook] Falta MERCADOPAGO_WEBHOOK_SECRET"
    );

    return false;
  }

  const xSignature =
    req.headers["x-signature"];

  const xRequestId =
    req.headers["x-request-id"];

  if (
    typeof xSignature !== "string" ||
    typeof xRequestId !== "string"
  ) {
    return false;
  }

  const parts = xSignature
    .split(",")
    .map((part) => part.trim());

  const tsPart = parts.find(
    (part) => part.startsWith("ts=")
  );

  const v1Part = parts.find(
    (part) => part.startsWith("v1=")
  );

  if (!tsPart || !v1Part) {
    return false;
  }

  const ts = tsPart.substring(3);

  const receivedSignature =
    v1Part.substring(3);

  const manifest =
    `id:${paymentId};` +
    `request-id:${xRequestId};` +
    `ts:${ts};`;

  const expectedSignature =
    crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

  try {
    const received = Buffer.from(
      receivedSignature,
      "hex"
    );

    const expected = Buffer.from(
      expectedSignature,
      "hex"
    );

    if (
      received.length !== expected.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      received,
      expected
    );
  } catch {
    return false;
  }
}

/**
 * ============================================================
 * HANDLER
 * ============================================================
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).end(
      `Método ${req.method} No Permitido`
    );
  }

  try {
    const db = getAdminDb();

    /**
     * ========================================================
     * 1. OBTENER DATOS DE LA NOTIFICACIÓN
     * ========================================================
     */

    const paymentId = String(
      req.query["data.id"] ||
      req.body?.data?.id ||
      ""
    ).trim();

    const topic = String(
      req.query.type ||
      req.body?.type ||
      ""
    ).trim();

    if (
      topic !== "payment" ||
      !paymentId
    ) {
      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    /**
     * ========================================================
     * 2. VALIDAR FIRMA
     * ========================================================
     */

    const firmaValida =
      validarFirmaMercadoPago(
        req,
        paymentId
      );

    if (!firmaValida) {
      console.error(
        "[MP Webhook] Firma inválida"
      );

      return res.status(401).json({
        error: "Firma inválida",
      });
    }

    /**
     * ========================================================
     * 3. IDENTIFICAR LA CUENTA RECEPTORA
     * ========================================================
     *
     * Mercado Pago incluye user_id en la notificación.
     *
     * Lo utilizamos para determinar qué cuenta debe
     * consultar el pago.
     *
     * No confiamos en un organizerId enviado por el cliente.
     */

    const notificationUserId = String(
      req.body?.user_id || ""
    ).trim();

    if (!notificationUserId) {
      console.error(
        "[MP Webhook] La notificación no contiene user_id"
      );

      return res.status(500).json({
        error: "No se pudo identificar la cuenta receptora",
      });
    }

    const platformUserId = String(
      process.env.MERCADOPAGO_USER_ID || ""
    ).trim();

    const platformToken = String(
      process.env.MERCADOPAGO_ACCESS_TOKEN || ""
    ).trim();

    let accessToken = "";
    let organizerId: string | null = null;

    /**
     * ========================================================
     * 4. DETERMINAR SI EL PAGO ES DE DHTIME
     * ========================================================
     */

    if (
      platformUserId &&
      notificationUserId === platformUserId
    ) {
      if (!platformToken) {
        throw new Error(
          "Falta MERCADOPAGO_ACCESS_TOKEN"
        );
      }

      accessToken = platformToken;
    } else {
      /**
       * ======================================================
       * 5. BUSCAR ORGANIZADOR POR SU USER ID DE MERCADO PAGO
       * ======================================================
       */

      const organizerSnap = await db
        .collection("organizadores")
        .where(
          "mercadoPagoUserId",
          "==",
          notificationUserId
        )
        .limit(2)
        .get();

      if (organizerSnap.empty) {
        console.error(
          "[MP Webhook] No se encontró organizador para user_id:",
          notificationUserId
        );

        return res.status(500).json({
          error: "No se encontró la cuenta del organizador",
        });
      }

      if (organizerSnap.size !== 1) {
        console.error(
          "[MP Webhook] User ID asociado a múltiples organizadores:",
          notificationUserId
        );

        return res.status(500).json({
          error: "La cuenta de Mercado Pago no es única",
        });
      }

      const organizerDoc =
        organizerSnap.docs[0];

      const organizer =
        organizerDoc.data();

      if (
        organizer.mercadoPagoStatus !== "connected"
      ) {
        return res.status(500).json({
          error: "La cuenta de Mercado Pago del organizador no está conectada",
        });
      }

      accessToken = String(
        organizer.mercadoPagoAccessToken || ""
      ).trim();

      organizerId = organizerDoc.id;

      if (!accessToken) {
        return res.status(500).json({
          error: "El organizador no tiene Access Token",
        });
      }
    }

    /**
     * ========================================================
     * 6. CONSULTAR EL PAGO CON EL TOKEN CORRECTO
     * ========================================================
     */

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
        paymentId
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payment =
      await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error(
        "[MP Webhook] Error consultando pago:",
        {
          status: paymentResponse.status,
          message:
            payment?.message ||
            payment?.error ||
            "Error desconocido",
        }
      );

      return res.status(500).json({
        error: "No se pudo consultar el pago",
      });
    }

    /**
     * ========================================================
     * 7. VALIDAR IDENTIDAD DEL PAGO
     * ========================================================
     */

    if (
      String(payment.id) !== paymentId
    ) {
      return res.status(400).json({
        error: "El ID del pago no coincide",
      });
    }

    const paymentCollectorId = String(
      payment.collector_id || ""
    ).trim();

    if (
      paymentCollectorId !== notificationUserId
    ) {
      console.error(
        "[MP Webhook] La cuenta receptora no coincide con el pago",
        {
          notificationUserId,
          paymentCollectorId,
        }
      );

      return res.status(200).json({
        received: true,
        ignored: true,
        reason: "collector_mismatch",
      });
    }

    /**
     * ========================================================
     * 8. OBTENER PAYMENT ATTEMPT
     * ========================================================
     */

    const attemptId = String(
      payment.external_reference || ""
    ).trim();

    if (!attemptId) {
      console.error(
        "[MP Webhook] Pago sin external_reference:",
        paymentId
      );

      return res.status(200).json({
        received: true,
        ignored: true,
        reason: "missing_external_reference",
      });
    }

    const attemptRef = db
      .collection("paymentAttempts")
      .doc(attemptId);

    const attemptSnap =
      await attemptRef.get();

    if (!attemptSnap.exists) {
      console.error(
        "[MP Webhook] PaymentAttempt no encontrado:",
        attemptId
      );

      return res.status(500).json({
        error: "PaymentAttempt no encontrado",
      });
    }

    const attempt =
      attemptSnap.data()!;

    /**
     * ========================================================
     * 9. VALIDAR PROVEEDOR Y CUENTA
     * ========================================================
     */

    if (
      String(attempt.paymentProvider || "").toLowerCase() !==
      "mercadopago"
    ) {
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: "wrong_provider",
      });
    }

    const expectedSellerId = String(
      attempt.mercadoPagoUserId || ""
    ).trim();

    if (
      expectedSellerId !== notificationUserId
    ) {
      console.error(
        "[MP Webhook] El vendedor no coincide con el intento",
        {
          attemptId,
          expectedSellerId,
          notificationUserId,
        }
      );

      return res.status(200).json({
        received: true,
        ignored: true,
        reason: "seller_mismatch",
      });
    }

    const expectedOrganizerId = String(
      attempt.organizerId || ""
    ).trim();

    if (
      expectedOrganizerId !==
      String(organizerId || "")
    ) {
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: "organizer_mismatch",
      });
    }

    /**
     * ========================================================
     * 10. VALIDAR MONEDA
     * ========================================================
     */

    const paymentCurrency = String(
      payment.currency_id || ""
    ).toUpperCase();

    const expectedCurrency = String(
      attempt.currency || "MXN"
    ).toUpperCase();

    if (
      paymentCurrency !== expectedCurrency
    ) {
      console.error(
        "[MP Webhook] Moneda incorrecta",
        {
          paymentCurrency,
          expectedCurrency,
          attemptId,
        }
      );

      return res.status(200).json({
        received: true,
        ignored: true,
        reason: "currency_mismatch",
      });
    }

    /**
 * ========================================================
 * 11. VALIDAR PREFERENCE ID
 * ========================================================
 */

const paymentPreferenceId = String(
  payment.preference_id || ""
).trim();

const attemptPreferenceId = String(
  attempt.preferenceId || ""
).trim();

// Si Mercado Pago sí devuelve preference_id,
// debe coincidir con el intento de pago.
if (
  paymentPreferenceId &&
  attemptPreferenceId !== paymentPreferenceId
) {
  console.error(
    "[MP Webhook] Preference ID no coincide",
    {
      attemptId,
      paymentPreferenceId,
      attemptPreferenceId,
    }
  );

  return res.status(200).json({
    received: true,
    ignored: true,
    reason: "preference_mismatch",
  });
}

// Si el pago no incluye preference_id,
// conservamos el ID guardado en el intento.
// La validación de external_reference, vendedor,
// moneda y monto sigue siendo obligatoria.
const validPreferenceId =
  paymentPreferenceId || attemptPreferenceId;

if (!validPreferenceId) {
  console.error(
    "[MP Webhook] No hay preference ID verificable",
    { attemptId, paymentId }
  );

  return res.status(200).json({
    received: true,
    ignored: true,
    reason: "missing_preference_id",
  });
}

    /**
     * ========================================================
     * 12. VALIDAR ESTADO DEL PAGO
     * ========================================================
     */

    const paymentStatus = String(
      payment.status || ""
    ).toLowerCase();

    if (paymentStatus !== "approved") {
      console.log(
        "[MP Webhook] Pago aún no aprobado",
        {
          paymentId,
          attemptId,
          paymentStatus,
        }
      );

      return res.status(200).json({
        received: true,
        paymentStatus,
      });
    }

    /**
     * ========================================================
     * 13. VALIDAR MONTO
     * ========================================================
     */

    const transactionAmount = Number(
      payment.transaction_amount
    );

    const expectedAmount = Number(
      attempt.expectedAmount
    );

    if (
      !Number.isFinite(transactionAmount) ||
      !Number.isFinite(expectedAmount) ||
      transactionAmount <= 0 ||
      expectedAmount <= 0
    ) {
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: "invalid_amount",
      });
    }

    if (
      Math.round(transactionAmount * 100) !==
      Math.round(expectedAmount * 100)
    ) {
      console.error(
        "[MP Webhook] Monto no coincide",
        {
          transactionAmount,
          expectedAmount,
          attemptId,
        }
      );

      return res.status(200).json({
        received: true,
        ignored: true,
        reason: "amount_mismatch",
      });
    }

    /**
     * ========================================================
     * 14. BUSCAR INSCRIPCIÓN POR PAYMENT ATTEMPT ID
     * ========================================================
     */

    const inscripcionesSnap = await db
      .collection("inscripciones")
      .where(
        "paymentAttemptId",
        "==",
        attemptId
      )
      .limit(2)
      .get();

    if (inscripcionesSnap.empty) {
      console.warn(
        "[MP Webhook] Inscripción aún no encontrada:",
        attemptId
      );

      return res.status(500).json({
        error: "Inscripción aún no encontrada",
      });
    }

    if (inscripcionesSnap.size !== 1) {
      console.error(
        "[MP Webhook] El intento está asociado a múltiples inscripciones",
        attemptId
      );

      return res.status(500).json({
        error: "El intento está asociado a múltiples inscripciones",
      });
    }

    const inscripcionDoc =
      inscripcionesSnap.docs[0];

    /**
 * ============================================================
 * 15. ACTUALIZACIÓN TRANSACCIONAL + ASIGNACIÓN DE NÚMERO
 * ============================================================
 */

await db.runTransaction(async (transaction) => {
  const freshAttemptSnap = await transaction.get(attemptRef);
  const freshInscripcionSnap = await transaction.get(
    inscripcionDoc.ref
  );

  if (!freshAttemptSnap.exists || !freshInscripcionSnap.exists) {
    throw new Error(
      "El intento o la inscripción ya no existen"
    );
  }

  const freshAttempt = freshAttemptSnap.data()!;
  const freshInscripcion = freshInscripcionSnap.data()!;

  // 1. VALIDAR QUE EL INTENTO CORRESPONDA A MERCADO PAGO
  if (
    String(freshAttempt.paymentProvider || "").toLowerCase() !==
      "mercadopago" ||
    String(freshInscripcion.paymentAttemptId || "") !== attemptId
  ) {
    throw new Error(
      "El intento y la inscripción no coinciden"
    );
  }

  // 2. NO PERMITIR QUE OTRO PAGO SOBRESCRIBA ESTA INSCRIPCIÓN
  if (
    String(freshInscripcion.paymentStatus || "").toLowerCase() ===
      "paid" &&
    String(freshInscripcion.paymentId || "") !== paymentId
  ) {
    throw new Error(
      "La inscripción ya fue pagada con otro pago"
    );
  }

  // 3. REVISAR SI YA TIENE NÚMERO
  const rawNumber =
    freshInscripcion.competitorNumber ??
    freshInscripcion.ficha ??
    freshInscripcion.bib ??
    null;

  const existingNumber =
    rawNumber === null ? 0 : Number(rawNumber);

  let assignedNumber: number;

  if (
    Number.isFinite(existingNumber) &&
    existingNumber > 0
  ) {
    // Si ya tiene número, conservarlo.
    assignedNumber = existingNumber;

    console.log(
      "[MP Webhook] Conservando número existente",
      {
        attemptId,
        paymentId,
        assignedNumber,
      }
    );
  } else {
    // 4. ASIGNAR NÚMERO NUEVO
    const carreraId = String(
      freshInscripcion.carreraId || ""
    ).trim();

    if (!carreraId) {
      throw new Error(
        "La inscripción no tiene carreraId"
      );
    }

    console.log(
      "[MP Webhook] Iniciando asignación de número",
      {
        attemptId,
        paymentId,
        carreraId,
      }
    );

    assignedNumber = await allocateNumberTx(
      transaction,
      db,
      carreraId
    );

    console.log(
      "[MP Webhook] Número calculado",
      {
        attemptId,
        paymentId,
        carreraId,
        assignedNumber,
      }
    );
  }

  const now =
    admin.firestore.FieldValue.serverTimestamp();

  // 5. ACTUALIZAR EL PAYMENT ATTEMPT
  transaction.update(attemptRef, {
    status: "approved",
    paymentStatus: "approved",
    paymentId,
    preferenceId: validPreferenceId,
    paymentAmount: transactionAmount,
    paymentCurrency,
    approvedAt: now,
    updatedAt: now,
  });

  // 6. ACTUALIZAR INSCRIPCIÓN Y ASIGNAR NÚMERO
  transaction.update(inscripcionDoc.ref, {
    paymentStatus: "paid",
    paymentProvider: "mercadopago",
    paymentAttemptId: attemptId,

    paymentId,
    preferenceId: validPreferenceId,

    paymentMethod: payment.payment_method_id || null,
    paymentType: payment.payment_type_id || null,

    paymentApprovedAt: now,
    paymentAmount: transactionAmount,
    paymentCurrency,

    // NÚMERO DEL COMPETIDOR
    competitorNumber: assignedNumber,
    ficha: assignedNumber,
    bib: assignedNumber,

    updatedAt: now,
  });

  console.log(
    "[MP Webhook] Transacción lista para guardar",
    {
      attemptId,
      paymentId,
      inscriptionId: inscripcionDoc.id,
      assignedNumber,
    }
  );
});

    /**
     * ========================================================
     * 16. RESPUESTA FINAL
     * ========================================================
     */

    console.log(
      "[MP Webhook] Pago aprobado y registrado",
      {
        paymentId,
        attemptId,
        organizerId,
      }
    );

    return res.status(200).json({
      received: true,
      paymentStatus: "approved",
      attemptId,
    });

  } catch (error: any) {
    console.error(
      "[MP Webhook] Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Error interno del webhook",
    });
  }
}