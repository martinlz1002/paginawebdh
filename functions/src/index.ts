// functions/src/index.ts
import * as admin from "firebase-admin";
import express from "express";
import { onRequest } from "firebase-functions/v2/https";

admin.initializeApp();

const app = express();

// Middleware CORS manual
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "OPTIONS, POST");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }
  next();
});

app.use(express.json());

// Middleware de verificación de ID Token
async function validateFirebaseIdToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.header("Authorization") || req.header("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: "No autenticado" });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    (req as any).uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

app.post(
  "/crearCarrera",
  validateFirebaseIdToken,
  async (req, res) => {
    const {
      titulo,
      descripcion,
      ubicacion,
      fecha,
      imagenBase64,
      nombreArchivo,
    } = req.body as {
      titulo: string;
      descripcion: string;
      ubicacion: string;
      fecha: string;
      imagenBase64: string;
      nombreArchivo: string;
    };

    if (!titulo || !fecha || !imagenBase64 || !nombreArchivo) {
      return res.status(400).json({ error: "Faltan campos obligatorios." });
    }

    try {
      // Subir imagen
      const buffer = Buffer.from(imagenBase64, "base64");
      const bucket = admin.storage().bucket();
      const path = `carreras/${Date.now()}_${nombreArchivo}`;
      const file = bucket.file(path);
      await file.save(buffer, { metadata: { contentType: "image/jpeg" } });
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2030",
      });

      // Guardar en Firestore
      await admin.firestore().collection("carreras").add({
        titulo,
        descripcion,
        ubicacion,
        fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
        imagenUrl: url,
        creado: admin.firestore.FieldValue.serverTimestamp(),
        creadoPor: (req as any).uid,
      });

      return res.json({ mensaje: "Carrera creada exitosamente" });
    } catch (error) {
      console.error("Error al crear carrera:", error);
      return res.status(500).json({ error: "Error interno al crear la carrera." });
    }
  }
);

// Exporta con la API v2 y forzando región us-central1
export const api = onRequest({ region: "us-central1" }, app);