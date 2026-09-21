import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import * as admin from "firebase-admin";

import { createOrganizerAccount } from "../../../../lib/stripeConnect";
import { requireAdmin } from "../../../../lib/adminAuth";

type PaymentProvider = "stripe" | "mercadopago";

type ResponseData =
  | {
      ok: true;
      organizerId: string;
      paymentProvider: PaymentProvider;
      connectedAccountId?: string;
    }
  | {
      ok: false;
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // ==========================================
  // MÉTODO
  // ==========================================

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido",
    });
  }

  try {
    // ==========================================
    // VERIFICAR ADMIN
    // ==========================================

    await requireAdmin(req);

    // ==========================================
    // DATOS
    // ==========================================

    const {
      nombre,
      email,
      paymentProvider: providerRecibido,
    } = req.body || {};

    if (
      typeof nombre !== "string" ||
      !nombre.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "El nombre del organizador es obligatorio",
      });
    }

    if (
      typeof email !== "string" ||
      !email.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "El correo del organizador es obligatorio",
      });
    }

    // ==========================================
    // PROVEEDOR DE PAGOS
    // ==========================================

    // Compatibilidad con solicitudes anteriores:
    // si no mandan proveedor, se usa Stripe.

    const paymentProvider: PaymentProvider =
      providerRecibido === undefined
        ? "stripe"
        : providerRecibido;

    if (
      paymentProvider !== "stripe" &&
      paymentProvider !== "mercadopago"
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "El proveedor debe ser Stripe o Mercado Pago",
      });
    }

    const nombreLimpio = nombre.trim();

    const emailLimpio =
      email.trim().toLowerCase();

    // ==========================================
    // FIREBASE ADMIN
    // ==========================================

    const db = admin.firestore();

    // ==========================================
    // EVITAR ORGANIZADORES DUPLICADOS
    // ==========================================

    const existentes = await db
      .collection("organizadores")
      .where("email", "==", emailLimpio)
      .limit(1)
      .get();

    if (!existentes.empty) {
      return res.status(409).json({
        ok: false,
        error:
          "Ya existe un organizador con ese correo",
      });
    }

    // ==========================================
    // CREAR REGISTRO PRELIMINAR
    // ==========================================

    const organizerRef = db
      .collection("organizadores")
      .doc();

    const datosBase = {
      nombre: nombreLimpio,
      email: emailLimpio,

      paymentProvider,

      activo: true,

      createdAt:
        admin.firestore.FieldValue
          .serverTimestamp(),

      updatedAt:
        admin.firestore.FieldValue
          .serverTimestamp(),
    };

    // ==========================================
    // MERCADO PAGO
    // ==========================================

    if (paymentProvider === "mercadopago") {
      // No creamos una cuenta Stripe.
      // El registro queda identificado para Mercado Pago.
      //
      // La vinculación OAuth de Mercado Pago
      // se implementará por separado.

      await organizerRef.set({
        ...datosBase,

        connectedAccountId: "",

        stripeStatus: "not_applicable",

        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,

        mercadoPagoStatus: "pending",
        mercadoPagoUserId: "",
      });

      return res.status(200).json({
        ok: true,

        organizerId: organizerRef.id,

        paymentProvider: "mercadopago",
      });
    }

    // ==========================================
    // STRIPE
    // ==========================================

    // Conservamos el comportamiento actual
    // para organizadores que utilizan Stripe.

    await organizerRef.set({
      ...datosBase,

      connectedAccountId: "",

      stripeStatus: "creating",

      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });

    // ==========================================
    // CREAR CUENTA STRIPE EXPRESS
    // ==========================================

    let account;

    try {
      account = await createOrganizerAccount({
        email: emailLimpio,
        country: "MX",
        businessType: "individual",
      });
    } catch (stripeError: any) {
      // ========================================
      // STRIPE FALLÓ
      // ========================================

      await organizerRef.update({
        stripeStatus: "error",

        stripeError:
          stripeError?.message ||
          "Error creando cuenta Stripe",

        updatedAt:
          admin.firestore.FieldValue
            .serverTimestamp(),
      });

      throw stripeError;
    }

    // ==========================================
    // ACTUALIZAR ORGANIZADOR CON STRIPE
    // ==========================================

    await organizerRef.update({
      connectedAccountId: account.id,

      stripeStatus: "created",

      chargesEnabled:
        account.charges_enabled,

      payoutsEnabled:
        account.payouts_enabled,

      detailsSubmitted:
        account.details_submitted,

      updatedAt:
        admin.firestore.FieldValue
          .serverTimestamp(),
    });

    // ==========================================
    // RESPUESTA STRIPE
    // ==========================================

    return res.status(200).json({
      ok: true,

      organizerId: organizerRef.id,

      paymentProvider: "stripe",

      connectedAccountId: account.id,
    });

  } catch (error: any) {
    console.error(
      "Error creando organizador:",
      error
    );

    return res.status(500).json({
      ok: false,

      error:
        error?.message ||
        "Error interno al crear el organizador",
    });
  }
}