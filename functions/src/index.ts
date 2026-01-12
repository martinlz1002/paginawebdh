import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * =========================================================
 * 1) BORRAR INSCRIPCIONES DE UNA CARRERA (YA EXISTENTE)
 * =========================================================
 */
export const borrarInscripcionesDeCarrera = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth?.token.admin) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Requiere permisos de administrador"
        );
      }

      const { carreraId } = data as { carreraId: string };
      if (!carreraId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Falta carreraId"
        );
      }

      const insSnap = await db
        .collection("inscripciones")
        .where("carreraId", "==", carreraId)
        .get();

      if (insSnap.empty) {
        return { eliminado: 0 };
      }

      const batch = db.batch();
      const carreraRef = db.collection("carreras").doc(carreraId);

      for (const docSnap of insSnap.docs) {
        const data = docSnap.data() as any;
        const n = data.competitorNumber as number | undefined | null;

        // devolver número al pool si existía
        if (n && Number.isFinite(n) && n > 0) {
          const freeRef = carreraRef
            .collection("freeNumbers")
            .doc(String(n));

          batch.set(
            freeRef,
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
    } catch (e: any) {
      console.error("Error en borrarInscripcionesDeCarrera:", e);
      if (e instanceof functions.https.HttpsError) throw e;
      throw new functions.https.HttpsError(
        "internal",
        e.message || "Error desconocido"
      );
    }
  });

/**
 * =========================================================
 * 2) CRON: LIBERAR NÚMEROS DE LINKS MANUALES EXPIRADOS
 * =========================================================
 *
 * - Corre cada 5 minutos
 * - Procesa tempusuarios vencidos
 * - Devuelve SOLO los números no usados
 * - Marca processedAt para no repetir
 */
export const liberarNumerosDeTempUsuariosExpirados = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .pubsub.schedule("every 5 minutes")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();

    const tempSnap = await db
      .collection("tempusuarios")
      .where("expiresAt", "<=", now)
      .where("processedAt", "==", null)
      .get();

    if (tempSnap.empty) {
      return null;
    }

    for (const tempDoc of tempSnap.docs) {
      const temp = tempDoc.data() as any;
      const { carreraId, range } = temp;

      if (!carreraId || !range?.start || !range?.end) {
        // marcar como procesado para evitar loops
        await tempDoc.ref.update({
          processedAt: FieldValue.serverTimestamp(),
          reason: "invalid_range",
        });
        continue;
      }

      const start = Number(range.start);
      const end = Number(range.end);

      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        await tempDoc.ref.update({
          processedAt: FieldValue.serverTimestamp(),
          reason: "invalid_numbers",
        });
        continue;
      }

      const carreraRef = db.collection("carreras").doc(carreraId);

      // 🔹 obtener inscripciones que SÍ usaron números de ese rango
      const insSnap = await db
        .collection("inscripciones")
        .where("carreraId", "==", carreraId)
        .where("competitorNumber", ">=", start)
        .where("competitorNumber", "<=", end)
        .get();

      const usados = new Set<number>();
      insSnap.docs.forEach((d) => {
        const n = Number(d.get("competitorNumber"));
        if (Number.isFinite(n) && n > 0) {
          usados.add(n);
        }
      });

      const batch = db.batch();

      // 🔹 devolver SOLO los no usados
      for (let n = start; n <= end; n++) {
        if (!usados.has(n)) {
          const freeRef = carreraRef
            .collection("freeNumbers")
            .doc(String(n));

          batch.set(
            freeRef,
            {
              n,
              releasedAt: FieldValue.serverTimestamp(),
              reason: "tempusuario_expired",
            },
            { merge: true }
          );
        }
      }

      // 🔹 marcar tempusuario como procesado (idempotencia)
      batch.update(tempDoc.ref, {
        processedAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();
    }

    return null;
  });
