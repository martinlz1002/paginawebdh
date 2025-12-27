/**
 * node scripts/initNextNumber.js
 *
 * Requiere:
 * - npm i firebase-admin
 * - FIREBASE_SERVICE_ACCOUNT_KEY_B64 en tu entorno (igual que tu webhook)
 */
require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;

  const raw = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64,
    "base64"
  ).toString("utf8");

  const serviceAccount = JSON.parse(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  const carrerasSnap = await db.collection("carreras").get();
  console.log("Carreras encontradas:", carrerasSnap.size);

  let updated = 0;

  for (const carreraDoc of carrerasSnap.docs) {
    const carreraId = carreraDoc.id;

    // Busca el mayor competitorNumber en inscripciones de esa carrera
    const maxSnap = await db
      .collection("inscripciones")
      .where("carreraId", "==", carreraId)
      .where("competitorNumber", ">", 0)
      .orderBy("competitorNumber", "desc")
      .limit(1)
      .get();

    const maxNum = maxSnap.empty
      ? 0
      : Number(maxSnap.docs[0].get("competitorNumber") || 0);

    const nextNumber = maxNum + 1;

    // Si ya existe nextNumber y es mayor, no lo bajes (por seguridad)
    const currentNext = Number(carreraDoc.get("nextNumber") || 0);
    const finalNext = Math.max(currentNext || 0, nextNumber);

    // Si no hay maxCompetitors, igual lo ponemos (no estorba)
    await carreraDoc.ref.set({ nextNumber: finalNext }, { merge: true });

    console.log(
      `✅ carrera ${carreraId}: max=${maxNum} -> nextNumber=${finalNext}`
    );
    updated++;
  }

  console.log("Listo. Carreras actualizadas:", updated);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});