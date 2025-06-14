import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";

admin.initializeApp();

const app = express();

// 1) CORS: permite orígenes cruzados desde cualquier dominio
app.use(cors({ origin: true }));

// 2) Parse JSON bodies
app.use(express.json());

// 3) Ruta POST para crear carrera
app.post("/crearCarrera", async (req, res) => {
  // 3.1) Autenticación: espera token Bearer en header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado." });
  }
  const idToken = authHeader.split("Bearer ")[1];

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    return res.status(403).json({ error: "Token inválido." });
  }

  // 3.2) Verificar claim admin en el token
  if (!decoded.admin) {
    return res.status(403).json({ error: "Se requieren permisos de administrador." });
  }

  // 3.3) Validar payload
  const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo } = req.body;
  if (
    !titulo ||
    !descripcion ||
    !ubicacion ||
    !fecha ||
    !imagenBase64 ||
    !nombreArchivo
  ) {
    return res.status(400).json({ error: "Faltan datos obligatorios." });
  }

  try {
    // 3.4) Procesar y subir la imagen
    const buffer = Buffer.from(imagenBase64, "base64");
    const bucket = admin.storage().bucket();
    const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType: "image/jpeg" },
    });
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2030",
    });

    // 3.5) Guardar documento en Firestore
    await admin.firestore().collection("carreras").add({
      titulo,
      descripcion,
      ubicacion,
      fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
      imagenUrl: url,
      creado: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ mensaje: "Carrera creada exitosamente." });
  } catch (error) {
    console.error("Error creando carrera:", error);
    return res.status(500).json({ error: "Error interno al crear carrera." });
  }
});

// 4) Exportar la función en us-central1
export const api = functions.https.onRequest(
  { region: "us-central1" },
  app
);