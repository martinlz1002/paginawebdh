import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";
import {
  reservarCupoEnTransaccion,
  CupoAgotadoError,
  CupoError,
} from "@/lib/cupos";

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (!raw) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_KEY_B64");
  const serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const firestore = admin.firestore();
type Body = {
  credentials?: { username?: string; password?: string };
  tempId?: string;
  carreraTitulo?: string;
  competitorNumber?: number | string;
  fechaNacimiento?: string;
  [key: string]: unknown;
};

function texto(value: unknown, max = 250): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = (req.body ?? {}) as Body;
    const username = texto(body.credentials?.username, 100);
    const password = typeof body.credentials?.password === "string" ? body.credentials.password : "";
    const tempId = texto(body.tempId, 150);
    const numero = Number(body.competitorNumber);

    if (!username || !password || !tempId) {
      return res.status(400).json({ ok: false, error: "La sesión de la mesa no es válida. Vuelve a iniciar sesión." });
    }
    if (!Number.isSafeInteger(numero) || numero <= 0) {
      return res.status(400).json({ ok: false, error: "El número de competidor no es válido." });
    }

    // Las credenciales se verifican contra Firestore en el servidor.
    const credentialSnap = await firestore.collection("tempusuarios")
      .where("username", "==", username)
      .where("password", "==", password)
      .limit(2).get();

    if (credentialSnap.size !== 1 || credentialSnap.docs[0].id !== tempId) {
      return res.status(401).json({ ok: false, error: "La sesión temporal no es válida. Inicia sesión nuevamente." });
    }

    const tempRef = firestore.collection("tempusuarios").doc(tempId);
    const tempInitial = credentialSnap.docs[0].data();
    const carreraId = texto(tempInitial.carreraId, 150);
    const range = tempInitial.range;
    if (!carreraId || !range || typeof range.start !== "number" || typeof range.end !== "number" ||
        !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) ||
        range.start <= 0 || range.end < range.start || numero < range.start || numero > range.end) {
      return res.status(403).json({ ok: false, error: "El número seleccionado no pertenece al rango autorizado para esta mesa." });
    }

    const birth = texto(body.fechaNacimiento, 20);
    const match = birth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return res.status(400).json({ ok: false, error: "La fecha de nacimiento no es válida." });
    const fechaNacimiento = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (fechaNacimiento.getFullYear() !== Number(match[1]) || fechaNacimiento.getMonth() !== Number(match[2]) - 1 || fechaNacimiento.getDate() !== Number(match[3])) {
      return res.status(400).json({ ok: false, error: "La fecha de nacimiento no es válida." });
    }

    const required = ["nombre", "paterno", "materno", "nombres", "rama", "ruta", "categoria", "pais", "estado", "ciudad", "celular", "email", "tallaPlayera", "telefonoEmergencia"] as const;
    for (const field of required) {
      if (!texto(body[field], field === "email" ? 180 : 250)) {
        return res.status(400).json({ ok: false, error: `Falta el campo obligatorio: ${field}.` });
      }
    }

    const carreraRef = firestore.collection("carreras").doc(carreraId);
    const inscripcionRef = firestore.collection("inscripciones").doc();
    const allocatorRef = firestore.collection("numberAllocators").doc(carreraId);
    const inscripcionesQuery = firestore.collection("inscripciones").where("carreraId", "==", carreraId);

    await firestore.runTransaction(async (tx) => {
      // Todas las lecturas se completan antes de la primera escritura.
      const [tempSnap, carreraSnap, allocatorSnap, inscripcionesSnap] = await Promise.all([
        tx.get(tempRef), tx.get(carreraRef), tx.get(allocatorRef), tx.get(inscripcionesQuery),
      ]);
      if (!tempSnap.exists) throw new Error("La cuenta temporal ya no existe.");
      const temp = tempSnap.data()!;
      const exp = temp.expiresAt?.toDate ? temp.expiresAt.toDate() : new Date(temp.expiresAt);
      if (!Number.isFinite(exp.getTime()) || exp.getTime() <= Date.now()) throw new Error("El enlace de esta mesa expiró. Inicia sesión nuevamente.");
      if (temp.username !== username || temp.password !== password || temp.carreraId !== carreraId) throw new Error("La autorización de esta mesa cambió. Inicia sesión nuevamente.");
      if (!carreraSnap.exists) throw new Error("La carrera ya no existe.");
      const liveRange = temp.range;
      if (!liveRange || numero < liveRange.start || numero > liveRange.end) throw new Error("El número no pertenece al rango autorizado de esta mesa.");

      const ocupado = inscripcionesSnap.docs.some((d) => {
        const item = d.data();
        return [item.competitorNumber, item.ficha, item.bib].some((v) => Number(v) === numero);
      });
      if (ocupado) throw new Error(`El número ${numero} ya está ocupado. Actualiza la disponibilidad.`);

      const revision = Number(allocatorSnap.exists ? allocatorSnap.get("revision") ?? 0 : 0);
      if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("El control de números requiere revisión administrativa.");

      await reservarCupoEnTransaccion(tx, firestore, carreraId, inscripcionRef.id, "manual");

      const carrera = carreraSnap.data() ?? {};
      tx.set(allocatorRef, { revision: revision + 1, updatedAt: Date.now() }, { merge: true });
      tx.create(inscripcionRef, {
        carreraId,
        carreraTitulo: texto(carrera.titulo || carrera.nombreEvento || carrera.nombre || body.carreraTitulo, 250),
        perfilId: null,
        perfilOwner: "manual",
        competitorNumber: numero,
        ficha: numero,
        bib: numero,
        nombre: texto(body.nombre),
        paterno: texto(body.paterno),
        materno: texto(body.materno),
        nombres: texto(body.nombres),
        rama: texto(body.rama),
        ruta: texto(body.ruta),
        categoria: texto(body.categoria),
        pais: texto(body.pais),
        estado: texto(body.estado),
        ciudad: texto(body.ciudad),
        celular: texto(body.celular),
        club: texto(body.club),
        tallaPlayera: texto(body.tallaPlayera),
        telefonoEmergencia: texto(body.telefonoEmergencia),
        fechaNacimiento: admin.firestore.Timestamp.fromDate(fechaNacimiento),
        email: texto(body.email, 180),
        paymentStatus: "manual",
        sessionId: null,
        isManualEntry: true,
        manualAdminId: tempId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.status(200).json({ ok: true, id: inscripcionRef.id });
  } catch (error: any) {
    console.error("registrar-inscripcion-manual:", error);
    const message = error instanceof Error ? error.message : "No se pudo registrar al competidor.";
    const status = error instanceof CupoAgotadoError ? 409 : error instanceof CupoError ? 409 :
      /expiró|expirad/i.test(message) ? 410 : /ocupado|rango|autorización|autorizada/i.test(message) ? 409 : 400;
    return res.status(status).json({ ok: false, error: message });
  }
}
