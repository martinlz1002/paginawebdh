import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const crearCarrera = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo } = data;

  // Validación de imagen
  if (!imagenBase64 || !nombreArchivo) {
    throw new functions.https.HttpsError("invalid-argument", "Imagen y nombre de archivo son requeridos.");
  }

  const buffer = Buffer.from(imagenBase64, "base64");

  const allowedTypes = ["image/jpeg", "image/png"];
  const fileType = nombreArchivo.split(".").pop()?.toLowerCase();
  if (!allowedTypes.includes(`image/${fileType}`)) {
    throw new functions.https.HttpsError("invalid-argument", "Tipo de archivo no válido. Solo se permiten imágenes JPEG y PNG.");
  }

  try {
    const bucket = admin.storage().bucket();
    const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType: `image/${fileType}`,
      },
    });

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2030",
    });

    await admin.firestore().collection("carreras").add({
      titulo,
      descripcion,
      ubicacion,
      fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
      imagenUrl: url,
      creado: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { mensaje: "Carrera creada exitosamente" };
  } catch (error) {
    console.error("Error al crear carrera:", error);
    throw new functions.https.HttpsError("internal", "Error al crear carrera.");
  }
});