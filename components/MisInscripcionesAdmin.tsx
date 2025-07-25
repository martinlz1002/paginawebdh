import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import AuthGuard from "@/components/AuthGuard";
import {
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  ClipboardIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface InscRaw {
  carreraId: string;
  perfilOwner: string;
  perfilId: string;
  categoria: string;
  timestamp: any;
  sessionId?: string;
  paymentStatus?: string;
  competitorNumber?: number;
}

interface InscView {
  id: string;
  carreraId: string;
  titulo: string;
  fechaCarr: string;
  carreraDate: Date;
  horaSalida?: string;
  ubicacion?: string;
  imagenUrl?: string;
  precio: number;
  categoria: string;
  distancia?: string;
  perfilId: string;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  perfilClub?: string;
  fechaIns: string;
  sessionId?: string;
  paymentStatus?: string;
  competitorNumber?: number;
  kitFecha?: string;
  kitLugar?: string;
  kitHorario?: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

async function generarPDF(insc: InscView) {
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
    `Número de competidor: ${insc.competitorNumber}`,
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

export default function MisInscripcionesPage() {
  const [list, setList] = useState<InscView[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user: User | null) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "inscripciones"),
        where("perfilOwner", "==", user.uid)
      );

      const unsubSnap = onSnapshot(q, async (snap) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const all = await Promise.all(
          snap.docs.map(async (d) => {
            const src = d.data() as InscRaw;
            const carreraId = src.carreraId;

            const cDoc = await getDoc(doc(db, "carreras", carreraId));
            const cdata = cDoc.exists() ? (cDoc.data() as any) : {};
            let distancia = "";
            if (Array.isArray(cdata.distancias)) {
              for (const dist of cdata.distancias) {
                if (Array.isArray(dist.categorias)) {
                  const match = dist.categorias.find((cat: any) => cat.nombre === src.categoria);
                  if (match) {
                    distancia = dist.distancia;
                    break;
                  }
                }
              }
            }
            let precio = 0;
            if (Array.isArray(cdata.distancias)) {
              for (const dist of cdata.distancias) {
                if (Array.isArray(dist.categorias)) {
                  const match = dist.categorias.find((cat: any) => cat.nombre === src.categoria);
                  if (match) {
                    precio = match.price ?? 0;
                    break;
                  }
                }
              }
            }

            let fechaCarr = "";
            let carreraDate = today;
            if (cdata.fecha instanceof Timestamp) {
              const dt = (cdata.fecha as Timestamp).toDate();
              carreraDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
              fechaCarr = `${pad(carreraDate.getDate())}/${pad(
                carreraDate.getMonth() + 1
              )}/${carreraDate.getFullYear()}`;
            } else if (typeof cdata.fecha === "string") {
              const [y, m, d] = (cdata.fecha as string).split("-").map(Number);
              carreraDate = new Date(y, m - 1, d);
              fechaCarr = `${pad(d)}/${pad(m)}/${y}`;
            }

            let perfilNombre = "",
              perfilApPaterno = "",
              perfilApMaterno = "",
              perfilClub: string | undefined;

            if (src.perfilId === src.perfilOwner) {
              const uDoc = await getDoc(doc(db, "usuarios", src.perfilOwner));
              if (uDoc.exists()) {
                const ud = uDoc.data() as any;
                perfilNombre = ud.nombre;
                perfilApPaterno = ud.apPaterno || ud.apellidoPaterno;
                perfilApMaterno = ud.apMaterno || ud.apellidoMaterno;
                perfilClub = ud.club;
              }
            } else {
              const sub = await getDoc(
                doc(db, "usuarios", src.perfilOwner, "perfiles", src.perfilId)
              );
              if (sub.exists()) {
                const sd = sub.data() as any;
                perfilNombre = sd.nombre;
                perfilApPaterno = sd.apPaterno || sd.apellidoPaterno || "";
                perfilApMaterno = sd.apMaterno || sd.apellidoMaterno || "";
                perfilClub = sd.club;
              }
            }

            const fechaIns = src.timestamp?.toDate
              ? src.timestamp.toDate().toLocaleString()
              : "";

            return {
              id: d.id,
              carreraId,
              titulo: cdata.titulo || "(sin título)",
              fechaCarr,
              carreraDate,
              horaSalida: cdata.horaSalida,
              ubicacion: cdata.lugar || cdata.ubicacion,
              imagenUrl: cdata.imagenUrl,
              precio,
              categoria: src.categoria,
              distancia,
              perfilId: src.perfilId,
              perfilNombre,
              perfilApPaterno,
              perfilApMaterno,
              perfilClub,
              fechaIns,
              sessionId: src.sessionId,
              paymentStatus: src.paymentStatus ?? "desconocido",
              competitorNumber: src.competitorNumber,
              kitFecha: cdata.kitFecha,
              kitLugar: cdata.kitLugar,
              kitHorario: cdata.kitHorario,
            } as InscView;
          })
        );

        setList(all.filter(i => i.carreraDate >= today));
        setLoading(false);
      });

      return () => unsubSnap();
    });
    return () => unsubAuth();
  }, []);

  const reintentarPago = async (item: InscView) => {
    const res = await fetch("/api/checkout_sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carreraId: item.carreraId,
        perfilId: item.perfilId,
        categoria: item.categoria,
        price: item.precio,
      }),
    });
    if (!res.ok) return;
    const { url, sessionId } = await res.json();
    await updateDoc(doc(db, "inscripciones", item.id), {
      sessionId,
      paymentStatus: "pending",
    });
    window.open(url, "_blank")?.focus();
  };

  if (loading) {
    return (
      <AuthGuard>
        <p className="text-center mt-10">Cargando inscripciones…</p>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto p-6">
        {list.length === 0 ? (
          <p className="text-center text-gray-500">No hay inscripciones.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {list.map((i) => (
              <div
                key={i.id}
                className="border rounded-lg shadow-lg overflow-hidden flex flex-col"
              >
                {i.imagenUrl && (
                  <div className="w-full h-40 overflow-hidden">
                    <img
                      src={i.imagenUrl}
                      alt={i.titulo}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col">
                  <h2 className="text-2xl font-bold mb-2">{i.titulo}</h2>
                  <p className="text-lg font-semibold mb-1">
                    Número: #{i.competitorNumber ?? "-"}
                  </p>
                  <p className="text-base text-gray-700 mb-1">
                    <ClipboardIcon className="inline w-5 h-5 mr-1" />
                    {i.perfilNombre} {i.perfilApPaterno} {i.perfilApMaterno}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">Categoría: {i.categoria}</p>
                  <p className="text-sm text-gray-600 mb-2">Distancia: {i.distancia || '-'}</p>

                  <div className="text-base text-gray-600 mb-2 flex flex-wrap gap-4">
                    <span className="flex items-center">
                      <MapPinIcon className="w-5 h-5 mr-1" />
                      {i.ubicacion || "-"}
                    </span>
                    <span className="flex items-center">
                      <CalendarIcon className="w-5 h-5 mr-1" />
                      {i.fechaCarr}
                    </span>
                    <span className="flex items-center">
                      <ClockIcon className="w-5 h-5 mr-1" />
                      {i.horaSalida || "-"}
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        i.paymentStatus === "paid"
                          ? "bg-green-100 text-green-800"
                          : i.paymentStatus === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {i.paymentStatus}
                    </span>
                    {i.paymentStatus === "paid" ? (
                      <button
                        onClick={() => generarPDF(i)}
                        className="text-sm text-green-700 hover:underline flex items-center gap-1"
                      >
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        Confirmación
                      </button>
                    ) : (
                      <button
                        onClick={() => reintentarPago(i)}
                        className="text-sm text-purple-600 hover:underline"
                      >
                        Reintentar pago
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
