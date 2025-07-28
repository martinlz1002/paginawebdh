import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';

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
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 12;
  const margin = 40;
  const logoSize = 60;
  const lineHeight = fontSize * 1.5;
  const maxWidth = width - margin * 2;

  // Helper para envolver texto
  function wrapText(
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const testLine = line ? line + ' ' + word : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      if (testWidth <= maxWidth) {
        line = testLine;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // 1) Logo en esquina superior izquierda
  try {
    const logoBytes = await fetch('/mi-logo.png').then(r => r.arrayBuffer());
    const logoImg = await doc.embedPng(logoBytes);
    page.drawImage(logoImg, {
      x: margin,
      y: height - margin - logoSize,
      width: logoSize,
      height: logoSize,
    });
  } catch {
    // si falla, lo omitimos
  }

  // 2) Posición inicial del texto (justo debajo del logo)
  let cursorY = height - margin - logoSize - 20;

  // 3) Bloques de contenido (título, datos, exoneración, kits, requisitos)
  const blocks: { font: PDFFont; lines: string[] }[] = [
    {
      font: boldFont,
      lines: wrapText(
        'Ha completado con éxito el registro en:',
        boldFont,
        fontSize,
        maxWidth
      ),
    },
    {
      font: boldFont,
      lines: wrapText(insc.titulo, boldFont, fontSize + 2, maxWidth),
    },
    {
      font: regularFont,
      lines: wrapText(
        'Favor de imprimir, firmar y llevar este comprobante al registro para recolectar su paquete.',
        regularFont,
        fontSize,
        maxWidth
      ),
    },
    {
      font: boldFont,
      lines: [
        `Nombre:`,
        `Distancia:`,
        `Categoría:`,
        `Número de competidor:`,
        `Ficha de Inscripción:`,
      ],
    },
    {
      font: regularFont,
      lines: [
        `${insc.perfilNombre} ${insc.perfilApPaterno} ${insc.perfilApMaterno}`,
        insc.distancia || '-',
        insc.categoria,
        `${insc.competitorNumber ?? '-'}`,
        insc.id,
      ],
    },
    {
      font: boldFont,
      lines: ['Exoneración de Responsabilidad:'],
    },
    {
      font: regularFont,
      lines: wrapText(
        `Yo, por el solo hecho de firmar este documento, acepto cualquier y todos los riesgos y peligros que sobre mi persona recaigan en cuanto a mi participación en ${insc.titulo}, en adelante el 'Evento'. Por lo tanto, yo soy el único responsable de mi salud, cualquier consecuencia, accidente, perjuicios, deficiencias que puedan causar, de cualquier manera posible alteraciones a mi salud, integridad física o inclusive la muerte. Por esta razón libero de cualquier responsabilidad al respecto a la Empresa/Comité Organizador, sus directores, patrocinadores, accionistas, representantes, y renuncio a cualquier derecho o demanda al respecto. También reconozco y acepto que autorizo al Comité Organizador el uso de mi imagen y voz en relación con el Evento.`,
        regularFont,
        fontSize,
        maxWidth
      ),
    },
    {
      font: boldFont,
      lines: ['Entrega de Kits:'],
    },
    {
      font: regularFont,
      lines: [
        `• Fecha: ${insc.kitFecha ?? 'Por definir'}`,
        `• Lugar: ${insc.kitLugar ?? 'Por definir'}`,
        `• Horario: ${insc.kitHorario ?? 'Por definir'}`,
      ],
    },
    {
      font: boldFont,
      lines: ['Requisitos:'],
    },
    {
      font: regularFont,
      lines: ['• Hoja de confirmación impresa', '• Identificación del corredor'],
    },
  ];

  // 4) Dibujar cada bloque, línea por línea
  for (const block of blocks) {
    for (const text of block.lines) {
      // Si llegamos al margen inferior, creamos nueva página
      if (cursorY < margin + lineHeight) {
        page = doc.addPage([595, 842]);
        cursorY = height - margin;
      }
      page.drawText(text, {
        x: margin,
        y: cursorY,
        size: fontSize,
        font: block.font,
      });
      cursorY -= lineHeight;
    }
    // Espacio extra entre bloques
    cursorY -= lineHeight;
  }

  // 5) Generar y descargar
  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Confirmación-${insc.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}