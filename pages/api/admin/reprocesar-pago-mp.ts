import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";

/**
 * ============================================================
 * FIREBASE ADMIN
 * ============================================================
 */

function getAdminDb() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;

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
 * ENDPOINT DE RECUPERACIÓN DE PAGO MERCADO PAGO
 * ============================================================
 *
 * Uso exclusivo administrativo.
 *
 * No crea inscripciones.
 * No genera cobros.
 * No crea preferencias.
 *
 * Consulta un pago existente y, si todas las validaciones
 * coinciden, actualiza el paymentAttempt y la inscripción.
 */


/**
 * ============================================================
 * ASIGNAR NÚMERO DE COMPETIDOR
 * Respeta números ya utilizados y rangos manuales reservados.
 * ============================================================
 */
async function allocateNumberTx(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  carreraId: string
): Promise<number> {
  const carreraRef = db.collection("carreras").doc(carreraId);
  const carreraSnap = await tx.get(carreraRef);

  if (!carreraSnap.exists) {
    throw new Error(`Carrera no existe: ${carreraId}`);
  }

  const maxCupo = Number(carreraSnap.get("maxCompetitors") || 0);

  const usedSnap = await tx.get(
    db.collection("inscripciones").where("carreraId", "==", carreraId)
  );

  const used = new Set<number>();
  usedSnap.docs.forEach((doc) => {
    const data = doc.data();
    const status = String(data.paymentStatus || "").toLowerCase();
    if (status !== "paid" && status !== "manual") return;

    const rawNumber = data.competitorNumber ?? data.ficha ?? data.bib ?? null;
    const number = Number(rawNumber);
    if (Number.isFinite(number) && number > 0) used.add(number);
  });

  const tempSnap = await tx.get(
    db.collection("tempusuarios").where("carreraId", "==", carreraId)
  );

  const reserved = new Set<number>();
  const now = Date.now();

  tempSnap.docs.forEach((doc) => {
    const data = doc.data();
    const range = data.range;
    if (!range) return;

    const expiresAt = data.expiresAt;
    if (expiresAt) {
      let expiresMs = 0;
      if (typeof expiresAt === "object" && typeof expiresAt.toDate === "function") {
        expiresMs = expiresAt.toDate().getTime();
      } else {
        expiresMs = new Date(expiresAt).getTime();
      }
      if (Number.isFinite(expiresMs) && expiresMs <= now) return;
    }

    const start = Number(range.start);
    const end = Number(range.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    for (let n = start; n <= end; n++) {
      if (n > 0) reserved.add(n);
    }
  });

  const limit = maxCupo > 0 ? maxCupo : 100000;
  for (let n = 1; n <= limit; n++) {
    if (!used.has(n) && !reserved.has(n)) return n;
  }

  throw new Error(`Ya no hay números disponibles para la carrera ${carreraId}`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      error: "Método no permitido",
    });
  }

  try {
    /**
     * ========================================================
     * 1. AUTORIZACIÓN CON SECRETO PRIVADO
     * ========================================================
     */

    const configuredSecret = String(
      process.env.MP_REPROCESS_SECRET || ""
    ).trim();

    const receivedSecret = String(
      req.headers["x-reprocess-secret"] || ""
    ).trim();

    if (!configuredSecret) {
      console.error(
        "[MP Reprocess] Falta MP_REPROCESS_SECRET"
      );

      return res.status(500).json({
        error: "Endpoint no configurado",
      });
    }

    if (
      !receivedSecret ||
      receivedSecret !== configuredSecret
    ) {
      return res.status(401).json({
        error: "No autorizado",
      });
    }

    /**
     * ========================================================
     * 2. RECIBIR IDENTIFICADORES
     * ========================================================
     */

    const paymentIdFromRequest = String(
  req.body?.paymentId || ""
).trim();

const attemptId = String(
  req.body?.attemptId || ""
).trim();

if (!attemptId) {
  return res.status(400).json({
    error: "Debes enviar attemptId",
  });
}

    const db = getAdminDb();

    /**
     * ========================================================
     * 3. OBTENER PAYMENT ATTEMPT
     * ========================================================
     */

    const attemptRef = db
      .collection("paymentAttempts")
      .doc(attemptId);

    const attemptSnap = await attemptRef.get();

    if (!attemptSnap.exists) {
      return res.status(404).json({
        error: "PaymentAttempt no encontrado",
      });
    }

    const attempt = attemptSnap.data()!;

    const externalReference = String(
  attempt.attemptId || attemptId
).trim();

if (!externalReference) {
  return res.status(409).json({
    error:
      "El PaymentAttempt no tiene una referencia externa válida",
  });
}

    /**
     * ========================================================
     * 4. VALIDAR PROVEEDOR
     * ========================================================
     */

    if (
      String(attempt.paymentProvider || "")
        .toLowerCase() !== "mercadopago"
    ) {
      return res.status(409).json({
        error:
          "El intento no pertenece a Mercado Pago",
      });
    }

    /**
     * ========================================================
     * 5. OBTENER ACCESS TOKEN DE LA CUENTA RECEPTORA
     * ========================================================
     */

    let accessToken = "";

    const recipient = String(
      attempt.recipient || "dhtime"
    ).toLowerCase();

    if (recipient === "organizer") {
      const organizerId = String(
        attempt.organizerId || ""
      ).trim();

      if (!organizerId) {
        return res.status(409).json({
          error:
            "El intento no tiene organizerId",
        });
      }

      const organizerSnap = await db
        .collection("organizadores")
        .doc(organizerId)
        .get();

      if (!organizerSnap.exists) {
        return res.status(404).json({
          error: "Organizador no encontrado",
        });
      }

      const organizer = organizerSnap.data()!;

      if (
        organizer.mercadoPagoStatus !== "connected"
      ) {
        return res.status(409).json({
          error:
            "La cuenta de Mercado Pago del organizador no está conectada",
        });
      }

      accessToken = String(
        organizer.mercadoPagoAccessToken || ""
      ).trim();

    } else {
      accessToken = String(
        process.env.MERCADOPAGO_ACCESS_TOKEN || ""
      ).trim();
    }

    if (!accessToken) {
      return res.status(500).json({
        error:
          "No se encontró el Access Token de la cuenta receptora",
      });
    }

   /**
 * ============================================================
 * 6. CONSULTAR EL PAGO REAL EN MERCADO PAGO
 * ============================================================
 */

let paymentId = paymentIdFromRequest;

// Si no recibimos paymentId, buscarlo por external_reference
if (!paymentId) {
  const searchUrl =
    "https://api.mercadopago.com/v1/payments/search?" +
    new URLSearchParams({
      external_reference: externalReference,
      limit: "20",
    }).toString();

  const searchResponse = await fetch(searchUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const searchData = await searchResponse.json();

  if (!searchResponse.ok) {
    console.error(
      "[MP Reprocess] Error buscando pago por external_reference",
      {
        status: searchResponse.status,
        data: searchData,
      }
    );

    return res.status(502).json({
      error:
        "Mercado Pago no permitió buscar los pagos",
    });
  }

  const results = Array.isArray(searchData?.results)
    ? searchData.results
    : [];

  // Buscar primero un pago que coincida exactamente
  // con el external_reference y el monto esperado.
  const expectedAmount = Number(
    attempt.expectedAmount
  );

  const matchingPayments = results.filter(
    (payment: any) => {
      const paymentExternalReference = String(
        payment?.external_reference || ""
      ).trim();

      const amount = Number(
        payment?.transaction_amount
      );

      return (
        paymentExternalReference === externalReference &&
        Number.isFinite(amount) &&
        Number.isFinite(expectedAmount) &&
        Math.round(amount * 100) ===
          Math.round(expectedAmount * 100)
      );
    }
  );

  if (matchingPayments.length === 0) {
    return res.status(404).json({
      error:
        "No se encontró un pago de Mercado Pago que coincida con el PaymentAttempt",
      attemptId,
      externalReference,
      expectedAmount,
      resultsFound: results.length,
    });
  }

  // Si hay varios, preferir uno aprobado.
  const approvedPayment =
    matchingPayments.find(
      (payment: any) =>
        String(payment?.status || "").toLowerCase() ===
        "approved"
    );

  const selectedPayment =
    approvedPayment || matchingPayments[0];

  paymentId = String(
    selectedPayment.id || ""
  ).trim();

  if (!paymentId) {
    return res.status(404).json({
      error:
        "Mercado Pago devolvió un pago pero no contiene un paymentId válido",
    });
  }

  console.log(
    "[MP Reprocess] Pago encontrado por external_reference",
    {
      attemptId,
      externalReference,
      paymentId,
      status: selectedPayment.status,
      amount: selectedPayment.transaction_amount,
    }
  );
}

// Ahora consultar el pago completo por su paymentId
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

const payment = await paymentResponse.json();

if (!paymentResponse.ok) {
  console.error(
    "[MP Reprocess] Error consultando pago",
    {
      status: paymentResponse.status,
      message:
        payment?.message ||
        payment?.error ||
        "Error desconocido",
    }
  );

  return res.status(502).json({
    error:
      "Mercado Pago no permitió consultar el pago",
  });
}

    /**
     * ========================================================
     * 7. VALIDAR IDENTIDAD DEL PAGO
     * ========================================================
     */

    if (String(payment.id) !== paymentId) {
      return res.status(409).json({
        error: "El ID del pago no coincide",
      });
    }

    /**
     * El pago debe pertenecer exactamente
     * al paymentAttempt enviado.
     */

    const paymentExternalReference = String(
      payment.external_reference || ""
    ).trim();

    if (paymentExternalReference !== attemptId) {
      console.error(
        "[MP Reprocess] external_reference no coincide",
        {
          paymentId,
          attemptId,
          paymentExternalReference,
        }
      );

      return res.status(409).json({
        error:
          "El pago no corresponde al paymentAttempt indicado",
      });
    }

    /**
     * ========================================================
     * 8. VALIDAR CUENTA RECEPTORA
     * ========================================================
     */

    const expectedSellerId = String(
      attempt.mercadoPagoUserId || ""
    ).trim();

    const paymentCollectorId = String(
      payment.collector_id || ""
    ).trim();

    if (
      !expectedSellerId ||
      paymentCollectorId !== expectedSellerId
    ) {
      return res.status(409).json({
        error:
          "La cuenta receptora del pago no coincide con el intento",
      });
    }

    /**
     * ========================================================
     * 9. VALIDAR MONEDA
     * ========================================================
     */

    const paymentCurrency = String(
      payment.currency_id || ""
    ).toUpperCase();

    const expectedCurrency = String(
      attempt.currency || "MXN"
    ).toUpperCase();

    if (paymentCurrency !== expectedCurrency) {
      return res.status(409).json({
        error: "La moneda del pago no coincide",
      });
    }

    /**
     * ========================================================
     * 10. VALIDAR MONTO
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
      expectedAmount <= 0 ||
      Math.round(transactionAmount * 100) !==
        Math.round(expectedAmount * 100)
    ) {
      return res.status(409).json({
        error: "El monto del pago no coincide",
      });
    }

    /**
     * ========================================================
     * 11. VALIDAR PREFERENCE ID
     * ========================================================
     *
     * Si Mercado Pago devuelve preference_id,
     * debe coincidir.
     *
     * Si viene vacío, se permite continuar porque
     * external_reference, cuenta y monto ya fueron
     * verificados contra el intento existente.
     */

    const paymentPreferenceId = String(
      payment.preference_id || ""
    ).trim();

    const attemptPreferenceId = String(
      attempt.preferenceId || ""
    ).trim();

    if (
      paymentPreferenceId &&
      paymentPreferenceId !== attemptPreferenceId
    ) {
      return res.status(409).json({
        error:
          "El preferenceId del pago no coincide",
      });
    }

    /**
     * ========================================================
     * 12. VALIDAR QUE EL PAGO ESTÉ APROBADO
     * ========================================================
     */

    const paymentStatus = String(
      payment.status || ""
    ).toLowerCase();

    if (paymentStatus !== "approved") {
      return res.status(409).json({
        error: "El pago todavía no está aprobado",
        paymentStatus,
      });
    }

    /**
     * ========================================================
     * 13. BUSCAR INSCRIPCIÓN EXISTENTE
     * ========================================================
     */

    const inscripcionesSnap = await db
      .collection("inscripciones")
      .where("paymentAttemptId", "==", attemptId)
      .limit(2)
      .get();

    if (inscripcionesSnap.empty) {
      return res.status(404).json({
        error:
          "No se encontró una inscripción asociada al intento",
      });
    }

    if (inscripcionesSnap.size !== 1) {
      return res.status(409).json({
        error:
          "El intento está asociado a más de una inscripción",
      });
    }

    const inscripcionDoc =
      inscripcionesSnap.docs[0];

    /**
     * ========================================================
     * 14. ACTUALIZACIÓN TRANSACCIONAL
     * ========================================================
     */

    let assignedNumber = 0;
    let repairedNumber = false;

    await db.runTransaction(async (transaction) => {
      const freshAttemptSnap = await transaction.get(attemptRef);
      const freshInscripcionSnap = await transaction.get(inscripcionDoc.ref);

      if (!freshAttemptSnap.exists || !freshInscripcionSnap.exists) {
        throw new Error("El intento o la inscripción ya no existen");
      }

      const freshAttempt = freshAttemptSnap.data()!;
      const freshInscripcion = freshInscripcionSnap.data()!;

      if (
        String(freshAttempt.paymentProvider || "").toLowerCase() !== "mercadopago" ||
        String(freshInscripcion.paymentAttemptId || "") !== attemptId
      ) {
        throw new Error("El intento y la inscripción no coinciden");
      }

      if (
        String(freshInscripcion.paymentStatus || "").toLowerCase() === "paid" &&
        String(freshInscripcion.paymentId || "") !== paymentId
      ) {
        throw new Error("La inscripción ya fue pagada con otro pago");
      }

      const rawNumber =
        freshInscripcion.competitorNumber ??
        freshInscripcion.ficha ??
        freshInscripcion.bib ??
        null;

      const existingNumber = rawNumber === null ? 0 : Number(rawNumber);

      if (Number.isFinite(existingNumber) && existingNumber > 0) {
        assignedNumber = existingNumber;
      } else {
        const carreraId = String(freshInscripcion.carreraId || "").trim();
        if (!carreraId) {
          throw new Error("La inscripción no tiene carreraId");
        }

        assignedNumber = await allocateNumberTx(transaction, db, carreraId);
        repairedNumber = true;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      transaction.update(attemptRef, {
        status: "approved",
        paymentStatus: "approved",
        paymentId,
        preferenceId: paymentPreferenceId || attemptPreferenceId,
        paymentAmount: transactionAmount,
        paymentCurrency,
        approvedAt: now,
        updatedAt: now,
      });

      transaction.update(inscripcionDoc.ref, {
        paymentStatus: "paid",
        paymentProvider: "mercadopago",
        paymentAttemptId: attemptId,
        paymentId,
        preferenceId: paymentPreferenceId || attemptPreferenceId,
        paymentMethod: payment.payment_method_id || null,
        paymentType: payment.payment_type_id || null,
        paymentApprovedAt: now,
        paymentAmount: transactionAmount,
        paymentCurrency,

        competitorNumber: assignedNumber,
        ficha: assignedNumber,
        bib: assignedNumber,

        updatedAt: now,
      });
    });

    /**
     * ========================================================
     * 15. RESPUESTA
     * ========================================================
     */

    return res.status(200).json({
      success: true,
      message:
        "Pago verificado y procesado correctamente",
      paymentId,
      attemptId,
      paymentStatus: "approved",
      competitorNumber: assignedNumber,
      numberRepaired: repairedNumber,
      inscripcionId: inscripcionDoc.id,
    });

  } catch (error: any) {
    console.error(
      "[MP Reprocess] Error:",
      error?.message || error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Error interno al reprocesar el pago",
    });
  }
}