import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  collectionGroup,
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
} from "@heroicons/react/24/outline";

interface InscRaw {
  perfilOwner: string;
  perfilId: string;
  categoria: string;
  timestamp: any;
  sessionId?: string;
  paymentStatus?: string;
}

interface InscView {
  refPath: string;       // ruta completa para updateDoc
  carreraId: string;
  titulo: string;
  fechaCarr: string;
  horaSalida?: string;
  ubicacion?: string;
  imagenUrl?: string;
  precio: number;
  categoria: string;
  // perfil
  perfilId: string;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  perfilClub?: string;
  // inscripción
  fechaIns: string;
  sessionId?: string;
  paymentStatus?: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
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
      // usamos collectionGroup para leer todas las subcolecciones 'docs'
      const q = query(
        collectionGroup(db, "docs"),
        where("perfilOwner", "==", user.uid)
      );
      const unsubSnap = onSnapshot(q, async (snap) => {
        const views: InscView[] = await Promise.all(
          snap.docs.map(async (d) => {
            const src = d.data() as InscRaw;
            // extraer carreraId de la ruta: inscripciones/{carreraId}/docs/{docId}
            const carreraId = d.ref.parent.parent?.id ?? "";

            // datos carrera
            const cDoc = await getDoc(doc(db, "carreras", carreraId));
            const cdata = cDoc.exists() ? (cDoc.data() as any) : {};
            const categoriaObj = Array.isArray(cdata.categorias)
              ? cdata.categorias.find((cat: any) => cat.nombre === src.categoria)
              : null;
            const precio: number = categoriaObj?.price ?? 0;

            // datos perfil
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
                perfilApPaterno = sd.apellidoPaterno;
                perfilApMaterno = sd.apellidoMaterno;
                perfilClub = sd.club;
              }
            }

            // formatear fechas
            const fechaIns = src.timestamp?.toDate
              ? src.timestamp.toDate().toLocaleString()
              : "";
            let fechaCarr = "";
            if (cdata.fecha instanceof Timestamp) {
              const dt = (cdata.fecha as Timestamp).toDate();
              const local = new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
              fechaCarr = `${pad(local.getDate())}/${pad(
                local.getMonth() + 1
              )}/${local.getFullYear()}`;
            } else if (typeof cdata.fecha === "string") {
              const [y, m, d] = (cdata.fecha as string).split("-");
              fechaCarr = `${d}/${m}/${y}`;
            }

            // estado Stripe
            let paymentStatus: string | undefined = src.paymentStatus;
            if (src.sessionId) {
              try {
                const res = await fetch(
                  `/api/get-session?session_id=${src.sessionId}`
                );
                if (res.ok) {
                  const json = await res.json();
                  paymentStatus = json.payment_status;
                }
              } catch {
                paymentStatus = paymentStatus ?? "desconocido";
              }
            }

            return {
              refPath: d.ref.path,
              carreraId,
              titulo: cdata.titulo || "(sin título)",
              fechaCarr,
              horaSalida: cdata.horaSalida,
              ubicacion: cdata.lugar || cdata.ubicacion,
              imagenUrl: cdata.imagenUrl,
              precio,
              categoria: src.categoria,
              perfilId: src.perfilId,
              perfilNombre,
              perfilApPaterno,
              perfilApMaterno,
              perfilClub,
              fechaIns,
              sessionId: src.sessionId,
              paymentStatus,
            };
          })
        );
        setList(views);
        setLoading(false);
      });
      return () => unsubSnap();
    });
    return () => unsubAuth();
  }, []);

  // reintentar pago: actualizamos document vía su path
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
    if (!res.ok) {
      console.error("Error reintentando pago:", await res.text());
      return;
    }
    const { url, sessionId } = await res.json();

    // actualiza el mismo doc en subcolección
    await updateDoc(doc(db, item.refPath), {
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
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Mis Inscripciones</h1>
        {list.length === 0 ? (
          <p className="text-center text-gray-500">No hay inscripciones.</p>
        ) : (
          <ul className="space-y-6">
            {list.map((i) => (
              <li
                key={i.refPath}
                className="border rounded shadow hover:shadow-lg overflow-hidden"
              >
                <div className="flex flex-col md:flex-row">
                  {i.imagenUrl ? (
                    <div className="md:w-1/3 h-48 overflow-hidden">
                      <img
                        src={i.imagenUrl}
                        alt={i.titulo}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="md:w-1/3 h-48 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500">Sin imagen</span>
                    </div>
                  )}
                  <div className="p-4 flex-1 space-y-2">
                    <h2 className="text-xl font-semibold">{i.titulo}</h2>
                    <p className="text-sm text-gray-600">
                      <ClipboardIcon className="inline-block w-4 h-4 mr-1" />
                      {i.perfilNombre} {i.perfilApPaterno}{" "}
                      {i.perfilApMaterno}
                      {i.perfilClub && (
                        <span className="ml-2 text-gray-500">
                          • Club: {i.perfilClub}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      <MapPinIcon className="inline-block w-4 h-4 mr-1" />
                      {i.ubicacion || "-"} ·{" "}
                      <CalendarIcon className="inline-block w-4 h-4 mr-1" />
                      {i.fechaCarr} ·{" "}
                      <ClockIcon className="inline-block w-4 h-4 mr-1" />
                      {i.horaSalida || "-"}
                    </p>
                    <p>
                      <strong>Categoría:</strong> {i.categoria} ($
                      {i.precio.toFixed(2)})
                    </p>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs ${
                        i.paymentStatus === "paid"
                          ? "bg-green-100 text-green-800"
                          : i.paymentStatus === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {i.paymentStatus || "desconocido"}
                    </span>
                    {i.paymentStatus !== "paid" && (
                      <button
                        onClick={() => reintentarPago(i)}
                        className="mt-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                      >
                        Reintentar pago
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AuthGuard>
  );
}