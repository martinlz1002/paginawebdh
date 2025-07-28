import { PDFDocument, StandardFonts, PDFFont } from 'pdf-lib';

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
  let page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  // Fuentes
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont    = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize    = 12;
  const margin      = 40;
  const logoSize    = 60;
  const lineHeight  = fontSize * 1.5;
  const maxWidth    = width - margin * 2;

  // Helper para texto envuelto
  function wrapText(text: string, font: PDFFont, size: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // 1) Logo
  try {
    const logoBytes = await fetch('/mi-logo.png').then(r => r.arrayBuffer());
    const logoImg   = await doc.embedPng(logoBytes);
    page.drawImage(logoImg, {
      x: margin,
      y: height - margin - logoSize,
      width: logoSize,
      height: logoSize,
    });
  } catch { /* ignora */ }

  // 2) Posición inicial
  let y = height - margin - logoSize - 20;

  // 3) Títulos y párrafos
  const headerLines = [
    { text: 'Ha completado con éxito el registro en:', font: boldFont, size: fontSize },
    { text: insc.titulo,                         font: boldFont, size: fontSize + 2 },
  ];
  for (const hl of headerLines) {
    const wrapped = wrapText(hl.text, hl.font, hl.size);
    for (const l of wrapped) {
      page.drawText(l, { x: margin, y, font: hl.font, size: hl.size });
      y -= lineHeight;
    }
    y -= lineHeight / 2;
  }

  // 4) Línea formal para cada campo
  const fields: Array<[string, string]> = [
    ['Nombre:',            `${insc.perfilNombre} ${insc.perfilApPaterno} ${insc.perfilApMaterno}`],
    ['Distancia:',         insc.distancia || '-'],
    ['Categoría:',         insc.categoria],
    ['Número de competidor:', `${insc.competitorNumber ?? '-'}`],
    ['Ficha de Inscripción:', insc.id],
  ];
  for (const [label, val] of fields) {
    // etiqueta en negrita
    page.drawText(label, { x: margin, y, font: boldFont, size: fontSize });
    // valor justificado a la derecha de la etiqueta
    const labelWidth = boldFont.widthOfTextAtSize(label + ' ', fontSize);
    page.drawText(val, { x: margin + labelWidth, y, font: regularFont, size: fontSize });
    y -= lineHeight;
  }
  y -= lineHeight / 2;

  // 5) Exoneración
  page.drawText('Exoneración de Responsabilidad:', { x: margin, y, font: boldFont, size: fontSize });
  y -= lineHeight;
  const exo = wrapText(
    `Yo, por el solo hecho de firmar este documento, acepto todos los riesgos y peligros inherentes al Evento "${insc.titulo}"…`,
    regularFont,
    fontSize
  );
  for (const l of exo) {
    page.drawText(l, { x: margin, y, font: regularFont, size: fontSize });
    y -= lineHeight;
    if (y < margin) {
      page = doc.addPage([595, 842]);
      y = height - margin;
    }
  }
  y -= lineHeight / 2;

  // 6) Entrega de kits
  page.drawText('Entrega de Kits:', { x: margin, y, font: boldFont, size: fontSize });
  y -= lineHeight;
  for (const line of [
    `• Fecha: ${insc.kitFecha ?? 'Por definir'}`,
    `• Lugar: ${insc.kitLugar ?? 'Por definir'}`,
    `• Horario: ${insc.kitHorario ?? 'Por definir'}`,
  ]) {
    page.drawText(line, { x: margin + 10, y, font: regularFont, size: fontSize });
    y -= lineHeight;
  }
  y -= lineHeight / 2;

  // 7) Requisitos
  page.drawText('Requisitos:', { x: margin, y, font: boldFont, size: fontSize });
  y -= lineHeight;
  for (const line of ['• Hoja de confirmación impresa', '• Identificación del corredor']) {
    page.drawText(line, { x: margin + 10, y, font: regularFont, size: fontSize });
    y -= lineHeight;
  }

  // 8) Guardar y descargar
  const bytes = await doc.save();
  const blob  = new Blob([bytes], { type: 'application/pdf' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = `Confirmación-${insc.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}