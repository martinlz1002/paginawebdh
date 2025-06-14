import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

admin.initializeApp();

const app = express();

// 1) Middleware CORS para todas las rutas y preflight
app.use(cors({ origin: true }));
app.options('*', cors({ origin: true })); // responde a OPTIONS

// 2) Body parser para JSON (y payloads grandes en base64)
app.use(express.json({ limit: '10mb' }));

// 3) Encabezados adicionales (por si acaso)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  next();
});

// --- RUTA: POST /crearCarrera
app.post('/crearCarrera', async (req: Request, res: Response) => {
  try {
    // (Opcional) validación de token en header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Datos obligatorios
    const {
      titulo,
      descripcion,
      ubicacion,
      fecha,
      imagenBase64,
      nombreArchivo,
    } = req.body;
    if (
      !titulo ||
      !descripcion ||
      !ubicacion ||
      !fecha ||
      !imagenBase64 ||
      !nombreArchivo
    ) {
      return res
        .status(400)
        .json({ error: 'Faltan datos obligatorios para crear la carrera.' });
    }

    // 1) Subida de imagen a Firebase Storage
    const buffer = Buffer.from(imagenBase64, 'base64');
    const bucket = admin.storage().bucket();
    const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType: 'image/jpeg' },
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2030',
    });

    // 2) Guardar carrera en Firestore
    await admin.firestore().collection('carreras').add({
      titulo,
      descripcion,
      ubicacion,
      fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
      imagenUrl: url,
      creado: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res
      .status(200)
      .json({ mensaje: 'Carrera creada exitosamente', imagenUrl: url });
  } catch (error: any) {
    console.error('Error al crear la carrera:', error);
    return res
      .status(500)
      .json({ error: 'Error interno al crear la carrera.' });
  }
});

// 4) Exportar la app Express como Cloud Function
export const api = functions.https.onRequest(app);