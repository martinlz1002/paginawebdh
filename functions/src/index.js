const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const express   = require('express');
const cors      = require('cors');

admin.initializeApp();

const app = express();

// 1) CORS global: permite orígenes desde cualquier dominio
app.use(cors({ origin: true }));
app.options('*', cors({ origin: true }));

// 2) Body parser para JSON (y payloads hasta 10 MB, por el base64)
app.use(express.json({ limit: '10mb' }));

// 3) Endpoint POST /crearCarrera
app.post('/crearCarrera', async (req, res) => {
  // (Opcional) Autenticación por token en cabecera
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  // Datos obligatorios
  const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo } = req.body;
  if (!titulo || !descripcion || !ubicacion || !fecha || !imagenBase64 || !nombreArchivo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  try {
    // Subida de la imagen
    const buffer = Buffer.from(imagenBase64, 'base64');
    const bucket = admin.storage().bucket();
    const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
    const file = bucket.file(filePath);

    await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
    const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2030' });

    // Guardar la carrera en Firestore
    await admin.firestore().collection('carreras').add({
      titulo,
      descripcion,
      ubicacion,
      fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
      imagenUrl: url,
      creado: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ mensaje: 'Carrera creada exitosamente', imagenUrl: url });
  } catch (err) {
    console.error('Error al crear carrera:', err);
    return res.status(500).json({ error: 'Error interno al crear la carrera.' });
  }
});

// 4) Exportar la app Express como función HTTPS
exports.api = functions.https.onRequest(app);