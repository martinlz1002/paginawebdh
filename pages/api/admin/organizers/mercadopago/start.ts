import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import * as admin from "firebase-admin";
import { randomBytes } from "crypto";

import { requireAdmin } from "../../../../../lib/adminAuth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido",
    });
  }

  try {
    await requireAdmin(req);

    const {
      organizerId,
    } = req.body || {};

    if (
      typeof organizerId !== "string" ||
      !organizerId.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "organizerId es obligatorio",
      });
    }

    const clientId =
      process.env.MERCADOPAGO_CLIENT_ID;

    const redirectUri =
      process.env.MERCADOPAGO_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        ok: false,
        error:
          "Falta configurar Client ID o Redirect URI de Mercado Pago",
      });
    }

    const db = admin.firestore();

    const organizerRef = db
      .collection("organizadores")
      .doc(organizerId);

    const organizerSnap =
      await organizerRef.get();

    if (!organizerSnap.exists) {
      return res.status(404).json({
        ok: false,
        error: "Organizador no encontrado",
      });
    }

    const organizer =
      organizerSnap.data();

    if (
      organizer?.paymentProvider !==
      "mercadopago"
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Este organizador no utiliza Mercado Pago",
      });
    }

    // Estado aleatorio para proteger el flujo OAuth.
const state = randomBytes(32).toString("hex");

const createdAt = Date.now();

// El enlace tendrá una vigencia de 24 horas.
const expiresAt = createdAt + 24 * 60 * 60 * 1000;

// Guardamos el estado asociado al organizador.
await db
  .collection("mercadoPagoOAuthStates")
  .doc(state)
  .set({
    organizerId,
    createdAt,
    expiresAt,
    used: false,
  });

    const authUrl = new URL(
      "https://auth.mercadopago.com/authorization"
    );

    console.log(
  "[MP OAuth URL]",
  authUrl.toString().replace(
    /client_id=[^&]+/,
    "client_id=OCULTO"
  )
);

    authUrl.searchParams.set(
      "client_id",
      clientId
    );

    authUrl.searchParams.set(
      "response_type",
      "code"
    );

    authUrl.searchParams.set(
      "platform_id",
      "mp"
    );

    authUrl.searchParams.set(
      "state",
      state
    );

    authUrl.searchParams.set(
      "redirect_uri",
      redirectUri
    );

    return res.status(200).json({
      ok: true,
      url: authUrl.toString(),
    });

  } catch (error: any) {
    console.error(
      "[MP OAuth start]",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Error iniciando OAuth de Mercado Pago",
    });
  }
}