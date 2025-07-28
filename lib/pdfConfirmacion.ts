import { PDFDocument, StandardFonts } from 'pdf-lib';

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
  // 1) Crear documento y primera página
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  // 2) Configuración de fuentes y métricas
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const lineHeight = fontSize * 1.2;
  const margin = 40;
  const maxWidth = width - margin * 2;

  // 3) Dibujar logo pequeño en la esquina superior izquierda
  try {
    const logoBytes = await fetch('/mi-logo.png').then(r => r.arrayBuffer());
    const logoImg = await doc.embedPng(logoBytes);
    const logoSize = 50;
    page.drawImage(logoImg, {
      x: margin,
      y: height - margin - logoSize,
      width: logoSize,
      height: logoSize,
    });
  } catch {
    // Si falla la carga del logo, se ignora
  }

  // 4) Función de ajuste de texto (word‑wrap)
  function wrapText(text: string): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
        line = test;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // 5) Contenido en párrafos
  const paragraphs = [
    'Ha completado con éxito el registro en:',
    insc.titulo,
    'Favor de imprimir, firmar y llevar este comprobante al registro para recolectar su paquete.',
    `Nombre: ${insc.perfilNombre} ${insc.perfilApPaterno} ${insc.perfilApMaterno}`,
    `Distancia: ${insc.distancia ?? '-'}`,
    `Categoría: ${insc.categoria}`,
    `Número de competidor: ${insc.competitorNumber ?? '-'}`,
    `Ficha de Inscripción: ${insc.id}`,
    '',
    'Exoneración de Responsabilidad:',
    `Yo, por el solo hecho de firmar este documento, acepto cualquier y todos los riesgos y peligros que sobre mi persona recaigan en cuanto a mi participación en ${insc.titulo}, en adelante el "Evento". Por lo tanto, yo soy el único responsable de mi salud, cualquier consecuencia, accidente, perjuicios, deficiencias que puedan causar, de cualquier manera posible alteraciones a mi salud, integridad física o inclusive la muerte. Por esta razón libero de cualquier responsabilidad al respecto a la Empresa/Comité Organizador, sus directores, patrocinadores, accionistas, representantes, y renuncio a cualquier derecho o demanda al respecto. También reconozco y acepto que autorizo al Comité Organizador el uso de mi imagen y voz en relación con el Evento.`,
    '',
    'Entrega de Kits:',
    `• Fecha: ${insc.kitFecha ?? 'Por definir'}`,
    `• Lugar: ${insc.kitLugar ?? 'Por definir'}`,
    `• Horario: ${insc.kitHorario ?? 'Por definir'}`,
    '',
    'Requisitos:',
    '• Hoja de confirmación impresa',
    '• Identificación del corredor',
  ];

  // 6) Empezar a dibujar texto debajo del logo
  let y = height - margin - 60;

  for (const para of paragraphs) {
    const lines = wrapText(para);
    for (const line of lines) {
      if (y < margin) {
        // si llegamos al margen inferior, crear nueva página
        page = doc.addPage([595, 842]);
        y = height - margin;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
      });
      y -= lineHeight;
    }
    // espacio extra entre párrafos
    y -= lineHeight / 2;
  }

  // 7) Descargar PDF
  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Confirmacion-${insc.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}