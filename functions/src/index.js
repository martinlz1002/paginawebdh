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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
admin.initializeApp();
const app = (0, express_1.default)();
// 1) CORS: permite orígenes cruzados desde cualquier dominio
app.use((0, cors_1.default)({ origin: true }));
// 2) Parse JSON bodies
app.use(express_1.default.json());
// 3) Ruta POST para crear carrera
app.post("/crearCarrera", async (req, res) => {
    // 3.1) Autenticación: espera token Bearer en header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autenticado." });
    }
    const idToken = authHeader.split("Bearer ")[1];
    let decoded;
    try {
        decoded = await admin.auth().verifyIdToken(idToken);
    }
    catch (err) {
        return res.status(403).json({ error: "Token inválido." });
    }
    // 3.2) Verificar claim admin en el token
    if (!decoded.admin) {
        return res.status(403).json({ error: "Se requieren permisos de administrador." });
    }
    // 3.3) Validar payload
    const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo } = req.body;
    if (!titulo ||
        !descripcion ||
        !ubicacion ||
        !fecha ||
        !imagenBase64 ||
        !nombreArchivo) {
        return res.status(400).json({ error: "Faltan datos obligatorios." });
    }
    try {
        // 3.4) Procesar y subir la imagen
        const buffer = Buffer.from(imagenBase64, "base64");
        const bucket = admin.storage().bucket();
        const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
        const file = bucket.file(filePath);
        await file.save(buffer, {
            metadata: { contentType: "image/jpeg" },
        });
        const [url] = await file.getSignedUrl({
            action: "read",
            expires: "03-01-2030",
        });
        // 3.5) Guardar documento en Firestore
        await admin.firestore().collection("carreras").add({
            titulo,
            descripcion,
            ubicacion,
            fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
            imagenUrl: url,
            creado: admin.firestore.FieldValue.serverTimestamp(),
        });
        return res.json({ mensaje: "Carrera creada exitosamente." });
    }
    catch (error) {
        console.error("Error creando carrera:", error);
        return res.status(500).json({ error: "Error interno al crear carrera." });
    }
});
// 4) Exportar la función en us-central1
exports.api = functions.https.onRequest({ region: "us-central1" }, app);
