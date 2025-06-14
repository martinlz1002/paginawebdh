import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response } from 'express'; // Default import and typing the req and res

admin.initializeApp();

const app = express();

// Endpoint for creating a carrera
app.post('/crearCarrera', async (req: Request, res: Response) => {
  const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo } = req.body;

  // Verificar si el usuario está autenticado
  const user = req.headers.authorization; // Assuming you will send the token in the header
  if (!user) {
    return res.status(401).send('No autenticado');
  }

  try {
    // Procesamiento de la imagen y almacenamiento en Firebase Storage
    const buffer = Buffer.from(imagenBase64, 'base64');
    const bucket = admin.storage().bucket();
    const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/jpeg',
      },
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2030',
    });

    // Guardar los detalles de la carrera en Firestore
    await admin.firestore().collection('carreras').add({
      titulo,
      descripcion,
      ubicacion,
      fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
      imagenUrl: url,
      creado: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send({ mensaje: 'Carrera creada exitosamente' });
  } catch (error) {
    console.error('Error al crear la carrera:', error);
    res.status(500).send({ mensaje: 'Error al crear la carrera', error });
  }
});

// Export the Firebase function
export const api = functions.https.onRequest(app);