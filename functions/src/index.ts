// functions/src/index.ts
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';

// Inicializar SDK Admin
admin.initializeApp();

// Crear servidor Express
const app = express();

// Permitir CORS para peticiones desde cualquier origen
app.use(cors({ origin: true }));
app.use(express.json());

// Middleware de autenticación de Firebase
async function validateFirebaseIdToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const idToken = header.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    (req as any).uid = decoded.uid;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Ruta POST para crear carrera
app.post(
  '/crearCarrera',
  validateFirebaseIdToken,
  async (req, res) => {
    const {
      titulo,
      descripcion,
      ubicacion,
      fecha,
      imagenBase64,
      nombreArchivo,
    } = req.body as Record<string, string>;

    if (!titulo || !fecha || !imagenBase64 || !nombreArchivo) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    try {
      // Subir imagen a Storage
      const buffer = Buffer.from(imagenBase64, 'base64');
      const bucket = admin.storage().bucket();
      const path = `carreras/${Date.now()}_${nombreArchivo}`;
      const file = bucket.file(path);
      await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
      const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2030' });

      // Guardar documento en Firestore
      await admin.firestore().collection('carreras').add({
        titulo,
        descripcion,
        ubicacion,
        fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
        imagenUrl: url,
        creado: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({ mensaje: 'Carrera creada exitosamente' });
    } catch (error) {
      console.error('Error al crear carrera:', error);
      return res.status(500).json({ error: 'Error interno al crear la carrera.' });
    }
  }
);

// Exportar función en US Central 1
export const api = onRequest({ region: 'us-central1' }, app);
