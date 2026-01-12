import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * =========================================================
 * 1) BORRAR INSCRIPCIONES DE UNA CARRERA
 * =========================================================
 */
export const borrarInscripcionesDeCarrera = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth?.token.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Requiere permisos de administrador"
      );
    }

    const { carreraId } = data as { carreraId: string };
    if (!carreraId) {
      throw new functions.https.HttpsError("invalid-argument", "Falta carreraId");
    }

    const insSnap = await db
      .collection("inscripciones")
      .where("carreraId", "==", carreraId)
      .get();

    if (insSnap.empty) return { eliminado: 0 };

    const batch = db.batch();
    const carreraRef = db.collection("carreras").doc(carreraId);

    for (const docSnap of insSnap.docs) {
      const data = docSnap.data() as any;
      const n = Number(data.competitorNumber || 0);

      if (n > 0) {
        batch.set(
          carreraRef.collection("freeNumbers").doc(String(n)),
          {
            n,
            releasedAt: FieldValue.serverTimestamp(),
            reason: "admin_delete",
          },
          { merge: true }
        );
      }

      batch.delete(docSnap.ref);
    }

    await batch.commit();
    return { eliminado: insSnap.size };
  });

/**
 * =========================================================
 * 2) CRON: LIBERAR NÚMEROS DE LINKS MANUALES EXPIRADOS
 * =========================================================
 */
export const liberarNumerosDeTempUsuariosExpirados = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .pubsub.schedule("every 5 minutes")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();

    const tempSnap = await db
      .collection("tempusuarios")
      .where("expiresAt", "<=", now)
      .where("processed", "==", false)
      .get();

    if (tempSnap.empty) return null;

    for (const tempDoc of tempSnap.docs) {
      const temp = tempDoc.data() as any;
      const { carreraId, range } = temp;

      if (!carreraId || !range?.start || !range?.end) {
        await tempDoc.ref.update({
          processed: true,
          processedAt: FieldValue.serverTimestamp(),
          reason: "invalid_range",
        });
        continue;
      }

      const start = Number(range.start);
      const end = Number(range.end);

      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        await tempDoc.ref.update({
          processed: true,
          processedAt: FieldValue.serverTimestamp(),
          reason: "invalid_numbers",
        });
        continue;
      }

      const carreraRef = db.collection("carreras").doc(carreraId);

      // 🔹 usados
      const insSnap = await db
        .collection("inscripciones")
        .where("carreraId", "==", carreraId)
        .where("competitorNumber", ">=", start)
        .where("competitorNumber", "<=", end)
        .get();

      const usados = new Set<number>();
      insSnap.docs.forEach((d) => {
        const n = Number(d.get("competitorNumber"));
        if (n > 0) usados.add(n);
      });

      // 🔹 liberar en batches (máx 400 writes)
      let batch = db.batch();
      let writes = 0;

      for (let n = start; n <= end; n++) {
        if (usados.has(n)) continue;

        batch.set(
          carreraRef.collection("freeNumbers").doc(String(n)),
          {
            n,
            releasedAt: FieldValue.serverTimestamp(),
            reason: "tempusuario_expired",
          },
          { merge: true }
        );

        writes++;

        if (writes >= 400) {
          await batch.commit();
          batch = db.batch();
          writes = 0;
        }
      }

      batch.update(tempDoc.ref, {
        processed: true,
        processedAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();
    }

    return null;
  });
