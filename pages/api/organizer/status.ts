import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { requireOrganizer } from "@/lib/organizerAuth";

type ResponseData =
  | {
      ok: true;
      esOrganizador: boolean;
      organizerId: string | null;
    }
  | {
      ok: false;
      esOrganizador: false;
      organizerId: null;
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // ============================================================
  // MÉTODO
  // ============================================================

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      esOrganizador: false,
      organizerId: null,
      error: "Método no permitido",
    });
  }

  try {
    // ============================================================
    // 1. IDENTIFICAR AL ORGANIZADOR
    // ============================================================

    const {
      db,
      organizerId,
    } = await requireOrganizer(req);

    // ============================================================
    // 2. BUSCAR SI TIENE AL MENOS UNA CARRERA
    // ============================================================

    const carrerasSnap = await db
      .collection("carreras")
      .where(
        "paymentConfig.organizerId",
        "==",
        organizerId
      )
      .limit(1)
      .get();

    const tieneCarrera =
      !carrerasSnap.empty;

    // ============================================================
    // 3. RESPUESTA
    // ============================================================

    return res.status(200).json({
      ok: true,
      esOrganizador: tieneCarrera,
      organizerId: tieneCarrera
        ? organizerId
        : null,
    });

  } catch (error: any) {
    const message =
      error?.message ||
      "";

    // ============================================================
    // CASOS NORMALES
    // ============================================================
    //
    // Estos casos NO representan un error del sistema.
    // Simplemente significan que el usuario actual no debe
    // ver la opción "Organizador".
    //

    const esCasoNormal =
      message ===
        "No existe un organizador asociado a este correo" ||
      message ===
        "Debes verificar tu correo electrónico antes de entrar" ||
      message ===
        "Usuario no autenticado";

    if (!esCasoNormal) {
      // Solo registramos errores inesperados.
      console.error(
        "Error verificando organizador:",
        error
      );
    }

    // ============================================================
    // 4. PARA EL HEADER, TODO CASO NO VÁLIDO SIGNIFICA
    //    QUE NO DEBE MOSTRARSE EL MENÚ DE ORGANIZADOR.
    // ============================================================

    return res.status(200).json({
      ok: false,
      esOrganizador: false,
      organizerId: null,
      error:
        message ||
        "No es organizador",
    });
  }
}