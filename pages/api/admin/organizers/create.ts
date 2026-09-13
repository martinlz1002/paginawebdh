import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import * as admin from "firebase-admin";

import { createOrganizerAccount } from "../../../../lib/stripeConnect";
import { requireAdmin } from "../../../../lib/adminAuth";

type ResponseData =
  | {
      ok: true;
      organizerId: string;
      connectedAccountId: string;
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

    const nombreLimpio =
      nombre.trim();

    const emailLimpio =
      email.trim().toLowerCase();

    // ==========================================
    // FIREBASE ADMIN
    // ==========================================

    const db =
      admin.firestore();

    // ==========================================
    // EVITAR ORGANIZADORES DUPLICADOS
    // ==========================================

    const existentes =
      await db
        .collection("organizadores")
        .where(
          "email",
          "==",
          emailLimpio
        )
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
    //
    // Primero dejamos constancia en Firestore.
    // Así, si Stripe falla, no perdemos el intento.
    //
    // ==========================================

    const organizerRef =
      db
        .collection("organizadores")
        .doc();

    await organizerRef.set({
      nombre: nombreLimpio,
      email: emailLimpio,

      connectedAccountId: "",

      stripeStatus: "creating",

      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,

      activo: true,

      createdAt:
        admin.firestore.FieldValue
          .serverTimestamp(),

      updatedAt:
        admin.firestore.FieldValue
          .serverTimestamp(),
    });

    // ==========================================
    // CREAR CUENTA STRIPE EXPRESS
    // ==========================================

    let account;

    try {
      account =
        await createOrganizerAccount({
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
    // ACTUALIZAR ORGANIZADOR
    // ==========================================

    await organizerRef.update({
      connectedAccountId:
        account.id,

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
    // RESPUESTA
    // ==========================================

    return res.status(200).json({
      ok: true,

      organizerId:
        organizerRef.id,

      connectedAccountId:
        account.id,
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