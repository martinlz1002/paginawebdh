import { adminDb } from "@/lib/firebaseAdmin";
import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";

const CAMPOS_PERMITIDOS = [
  "nombre",
  "paterno",
  "materno",
  "nombres",
  "rama",
  "email",
  "celular",
  "ciudad",
  "estado",
  "pais",
  "club",
  "ruta",
  "categoria",
  "tallaPlayera",
  "telefonoEmergencia",
  "fechaNacimiento",
  "paymentStatus",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { id, tempId, cambios } = req.body ?? {};

  if (
    typeof id !== "string" ||
    typeof tempId !== "string" ||
    !cambios ||
    typeof cambios !== "object" ||
    Array.isArray(cambios)
  ) {
    return res.status(400).json({
      error: "Datos de actualización incompletos.",
    });
  }

  const campos = Object.keys(cambios);

  if (
    campos.length === 0 ||
    campos.some((campo) => !CAMPOS_PERMITIDOS.includes(campo))
  ) {
    return res.status(400).json({
      error: "Se incluyeron campos no permitidos.",
    });
  }

  try {
    const tempRef = adminDb.collection("tempusuarios").doc(tempId);
    const insRef = adminDb.collection("inscripciones").doc(id);

    const [tempSnap, insSnap] = await Promise.all([
      tempRef.get(),
      insRef.get(),
    ]);

    if (!tempSnap.exists || !insSnap.exists) {
      return res.status(404).json({
        error: "Acceso o inscripción no encontrados.",
      });
    }

    const temp = tempSnap.data()!;
    const ins = insSnap.data()!;

    // Comprobar que el acceso corresponde a la inscripción.
    if (
      ins.manualAdminId !== tempId ||
      ins.carreraId !== temp.carreraId
    ) {
      return res.status(403).json({
        error: "La inscripción no pertenece a este acceso.",
      });
    }

    // No permitir editar mediante un enlace expirado.
    const expiresAt =
      typeof temp.expiresAt?.toDate === "function"
        ? temp.expiresAt.toDate()
        : new Date(temp.expiresAt);

    if (!Number.isFinite(expiresAt.getTime()) ||
        expiresAt.getTime() <= Date.now()) {
      return res.status(403).json({
        error: "El acceso temporal ha expirado.",
      });
    }

    // Validar tipos y longitudes.
    for (const [campo, valor] of Object.entries(cambios)) {
      if (
        campo === "fechaNacimiento"
      ) {
        if (
          typeof valor !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(valor)
        ) {
          return res.status(400).json({
            error: "Fecha de nacimiento inválida.",
          });
        }
      } else if (
        typeof valor !== "string" ||
        valor.length > 500
      ) {
        return res.status(400).json({
          error: `Valor inválido para ${campo}.`,
        });
      }
    }

    // Estados de pago admitidos.
    if (
      cambios.paymentStatus !== undefined &&
      !["manual", "paid", "pending", "expired", "failed"].includes(
        cambios.paymentStatus
      )
    ) {
      return res.status(400).json({
        error: "Estado de pago inválido.",
      });
    }

    // No permitir que el cambio de pago convierta una inscripción
    // manual en una inscripción de otro tipo.
    if (
      cambios.paymentStatus !== undefined &&
      cambios.paymentStatus !== "manual"
    ) {
      return res.status(400).json({
        error: "Este acceso solo puede conservar el estado Manual.",
      });
    }

    // Validar distancia y categoría contra la carrera.
    if (
      cambios.ruta !== undefined ||
      cambios.categoria !== undefined
    ) {
      const carreraSnap = await adminDb
        .collection("carreras")
        .doc(ins.carreraId)
        .get();

      if (!carreraSnap.exists) {
        return res.status(404).json({
          error: "Carrera no encontrada.",
        });
      }

      const carrera = carreraSnap.data()!;
      const ruta = cambios.ruta ?? ins.ruta;
      const categoria = cambios.categoria ?? ins.categoria;

      const distanciaValida = (carrera.distancias ?? []).find(
        (d: any) => d.distancia === ruta
      );

      if (
        !distanciaValida ||
        !(distanciaValida.categorias ?? []).some(
          (c: any) => c.nombre === categoria
        )
      ) {
        return res.status(400).json({
          error: "La distancia o categoría no corresponde a la carrera.",
        });
      }
    }

    const actualizacion: Record<string, unknown> = {
      ...cambios,
      nombres: [
        cambios.nombre ?? ins.nombre ?? "",
        cambios.paterno ?? ins.paterno ?? "",
        cambios.materno ?? ins.materno ?? "",
      ].join(" ").replace(/\s+/g, " ").trim(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof cambios.fechaNacimiento === "string") {
      const [year, month, day] = cambios.fechaNacimiento
        .split("-")
        .map(Number);

      const fecha = new Date(year, month - 1, day);

      if (
        fecha.getFullYear() !== year ||
        fecha.getMonth() !== month - 1 ||
        fecha.getDate() !== day
      ) {
        return res.status(400).json({
          error: "Fecha de nacimiento inválida.",
        });
      }

      actualizacion.fechaNacimiento = fecha;
    }

    await insRef.update(actualizacion);

    return res.status(200).json({
      ok: true,
      message: "Inscripción actualizada correctamente.",
    });
  } catch (error) {
    console.error("Error actualizando inscripción manual:", error);

    return res.status(500).json({
      error: "No se pudo actualizar la inscripción.",
    });
  }
}