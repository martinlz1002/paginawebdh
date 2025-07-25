import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface InscView {
  id: string;
  titulo: string;
  distancia?: string;
  categoria: string;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  competitorNumber?: number;
  kitFecha?: string;
  kitLugar?: string;
  kitHorario?: string;
}

export default async function generarPDF(insc: InscView) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;

  const logoUrl = "/logo.png";
  const logoBytes = await fetch(logoUrl).then((res) => res.arrayBuffer()).catch(() => null);
  if (logoBytes) {
    const logoImg = await doc.embedPng(logoBytes);
    const dims = logoImg.scale(0.25);
    page.drawImage(logoImg, {
      x: width / 2 - dims.width / 2,
      y: height - 80,
      width: dims.width,
      height: dims.height,
    });
  }

  const lines = [
    "Ha completado con éxito el registro",
    insc.titulo,
    "Favor de imprimir, firmar y llevar este comprobante al registro para recolectar su paquete.",
    `Nombre: ${insc.perfilNombre} ${insc.perfilApPaterno} ${insc.perfilApMaterno}`,
    `Distancia: ${insc.distancia || "-"}`,
    `Categoría: ${insc.categoria}`,
    `Número de competidor: ${insc.competitorNumber ?? "-"}`,
    `Ficha de Inscripción: ${insc.id}`,
    "",
    "Exoneración de Responsabilidad",
    "Yo, por el solo hecho de firmar este documento, acepto cualquier y todos los riesgos y peligros que sobre mi",
    "persona recaigan en cuanto a mi participación en " + insc.titulo + ", en adelante el 'Evento'. Por lo tanto, yo",
    "soy el único responsable de (l) mi salud, (ll) cualquier consecuencia, accidente, perjuicios, deficiencias que",
    "puedan causar, de cualquier manera posible alteraciones a mi salud, integridad física o inclusive la muerte.",
    "Por esta razón libero de cualquier responsabilidad al respecto a la Empresa/Comité Organizador, sus",
    "directores, patrocinadores, accionistas, representantes, y renuncio a cualquier derecho o demanda al respecto.",
    "También reconozco y acepto que autorizo al Comité Organizador el uso de mi imagen y voz en relación con el Evento.",
    "",
    "Entrega de kits:",
    `Fecha: ${insc.kitFecha || "Por definir"}`,
    `Lugar: ${insc.kitLugar || "Por definir"}`,
    `Horario: ${insc.kitHorario || "Por definir"}`,
    "",
    "Requisitos:",
    "Hoja de confirmación impresa",
    "Identificación del corredor."
  ];

  let y = height - 120;
  for (const line of lines) {
    page.drawText(line, { x: 40, y, size: fontSize, font });
    y -= fontSize + 4;
  }

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Confirmacion-${insc.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}