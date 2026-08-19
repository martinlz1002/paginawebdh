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

        const visibles = all.filter((item) => {
  const fechaLimite = new Date(item.carreraDate);

  // La carrera permanece visible durante los 7 días posteriores
  fechaLimite.setDate(fechaLimite.getDate() + 7);

  // El día 7 todavía aparece.
  // A partir del día 8 desaparece.
  return today <= fechaLimite;
});

setList(visibles);
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
      return `${pillBase} bg-dh-purple/15 text-dh-ink border-dh-purple/30`;
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
    <div className="min-h-screen bg-dh-bg">

      <section className="max-w-6xl mx-auto px-4 py-12 space-y-10">

        {/* HERO */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold text-dh-ink">
            Mis <span className="text-dh-purple">Inscripciones</span>
          </h1>

          <p className="text-dh-muted">
            {list.length} {list.length === 1 ? "registro activo" : "registros activos"}
          </p>
        </div>

        {/* EMPTY */}
        {list.length === 0 ? (
          <div className="card p-10 text-center">
            <ClipboardIcon className="w-10 h-10 mx-auto text-dh-purple mb-4" />
            <p className="font-extrabold text-lg text-dh-ink">
              Aún no tienes inscripciones
            </p>
            <p className="text-sm text-dh-muted mt-1">
              Cuando te registres a una carrera aparecerá aquí.
            </p>
          </div>
        ) : (

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">

            {list.map((i) => {

              const bloqueadoPorPausa =
                i.inscripcionesAbiertas === false &&
                i.paymentStatus !== "paid" &&
                i.paymentStatus !== "manual";

              const nombreCompleto = fullName(
                i.perfilNombre,
                i.perfilApPaterno,
                i.perfilApMaterno
              );

              return (
                <div
                  key={i.id}
                  className="card overflow-hidden flex flex-col hover:shadow-lg transition"
                >

                  {/* HEADER IMAGEN */}
                  {i.imagenUrl && (
                    <div className="relative h-44">
                      <img
                        src={i.imagenUrl}
                        alt={i.titulo}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                        <h2 className="text-white font-extrabold leading-tight line-clamp-2">
                          {i.titulo}
                        </h2>

                        <span className={pill(i.paymentStatus)}>
                          {statusLabel(i.paymentStatus)}
                        </span>
                      </div>
                    </div>
                  )}

                  {!i.imagenUrl && (
                    <div className="p-4 border-b border-dh-border flex justify-between items-center bg-dh-soft">
                      <h2 className="font-extrabold text-dh-ink">
                        {i.titulo}
                      </h2>
                      <span className={pill(i.paymentStatus)}>
                        {statusLabel(i.paymentStatus)}
                      </span>
                    </div>
                  )}

                  <div className="p-6 flex flex-col gap-5 flex-1">

                    {/* NÚMERO */}
                    <div>
                      <p className="text-xs uppercase tracking-wide text-dh-muted font-bold">
                        Número asignado
                      </p>

                      <div className="text-3xl font-extrabold text-dh-purple mt-1">
                        #{i.competitorNumber ?? "—"}
                      </div>
                    </div>

                    {/* PERFIL */}
                    <div className="space-y-1">
                      <p className="font-semibold text-dh-ink">
                        {nombreCompleto || "—"}
                      </p>

                      {i.perfilClub && (
                        <p className="text-xs text-dh-muted">
                          Club: {i.perfilClub}
                        </p>
                      )}
                    </div>

                    {/* DISTANCIA / CATEGORIA */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-dh-soft rounded-xl p-3">
                        <div className="text-xs text-dh-muted font-bold">
                          Distancia
                        </div>
                        <div className="font-extrabold text-dh-ink mt-1">
                          {i.distancia || "—"}
                        </div>
                      </div>

                      <div className="bg-dh-soft rounded-xl p-3">
                        <div className="text-xs text-dh-muted font-bold">
                          Categoría
                        </div>
                        <div className="font-extrabold text-dh-ink mt-1">
                          {i.categoria || "—"}
                        </div>
                      </div>
                    </div>

                    {/* INFO */}
                    <div className="space-y-2 text-sm text-dh-muted">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {i.fechaCarr}
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPinIcon className="w-4 h-4" />
                        {i.ubicacion}
                      </div>

                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4" />
                        {i.horaSalida || "—"}
                      </div>
                    </div>

                    {/* ACCIONES */}
                    <div className="mt-auto pt-4 border-t border-dh-border space-y-3">

                      {i.paymentStatus === "paid" && (
                        <>
                          <button
                            onClick={() => generarPDF(i)}
                            className="w-full bg-dh-purple text-dh-dark py-2 rounded-xl font-extrabold hover:opacity-95 transition"
                          >
                            Descargar Confirmación
                          </button>

                          {i.carreraFinalizada &&
                            i.resultadosPublicado &&
                            i.resultadosUrl && (
                              <a
                                href={i.resultadosUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-center bg-dh-purple text-white py-2 rounded-xl font-extrabold hover:opacity-95 transition"
                              >
                                🏁 Ver Resultados
                              </a>
                            )}
                        </>
                      )}

                      {i.paymentStatus !== "paid" &&
                        i.paymentStatus !== "manual" &&
                        !bloqueadoPorPausa && (
                          <button
                            onClick={() => reintentarPago(i)}
                            className="w-full bg-dh-purple text-white py-2 rounded-xl font-extrabold hover:opacity-95 transition"
                          >
                            Reintentar Pago
                          </button>
                        )}

                      {bloqueadoPorPausa && (
                        <div className="text-center text-xs text-red-600 font-semibold">
                          🔒 Inscripciones pausadas
                        </div>
                      )}

                      {i.paymentStatus === "manual" && (
                        <div className="text-center text-xs text-blue-600 font-semibold">
                          Registro manual confirmado
                        </div>
                      )}

                    </div>

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
