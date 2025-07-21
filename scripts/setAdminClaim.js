const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');

// Carga tu JSON de credenciales desde la carpeta scripts
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

initializeApp({
  credential: cert(serviceAccount),
});

async function setAdmin(uid) {
  try {
    await getAuth().setCustomUserClaims(uid, { admin: true });
    console.log(`✅ Se ha establecido admin=true para ${uid}`);
  } catch (err) {
    console.error('❌ Error al asignar claim de admin:', err);
  }
}

// Reemplaza con el UID al que quieras dar permisos de admin
setAdmin('XLEDxZAY8DVl3wIgQioomvl6Iwb2')
  .then(() => process.exit());