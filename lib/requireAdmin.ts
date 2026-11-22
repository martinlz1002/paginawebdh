// lib/requireAdmin.ts

import type { NextApiRequest } from "next";
import { admin, adminDb } from "@/lib/firebaseAdmin";

/**
 * Verifica que la petición venga de un usuario autenticado
 * y que ese usuario tenga permisos de administrador.
 */
export async function requireAdmin(req: NextApiRequest) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Usuario no autenticado");
  }

  const idToken = authHeader.substring("Bearer ".length);

  if (!idToken) {
    throw new Error("Token de autenticación vacío");
  }

  const decodedToken = await admin
    .auth()
    .verifyIdToken(idToken);

  const uid = decodedToken.uid;

  const userSnap = await adminDb
    .collection("usuarios")
    .doc(uid)
    .get();

  if (
    !userSnap.exists ||
    userSnap.data()?.admin !== true
  ) {
    throw new Error("Requiere permisos de administrador");
  }

  return {
    uid,
    decodedToken,
    userData: userSnap.data(),
  };
}