import type { NextApiRequest, NextApiResponse } from "next";
import { admin } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

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
    // Comprobar que quien ejecuta la acción sea administrador
    await requireAdmin(req);

    const { uid } = req.body;

    if (!uid || typeof uid !== "string") {
      return res.status(400).json({
        ok: false,
        error: "UID del usuario no proporcionado",
      });
    }

    // Comprobar que el usuario exista
    const user = await admin.auth().getUser(uid);

    // Verificar correo sin enviar ningún email
    await admin.auth().updateUser(uid, {
      emailVerified: true,
    });

    return res.status(200).json({
      ok: true,
      message: `Cuenta verificada correctamente: ${user.email}`,
      uid,
    });

  } catch (error: any) {
    console.error("[verificar-correo]", error);

    return res.status(
      error.message === "Usuario no autenticado" ||
      error.message === "Requiere permisos de administrador"
        ? 403
        : 500
    ).json({
      ok: false,
      error: error.message || "Error al verificar la cuenta",
    });
  }
}