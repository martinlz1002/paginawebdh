import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response } from 'express';
import cors from 'cors';

admin.initializeApp();

const app = express();

// 1) CORS: permite peticiones desde cualquier origen (o restringe poniendo tu dominio)
app.use(cors({ origin: true }));

// 2) Body parser para JSON
app.use(express.json({ limit: '10mb' })); // aumenta límite si subes imágenes grandes

// --- RUTA: crearCarrera
app.post('/crearCarrera', async (req: Request, res: Response) => {
  try {
    // Validar autorización (puedes verificar un token aquí)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Desestructuramos datos
    const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo } = req.body;
    if (!titulo || !descripcion || !ubicacion || !fecha || !imagenBase64 || !nombreArchivo) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Subida a Storage
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

    // Escritura en Firestore
    await admin.firestore().collection('carreras').add({
      titulo,
      descripcion,
      ubicacion,
      fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
      imagenUrl: url,
      creado: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ mensaje: 'Carrera creada exitosamente' });
  } catch (error) {
    console.error('Error al crear la carrera:', error);
    return res.status(500).json({ error: 'Error interno', detalle: (error as Error).message });
  }
});

// --- Exponemos la función en la ruta /api/*
export const api = functions.https.onRequest(app);