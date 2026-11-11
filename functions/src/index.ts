import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * =========================================================
 * Helper: validar admin
 * =========================================================
 */
async function assertAdmin(context: any) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Usuario no autenticado"
    );
  }

  const uid = context.auth.uid;
  const snap = await db.collection("usuarios").doc(uid).get();

  if (!snap.exists || snap.data()?.admin !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Requiere permisos de administrador"
    );
  }

  return uid;
}

/**
 * =========================================================
 * 1) BORRAR INSCRIPCIONES DE UNA CARRERA
 * =========================================================
 */
export const borrarInscripcionesDeCarrera = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onCall(async (data: any, context: any) => {
    await assertAdmin(context);

    const { carreraId } = data;
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
      const d = docSnap.data() as any;
      const n = Number(d.competitorNumber || 0);

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
 * 2) ELIMINAR LINK DE INSCRIPCIÓN MANUAL
 * =========================================================
 */
export const eliminarTempUsuario = functions
  .runWith({ memory: "128MB", timeoutSeconds: 30 })
  .https.onCall(async (data: any, context: any) => {
    await assertAdmin(context);

    const { tempId } = data;
    if (!tempId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Falta tempId"
      );
    }

    const ref = db.collection("tempusuarios").doc(tempId);
    const snap = await ref.get();

    if (snap.exists) {
      await ref.delete();
    }

    return { ok: true };
  });

/**
 * =========================================================
 * 3) CRON: LIBERAR NÚMEROS DE LINKS EXPIRADOS
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

/**
 * =========================================================
 * 4) CONFIGURAR MESAS DE ENTREGA (solo administrador)
 * =========================================================
 */
function validarRangos(ranges: any[]) {
  if (!Array.isArray(ranges) || ranges.length < 1 || ranges.length > 30) {
    throw new functions.https.HttpsError("invalid-argument", "Configura entre 1 y 30 mesas.");
  }
  const normalized = ranges.map((r, index) => {
    const id = String(r.id || `mesa-${index + 1}`).trim();
    const nombre = String(r.nombre || `Mesa ${index + 1}`).trim();
    const desde = Number(r.desde);
    const hasta = Number(r.hasta);
    if (!id || !nombre || !Number.isSafeInteger(desde) || !Number.isSafeInteger(hasta) || desde < 1 || hasta < desde) {
      throw new functions.https.HttpsError("invalid-argument", `Rango inválido en ${nombre || `Mesa ${index + 1}`}.`);
    }
    return { id, nombre, desde, hasta };
  }).sort((a, b) => a.desde - b.desde);
  const ids = new Set<string>();
  for (let i = 0; i < normalized.length; i++) {
    if (ids.has(normalized[i].id)) throw new functions.https.HttpsError("invalid-argument", "Los identificadores de mesa deben ser únicos.");
    ids.add(normalized[i].id);
    if (i > 0 && normalized[i].desde <= normalized[i - 1].hasta) {
      throw new functions.https.HttpsError("invalid-argument", "Los rangos de las mesas se enciman.");
    }
  }
  return normalized;
}

export const configurarMesasEntrega = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: any, context: any) => {
    await assertAdmin(context);
    const ranges = validarRangos(data.ranges);
    const pin = String(data.pin || "");
    if (!/^\d{4,8}$/.test(pin)) {
      throw new functions.https.HttpsError("invalid-argument", "El PIN debe contener entre 4 y 8 dígitos.");
    }
    const activeRef = db.collection("busquedaCompetidor").doc("active");
    const activeEventSnap = await activeRef.get();
    if (!activeEventSnap.exists) {
      throw new functions.https.HttpsError("failed-precondition", "Primero publica la lista de competidores.");
    }
    const configRef = db.collection("configuracionEntrega").doc("active");
    const configSnap = await configRef.get();
    const existingRanges = configSnap.get("ranges") || [];
    const deliveriesSnap = await activeRef.collection("entregas").limit(1).get();
    const rangesChanged = JSON.stringify(existingRanges.map((r: any) => ({ id: r.id, nombre: r.nombre, desde: r.desde, hasta: r.hasta }))) !== JSON.stringify(ranges.map((r) => ({ id: r.id, nombre: r.nombre, desde: r.desde, hasta: r.hasta })));
    if (!deliveriesSnap.empty && rangesChanged) {
      throw new functions.https.HttpsError("failed-precondition", "Ya hay entregas iniciadas. No puedes cambiar los rangos durante el evento; puedes actualizar el PIN sin modificar las mesas.");
    }
    const competitors = await activeRef.collection("competidores").get();
    const numbers = competitors.docs.map((d) => ({
      id: d.id,
      bib: Number(String(d.get("Bib") ?? "").trim()),
    }));
    const unassigned = numbers.filter((item) =>
      !Number.isSafeInteger(item.bib) || item.bib < 1 || !ranges.some((range) => item.bib >= range.desde && item.bib <= range.hasta)
    );
    if (unassigned.length > 0) {
      const examples = unassigned.slice(0, 5).map((item) => Number.isFinite(item.bib) ? item.bib : "sin número").join(", ");
      throw new functions.https.HttpsError("failed-precondition", `${unassigned.length} competidores no tienen un número válido o están fuera de los rangos. Ejemplos: ${examples}. Ajusta los rangos antes de guardar.`);
    }
    const rangesWithCounts = ranges.map((range) => ({
      ...range,
      totalCompetidores: numbers.filter((item) => item.bib >= range.desde && item.bib <= range.hasta).length,
    }));
    const salt = randomBytes(16).toString("hex");
    const pinHash = scryptSync(pin, salt, 64).toString("hex");
    await configRef.set({
      ranges: rangesWithCounts,
      pinSalt: salt,
      pinHash,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true, ranges: rangesWithCounts };
  });

async function validarPinEntrega(pin: string) {
  const active = await db.collection("busquedaCompetidor").doc("active").get();
  if (!active.exists) throw new functions.https.HttpsError("not-found", "No hay una búsqueda de competidores activa.");
  const configSnap = await db.collection("configuracionEntrega").doc("active").get();
  const config = configSnap.exists ? configSnap.data() : null;
  if (!config?.pinSalt || !config?.pinHash || !Array.isArray(config.ranges)) {
    throw new functions.https.HttpsError("failed-precondition", "Primero configura las mesas y el PIN desde administración.");
  }
  const candidate = scryptSync(pin, config.pinSalt, 64);
  const expected = Buffer.from(config.pinHash, "hex");
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
    throw new functions.https.HttpsError("permission-denied", "PIN incorrecto.");
  }
  return { ranges: config.ranges as Array<{ id: string; nombre: string; desde: number; hasta: number }> };
}


/**
 * =========================================================
 * 4B) RECONSTRUIR PROYECCIÓN PÚBLICA DEL BUSCADOR
 * Permite reparar una publicación existente sin volver a cargar el Excel.
 * =========================================================
 */
export const sincronizarPublicCompetidores = functions
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .https.onCall(async (_data: any, context: any) => {
    await assertAdmin(context);

    const activeRef = db.collection("busquedaCompetidor").doc("active");
    const activeSnap = await activeRef.get();
    if (!activeSnap.exists) {
      throw new functions.https.HttpsError("failed-precondition", "Primero publica la lista de competidores.");
    }

    const fields = Array.isArray(activeSnap.get("fields")) ? activeSnap.get("fields") as string[] : [];
    const competitorsSnap = await activeRef.collection("competidores").get();
    if (competitorsSnap.empty) {
      throw new functions.https.HttpsError("failed-precondition", "La lista activa no contiene competidores.");
    }

    const publicRef = activeRef.collection("publicCompetidores");
    const existingPublicSnap = await publicRef.get();
    const existingById = new Map(existingPublicSnap.docs.map((d) => [d.id, d.data()]));
    const normalize = (value: any) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ");
    const prefixes = (value: any): string[] => {
      const text = normalize(value);
      if (!text) return [];
      const result = new Set<string>();
      for (let i = 1; i <= text.length; i++) result.add(text.slice(0, i));
      for (const word of text.split(/\s+/).filter(Boolean)) {
        for (let i = 1; i <= word.length; i++) result.add(word.slice(0, i));
      }
      return Array.from(result);
    };

    let batch = db.batch();
    let writes = 0;
    let count = 0;
    for (const competitorDoc of competitorsSnap.docs) {
      const competitor = competitorDoc.data() as any;
      const searchValues = [
        competitor.Participant, competitor.Bib, competitor.Celular, competitor.Ficha,
        competitor.EquipoName, competitor.RouteName, competitor.CategoryName,
        competitor.Estado, competitor.Ciudad, competitor.Municipio,
        competitor.Country, competitor.Rama, competitor.Email,
      ];
      const searchTerms = Array.isArray(competitor.search_terms) && competitor.search_terms.length
        ? competitor.search_terms
        : Array.from(new Set(searchValues.flatMap(prefixes)));
      const previous = existingById.get(competitorDoc.id) || {};
      const record: Record<string, any> = {
        Bib: competitor.Bib ?? "",
        Participant: competitor.Participant ?? "",
        RouteName: competitor.RouteName ?? "",
        CategoryName: competitor.CategoryName ?? "",
        participant_search: competitor.participant_search || normalize(competitor.Participant),
        search_terms: searchTerms,
        estadoEntrega: previous.estadoEntrega || competitor.estadoEntrega || "pendiente",
        mesaId: previous.mesaId ?? competitor.mesaId ?? null,
        mesaNombre: previous.mesaNombre ?? competitor.mesaNombre ?? null,
      };
      for (const field of fields) {
        const value = competitor[field];
        if (value !== undefined && value !== null) record[field] = value;
      }
      batch.set(publicRef.doc(competitorDoc.id), record, { merge: true });
      writes++;
      count++;
      if (writes >= 400) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }
    if (writes > 0) await batch.commit();
    return { ok: true, sincronizados: count };
  });

/**
 * =========================================================
 * 5) MARCAR COMPETIDOR ENCONTRADO Y ASIGNAR MESA
 * =========================================================
 */
export const marcarCompetidorEncontrado = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: any) => {
    const competitorId = String(data.competitorId || "").trim();
    const pin = String(data.pin || "");
    if (!competitorId || !pin) throw new functions.https.HttpsError("invalid-argument", "Faltan datos del competidor o PIN.");
    const { ranges } = await validarPinEntrega(pin);
    const activeRef = db.collection("busquedaCompetidor").doc("active");
    const competitorRef = activeRef.collection("competidores").doc(competitorId);
    const publicRef = activeRef.collection("publicCompetidores").doc(competitorId);
    const deliveryRef = activeRef.collection("entregas").doc(competitorId);
    return db.runTransaction(async (tx) => {
      const activeSnap = await tx.get(activeRef);
      const competitorSnap = await tx.get(competitorRef);
      const publicSnap = await tx.get(publicRef);
      if (!competitorSnap.exists || !publicSnap.exists) throw new functions.https.HttpsError("not-found", "No se encontró el competidor publicado.");
      const competitor = competitorSnap.data() as any;
      const bib = Number(String(competitor.Bib ?? "").trim());
      if (!Number.isSafeInteger(bib) || bib < 1) throw new functions.https.HttpsError("failed-precondition", "El competidor no tiene un número válido (Bib).");
      const mesa = ranges.find((r) => bib >= Number(r.desde) && bib <= Number(r.hasta));
      if (!mesa) throw new functions.https.HttpsError("failed-precondition", `El número ${bib} no pertenece a ningún rango de mesa configurado.`);
      if (competitor.estadoEntrega === "en_proceso" || competitor.estadoEntrega === "entregado") {
        throw new functions.https.HttpsError("already-exists", competitor.estadoEntrega === "entregado" ? "Este kit ya fue entregado." : `Este competidor ya está asignado a ${competitor.mesaNombre || mesa.nombre}.`);
      }
      const configuredFields = activeSnap.get("fields");
      const fields = Array.isArray(configuredFields) ? configuredFields as string[] : [];
      const safeDetails: Record<string, any> = {};
      for (const field of fields) {
        if (/email|correo|celular|telefono|teléfono|phone|direccion|dirección/i.test(field)) continue;
        const value = competitor[field];
        if (value !== undefined && value !== null && String(value).trim() !== "") safeDetails[field] = value;
      }
      const now = FieldValue.serverTimestamp();
      tx.update(competitorRef, {
        estadoEntrega: "en_proceso",
        mesaId: mesa.id,
        mesaNombre: mesa.nombre,
        encontradoAt: now,
      });
      tx.update(publicRef, {
        estadoEntrega: "en_proceso",
        mesaId: mesa.id,
        mesaNombre: mesa.nombre,
      });
      tx.set(deliveryRef, {
        competitorId,
        estado: "en_proceso",
        mesaId: mesa.id,
        mesaNombre: mesa.nombre,
        bib,
        participant: String(competitor.Participant || "Sin nombre"),
        routeName: String(competitor.RouteName || ""),
        categoryName: String(competitor.CategoryName || ""),
        talla: Object.entries(competitor).find(([key]) => /talla|playera|camiseta/i.test(key))?.[1] ?? "",
        details: safeDetails,
        encontradoAt: now,
        entregadoAt: null,
      });
      return { ok: true, mesaId: mesa.id, mesaNombre: mesa.nombre, bib };
    });
  });

/**
 * =========================================================
 * 6) MARCAR KIT ENTREGADO
 * =========================================================
 */
export const marcarKitEntregado = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: any) => {
    const competitorId = String(data.competitorId || "").trim();
    const mesaId = String(data.mesaId || "").trim();
    const pin = String(data.pin || "");
    if (!competitorId || !mesaId || !pin) throw new functions.https.HttpsError("invalid-argument", "Faltan datos para completar la entrega.");
    await validarPinEntrega(pin);
    const activeRef = db.collection("busquedaCompetidor").doc("active");
    const competitorRef = activeRef.collection("competidores").doc(competitorId);
    const publicRef = activeRef.collection("publicCompetidores").doc(competitorId);
    const deliveryRef = activeRef.collection("entregas").doc(competitorId);
    return db.runTransaction(async (tx) => {
      const deliverySnap = await tx.get(deliveryRef);
      const competitorSnap = await tx.get(competitorRef);
      const publicSnap = await tx.get(publicRef);
      if (!deliverySnap.exists || !competitorSnap.exists || !publicSnap.exists) throw new functions.https.HttpsError("not-found", "No se encontró el registro de entrega.");
      const delivery = deliverySnap.data() as any;
      if (delivery.mesaId !== mesaId) throw new functions.https.HttpsError("permission-denied", "Este competidor pertenece a otra mesa.");
      if (delivery.estado !== "en_proceso") throw new functions.https.HttpsError("failed-precondition", "El kit ya no está pendiente de entrega.");
      const now = FieldValue.serverTimestamp();
      tx.update(deliveryRef, { estado: "entregado", entregadoAt: now });
      tx.update(competitorRef, { estadoEntrega: "entregado", entregadoAt: now });
      tx.update(publicRef, { estadoEntrega: "entregado" });
      return { ok: true };
    });
  });
