
// pages/api/admin/usuarios.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { admin, adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      ok: false,
      error: "Método no permitido",
    });
  }

  try {
    // Solo administradores autorizados
    await requireAdmin(req);

    const pageToken =
      typeof req.query.pageToken === "string"
        ? req.query.pageToken
        : undefined;

    // Consultar usuarios de Firebase Authentication
    const result = await admin.auth().listUsers(
      1000,
      pageToken
    );

    // Obtener perfiles de Firestore correspondientes
    const refs = result.users.map((user) =>
      adminDb.collection("usuarios").doc(user.uid)
    );

    const profileDocs = refs.length
      ? await adminDb.getAll(...refs)
      : [];

    const perfiles = new Map(
      profileDocs.map((doc) => [
        doc.id,
        doc.exists ? doc.data() || {} : {},
      ])
    );

    const usuarios = result.users.map((user) => {
      const perfil = perfiles.get(user.uid) || {};

      return {
        uid: user.uid,
        email: user.email || "",
        emailVerified: user.emailVerified,
        displayName: user.displayName || "",
        disabled: user.disabled,
        creationTime: user.metadata.creationTime || "",
        nombre: perfil.nombre || "",
        apPaterno: perfil.apPaterno || "",
        apMaterno: perfil.apMaterno || "",
        ciudad: perfil.ciudad || "",
      };
    });

    return res.status(200).json({
      ok: true,
      usuarios,
      nextPageToken: result.pageToken || null,
    });

  } catch (error: any) {
    console.error("[admin/usuarios]", error);

    const message =
      error?.message || "Error al consultar usuarios";

    const status =
      message === "Usuario no autenticado" ? 401 :
      message === "Requiere permisos de administrador" ? 403 :
      500;

    return res.status(status).json({
      ok: false,
      error: message,
    });
  }
}
