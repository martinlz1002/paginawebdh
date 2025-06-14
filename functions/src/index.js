"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.crearCarrera = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Función HTTP con región, CORS manual y verificación de token
exports.crearCarrera = functions
    .region('us-central1')
    .https.onRequest(async (req, res) => {
    // 1) CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    if (req.method !== 'POST') {
        return res.status(405).send('Método no permitido');
    }
    // 2) Autenticación: extraer Bearer <ID_TOKEN>
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    const idToken = match[1];
    let uid;
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        uid = decoded.uid;
    }
    catch (err) {
        return res.status(401).json({ error: 'Token inválido' });
    }
    // 3) Leer y validar payload
    const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo, } = req.body;
    if (!titulo || !fecha || !imagenBase64 || !nombreArchivo) {
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }
    try {
        // 4) Subir imagen a Firebase Storage
        const buffer = Buffer.from(imagenBase64, 'base64');
        const bucket = admin.storage().bucket();
        const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
        const file = bucket.file(filePath);
        await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2030',
        });
        // 5) Guardar carrera en Firestore
        await admin.firestore().collection('carreras').add({
            titulo,
            descripcion,
            ubicacion,
            fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
            imagenUrl: url,
            creado: admin.firestore.FieldValue.serverTimestamp(),
            creadoPor: uid,
        });
        return res.json({ mensaje: 'Carrera creada exitosamente' });
    }
    catch (error) {
        console.error('Error al crear carrera:', error);
        return res.status(500).json({ error: 'Error interno al crear la carrera.' });
    }
});
