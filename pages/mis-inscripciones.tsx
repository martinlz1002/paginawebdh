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
import SectionHeader from "@/components/SectionHeader";
import {
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  ClipboardIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import generarPDF from "@/lib/pdfConfirmacion";

interface InscRaw {
  carreraId: string;
  perfilOwner: string;
  perfilId: string | null;

  // deporte
  distancia?: string | null;
  ruta?: string | null;
  categoria: string;

  // snapshot NUEVO
  nombre?: string | null;
  paterno?: string | null;
  materno?: string | null;
  nombres?: string | null;
  club?: string | null;

  // meta
  timestamp: any;
  sessionId?: string | null;
  paymentStatus?: string | null;

  // números
  competitorNumber?: number | null;
  ficha?: number | null;
  bib?: number | null;
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
  distancia: string;

  perfilId: string | null;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  perfilClub?: string;

  fechaIns: string;
  sessionId?: string | null;
  paymentStatus?: string;

  competitorNumber?: number;
  ficha?: number | null;
  bib?: number | null;

  kitFecha?: string;
  kitLugar?: string;
  kitHorario?: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function fullName(nombre: string, paterno: string, materno: string) {
  return `${(nombre || "").trim()} ${(paterno || "").trim()} ${(materno || "").trim()}`
    .replace(/\s+/g, " ")
    .trim();
}

export default function MisInscripcionesPage() {
  const [list, setList] = useState<InscView[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user: User | null) => {
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

            // --- carrera ---
            const cDoc = await getDoc(doc(db, "carreras", src.carreraId));
            const c = cDoc.exists() ? (cDoc.data() as any) : {};

            // distancia/ruta: prioriza snapshot
            let distancia = (src.ruta || src.distancia || "") as string;

            // fallback: si no viene distancia, intenta inferir por categoría desde la carrera
            if (!distancia && Array.isArray(c.distancias)) {
              for (const dist of c.distancias) {
                if (
                  Array.isArray(dist.categorias) &&
                  dist.categorias.some((cat: any) => cat.nombre === src.categoria)
                ) {
                  distancia = dist.distancia;
                  break;
                }
              }
            }

            // precio: desde carrera.distancias
            let precio = 0;
            if (Array.isArray(c.distancias)) {
              for (const dist of c.distancias) {
                const match = dist.categorias?.find(
                  (cat: any) => cat.nombre === src.categoria
                );
                if (match) {
                  precio = match.price ?? 0;
                  break;
                }
              }
            }

            // fecha carrera
            let fechaCarr = "";
            let carreraDate = today;

            if (c.fecha instanceof Timestamp) {
              const dt = c.fecha.toDate();
              carreraDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
              fechaCarr = `${pad(carreraDate.getDate())}/${pad(
                carreraDate.getMonth() + 1
              )}/${carreraDate.getFullYear()}`;
            } else if (typeof c.fecha === "string") {
              const [y, m, dd] = c.fecha.split("-").map(Number);
              carreraDate = new Date(y, m - 1, dd);
              fechaCarr = `${pad(dd)}/${pad(m)}/${y}`;
            }

            // --- perfil: prioriza snapshot en inscripciones ---
            let perfilNombre = (src.nombre || "") as string;
            let perfilApPaterno = (src.paterno || "") as string;
            let perfilApMaterno = (src.materno || "") as string;
            let perfilClub: string | undefined = (src.club || undefined) as any;

            // fallback compat: si no hay snapshot, consulta usuarios como antes
            const needFallback =
              !perfilNombre.trim() && !perfilApPaterno.trim() && !perfilApMaterno.trim();

            if (needFallback && src.perfilId && src.perfilOwner) {
              if (src.perfilId === src.perfilOwner) {
                const uDoc = await getDoc(doc(db, "usuarios", src.perfilOwner));
                if (uDoc.exists()) {
                  const ud = uDoc.data() as any;
                  perfilNombre = ud.nombre || "";
                  perfilApPaterno = ud.apPaterno || ud.apellidoPaterno || "";
                  perfilApMaterno = ud.apMaterno || ud.apellidoMaterno || "";
                  perfilClub = ud.club;
                }
              } else {
                const sub = await getDoc(
                  doc(db, "usuarios", src.perfilOwner, "perfiles", src.perfilId)
                );
                if (sub.exists()) {
                  const sd = sub.data() as any;
                  perfilNombre = sd.nombre || "";
                  perfilApPaterno = sd.apPaterno || sd.apellidoPaterno || "";
                  perfilApMaterno = sd.apMaterno || sd.apellidoMaterno || "";
                  perfilClub = sd.club;
                }
              }
            }

            const fechaIns = src.timestamp?.toDate
              ? src.timestamp.toDate().toLocaleString()
              : "";

            const competitorNumber =
              typeof src.competitorNumber === "number"
                ? src.competitorNumber
                : src.ficha ?? src.bib ?? undefined;

            return {
              id: d.id,
              carreraId: src.carreraId,

              titulo: c.titulo || "(sin título)",
              fechaCarr,
              carreraDate,
              horaSalida: c.horaSalida,
              ubicacion: c.lugar,
              imagenUrl: c.imagenUrl,

              precio,
              categoria: src.categoria,
              distancia,

              perfilId: src.perfilId,
              perfilNombre,
              perfilApPaterno,
              perfilApMaterno,
              perfilClub,

              fechaIns,
              sessionId: src.sessionId ?? null,
              paymentStatus: (src.paymentStatus ?? "desconocido") as string,

              competitorNumber,
              ficha: src.ficha ?? null,
              bib: src.bib ?? null,

              kitFecha: c.kitFecha,
              kitLugar: c.kitLugar,
              kitHorario: c.kitHorario,
            } as InscView;
          })
        );

        // solo futuras
        setList(all.filter((i) => i.carreraDate >= today));
        setLoading(false);
      });

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, [auth]);

  const reintentarPago = async (item: InscView) => {
    // ⚠️ Antes mandabas solo categoria/price y ya NO alcanza: te faltaba distancia
    const res = await fetch("/api/checkout_sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carreraId: item.carreraId,
        perfilId: item.perfilId,
        categoria: item.categoria,
        distancia: item.distancia, // ✅ importantísimo
        price: item.precio,
      }),
    });

    if (!res.ok) return;

    const { url, sessionId } = await res.json();

    // Mantén consistencia en el doc (distancia/ruta)
    await updateDoc(doc(db, "inscripciones", item.id), {
      sessionId,
      paymentStatus: "pending",
      distancia: item.distancia || null,
      ruta: item.distancia || null,
    });

    window.open(url, "_blank")?.focus();
  };

  if (loading) {
    return (
      <AuthGuard>
        <p className="text-center mt-10 text-gray-800">Cargando inscripciones…</p>
      </AuthGuard>
    );
  }

  const pillClass = (status?: string) => {
    if (status === "paid") return "bg-green-100 text-green-800";
    if (status === "pending") return "bg-yellow-100 text-yellow-800";
    if (status === "manual") return "bg-blue-100 text-blue-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <AuthGuard>
      <section className="max-w-5xl mx-auto p-6 text-gray-800">
        <SectionHeader
          title="Mis Inscripciones"
          subtitle="Aquí encontrarás todos tus registros activos"
        />

        {list.length === 0 ? (
          <p className="text-center text-gray-500">No hay inscripciones.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {list.map((i) => (
              <div
                key={i.id}
                className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col"
              >
                {i.imagenUrl && (
                  <div className="h-40 bg-gray-100 overflow-hidden">
                    <img
                      src={i.imagenUrl}
                      alt={i.titulo}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col">
                  <h2 className="text-2xl font-bold mb-2 text-gray-800">
                    {i.titulo}
                  </h2>

                  <p className="text-lg font-semibold mb-1 text-gray-800">
                    Número:{" "}
                    <span className="text-purple-600">
                      #{i.competitorNumber ?? "-"}
                    </span>
                  </p>

                  <p className="text-base mb-2 flex items-center text-gray-700">
                    <ClipboardIcon className="w-5 h-5 mr-1 text-green-600" />
                    {fullName(i.perfilNombre, i.perfilApPaterno, i.perfilApMaterno)}
                  </p>

                  <div className="space-y-1 mb-4">
                    <p className="text-sm text-gray-700">
                      <strong>Distancia:</strong> {i.distancia || "-"}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Categoría:</strong> {i.categoria || "-"}
                    </p>
                    {i.perfilClub && (
                      <p className="text-sm text-gray-700">
                        <strong>Club:</strong> {i.perfilClub}
                      </p>
                    )}
                  </div>

                  <div className="flex-1 mb-4 flex flex-wrap gap-4 text-gray-600">
                    <span className="flex items-center">
                      <MapPinIcon className="w-5 h-5 mr-1" />
                      {i.ubicacion || "-"}
                    </span>
                    <span className="flex items-center">
                      <CalendarIcon className="w-5 h-5 mr-1" />
                      {i.fechaCarr || "-"}
                    </span>
                    <span className="flex items-center">
                      <ClockIcon className="w-5 h-5 mr-1" />
                      {i.horaSalida || "-"}
                    </span>
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-sm ${pillClass(i.paymentStatus)}`}>
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
                    ) : i.paymentStatus === "manual" ? (
                      <span className="text-xs text-gray-500">Registro manual</span>
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
      </section>
    </AuthGuard>
  );
}