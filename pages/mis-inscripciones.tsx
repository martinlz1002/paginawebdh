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
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CreditCardIcon,
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

  // snapshot
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
  // 🔒 estado carrera
  inscripcionesAbiertas?: boolean;

  // 🏁 RESULTADOS
  resultadosUrl?: string;
  resultadosPublicado?: boolean;
  carreraFinalizada?: boolean;

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

// UI tokens DH
const cardBase = "bg-white rounded-2xl border border-dh-purple/10 shadow-dh";
const pillBase =
  "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold border";
const btnBase =
  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold transition";

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

        const carreraCache = new Map<string, any>();

        const all = await Promise.all(
          snap.docs.map(async (d) => {
            const src = d.data() as InscRaw;

            // --- carrera ---
            let c = carreraCache.get(src.carreraId);
            if (!c) {
              const cDoc = await getDoc(doc(db, "carreras", src.carreraId));
              c = cDoc.exists() ? cDoc.data() : {};
              carreraCache.set(src.carreraId, c);
            }

            // distancia
            let distancia = (src.ruta || src.distancia || "") as string;
            if (!distancia && Array.isArray(c.distancias)) {
              for (const dist of c.distancias) {
                if (
                  dist.categorias?.some(
                    (cat: any) => cat.nombre === src.categoria
                  )
                ) {
                  distancia = dist.distancia;
                  break;
                }
              }
            }

            // precio
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
              const [y, m, d] = c.fecha.split("-").map(Number);
              carreraDate = new Date(y, m - 1, d);
              fechaCarr = `${pad(d)}/${pad(m)}/${y}`;
            }

            // perfil
            let perfilNombre = src.nombre || "";
            let perfilApPaterno = src.paterno || "";
            let perfilApMaterno = src.materno || "";
            let perfilClub = src.club || undefined;

            const needFallback =
              !perfilNombre && !perfilApPaterno && !perfilApMaterno;

            if (needFallback && src.perfilId) {
              if (src.perfilId === src.perfilOwner) {
                const u = await getDoc(doc(db, "usuarios", src.perfilOwner));
                if (u.exists()) {
                  const ud = u.data()!;
                  perfilNombre = ud.nombre || "";
                  perfilApPaterno = ud.apPaterno || "";
                  perfilApMaterno = ud.apMaterno || "";
                  perfilClub = ud.club;
                }
              } else {
                const p = await getDoc(
                  doc(db, "usuarios", src.perfilOwner, "perfiles", src.perfilId)
                );
                if (p.exists()) {
                  const pd = p.data()!;
                  perfilNombre = pd.nombre || "";
                  perfilApPaterno = pd.apPaterno || "";
                  perfilApMaterno = pd.apMaterno || "";
                  perfilClub = pd.club;
                }
              }
            }

            const fechaIns = src.timestamp?.toDate
              ? src.timestamp.toDate().toLocaleString()
              : "";

            // 🔒 NÚMERO SOLO SI PAGADO O MANUAL
            let competitorNumber: number | undefined = undefined;
            if (src.paymentStatus === "paid" || src.paymentStatus === "manual") {
              if (typeof src.competitorNumber === "number") {
                competitorNumber = src.competitorNumber;
              } else if (typeof src.ficha === "number") {
                competitorNumber = src.ficha;
              } else if (typeof src.bib === "number") {
                competitorNumber = src.bib;
              }
            }

            return {
              id: d.id,
              carreraId: src.carreraId,
              // 🔒 estado carrera
  inscripcionesAbiertas: c.inscripcionesAbiertas !== false,
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
              paymentStatus: src.paymentStatus ?? "desconocido",
              competitorNumber,
              kitFecha: c.kitFecha,
              kitLugar: c.kitLugar,
              kitHorario: c.kitHorario,
              // 🏁 RESULTADOS
              resultadosUrl: c.resultados?.url || "",
              resultadosPublicado: c.resultados?.publicado === true,
              carreraFinalizada: carreraDate < today,
            };
          })
        );

        setList(all);
        setLoading(false);
      });

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, [auth]);

  const reintentarPago = (item: InscView) => {
    if (item.paymentStatus === "paid") return;
    window.location.href = `/pago?inscripcionId=${encodeURIComponent(item.id)}`;
  };

  const pill = (status?: string) => {
    if (status === "paid")
      return `${pillBase} bg-dh-green/15 text-dh-ink border-dh-green/30`;
    if (status === "pending")
      return `${pillBase} bg-yellow-50 text-yellow-900 border-yellow-200`;
    if (status === "manual")
      return `${pillBase} bg-blue-50 text-blue-900 border-blue-200`;
    return `${pillBase} bg-red-50 text-red-900 border-red-200`;
  };

  const statusLabel = (s?: string) => {
    if (s === "paid") return "Pagado";
    if (s === "pending") return "Pendiente";
    if (s === "manual") return "Manual";
    if (s === "expired") return "Expirado";
    if (s === "unpaid") return "No pagado";
    if (s === "failed") return "Fallido";
    return s || "Desconocido";
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-dh-soft">
        <section className="max-w-6xl mx-auto px-4 py-10 text-dh-ink">
          <SectionHeader
            title="Mis Inscripciones"
            subtitle="Aquí encontrarás todos tus registros activos"
          />

          {list.length === 0 ? (
            <div className={`${cardBase} p-8 text-center`}>
              <div className="mx-auto w-12 h-12 rounded-2xl bg-dh-purple/10 flex items-center justify-center">
                <ClipboardIcon className="w-6 h-6 text-dh-purple" />
              </div>
              <p className="mt-4 font-extrabold text-lg">No hay inscripciones</p>
              <p className="text-sm text-gray-600 mt-1">
                Cuando te inscribas a una carrera, aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((i) => {
  const bloqueadoPorPausa =
    i.inscripcionesAbiertas === false &&
    i.paymentStatus !== "paid" &&
    i.paymentStatus !== "manual";

  return (
    <div
      key={i.id}
      className={`${cardBase} overflow-hidden flex flex-col`}
    >
                  {/* Imagen */}
                  {i.imagenUrl ? (
                    <div className="relative h-40 bg-gray-100 overflow-hidden">
                      <img
                        src={i.imagenUrl}
                        alt={i.titulo}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-dh-dark/55 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                        <span className="text-white font-extrabold leading-tight line-clamp-2">
                          {i.titulo}
                        </span>
                        <span className={pill(i.paymentStatus)}>
                          {statusLabel(i.paymentStatus)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex items-center justify-between border-b border-dh-purple/10 bg-dh-soft">
                      <h2 className="font-extrabold text-lg line-clamp-1">
                        {i.titulo}
                      </h2>
                      <span className={pill(i.paymentStatus)}>
                        {statusLabel(i.paymentStatus)}
                      </span>
                    </div>
                  )}

                  <div className="p-5 flex-1 flex flex-col gap-4">
                    {/* Número + nombre */}
                    <div className="space-y-1">
                      <div className="text-sm text-gray-600 font-semibold">
                        Número asignado
                      </div>
                      <div className="text-2xl font-extrabold">
                        <span className="text-dh-purple">#</span>
                        {i.competitorNumber ?? "—"}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <ClipboardIcon className="w-5 h-5 text-dh-green" />
                        <span className="font-semibold line-clamp-2">
                          {fullName(
                            i.perfilNombre,
                            i.perfilApPaterno,
                            i.perfilApMaterno
                          )}
                        </span>
                      </div>

                      {i.perfilClub && (
                        <div className="text-xs text-gray-600">
                          <span className="font-semibold">Club:</span>{" "}
                          {i.perfilClub}
                        </div>
                      )}
                    </div>

                    {/* Distancia + categoría */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-dh-purple/10 bg-white p-3">
                        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">
                          Distancia
                        </div>
                        <div className="text-sm font-extrabold text-dh-ink mt-1">
                          {i.distancia || "—"}
                        </div>
                      </div>

                      <div className="rounded-xl border border-dh-purple/10 bg-white p-3">
                        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">
                          Categoría
                        </div>
                        <div className="text-sm font-extrabold text-dh-ink mt-1 line-clamp-1">
                          {i.categoria || "—"}
                        </div>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-col gap-2 text-sm text-gray-700">
                      <span className="flex items-center gap-2">
                        <MapPinIcon className="w-5 h-5 text-gray-500" />
                        <span className="line-clamp-1">
                          {i.ubicacion || "—"}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-gray-500" />
                        <span>{i.fechaCarr || "—"}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <ClockIcon className="w-5 h-5 text-gray-500" />
                        <span>{i.horaSalida || "—"}</span>
                      </span>
                    </div>
                    

{/* Acciones */}
<div className="mt-auto pt-2 flex flex-col gap-2">

  <div className="flex items-center justify-between gap-3">
    {/* ✅ PAGADO */}
    {i.paymentStatus === "paid" ? (
      <div className="flex flex-col gap-2">
        <button
          onClick={() => generarPDF(i)}
          className={`${btnBase} bg-dh-green text-dh-dark hover:opacity-95`}
        >
          <DocumentArrowDownIcon className="w-5 h-5" />
          Confirmación
        </button>

        {i.carreraFinalizada && i.resultadosPublicado && i.resultadosUrl && (
          <a
            href={i.resultadosUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnBase} bg-dh-purple text-white hover:opacity-95`}
          >
            🏁 Resultados
          </a>
        )}
      </div>

    ) : i.paymentStatus === "manual" ? (
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <CheckCircleIcon className="w-5 h-5 text-blue-600" />
        Registro manual
      </div>

    ) : bloqueadoPorPausa ? (
      // 🔒 BLOQUEADO POR PAUSA
      <div className="flex items-center gap-2 text-xs text-red-600">
        <span className="font-extrabold">🔒</span>
        Inscripciones pausadas
      </div>

    ) : (
      // 🔁 REINTENTO NORMAL
      <button
        onClick={() => reintentarPago(i)}
        className={`${btnBase} bg-dh-purple text-white hover:opacity-95`}
      >
        <ArrowPathIcon className="w-5 h-5" />
        Reintentar
      </button>
    )}
  </div>

  {/* ✅ HINT (FUERA del ternario) */}
  {i.paymentStatus !== "paid" &&
    i.paymentStatus !== "manual" &&
    !bloqueadoPorPausa && (
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <CreditCardIcon className="w-4 h-4 text-gray-500" />
        {i.paymentStatus === "pending" ? "Pago en proceso" : "Revisar"}
      </div>
    )}
</div>

                    {/* Nota si falla */}
                    {i.paymentStatus === "failed" && (
                      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 mt-0.5" />
                        <span>
                          El pago no se completó. Puedes reintentar cuando gustes.
                        </span>
                      </div>
                    )}

                    {i.paymentStatus === "expired" && (
                      <div className="mt-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 mt-0.5" />
                        <span>
                          El link de pago expiró. Puedes reintentar para generar uno nuevo.
                        </span>
                      </div>
                    )}

                    {i.paymentStatus === "unpaid" && (
                      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 mt-0.5" />
                        <span>
                          El pago falló o fue rechazado. Puedes reintentar cuando gustes.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
);
})}
            </div>
          )}
        </section>
      </div>
    </AuthGuard>
  );
}
