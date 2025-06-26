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
} from "@heroicons/react/24/outline";

interface InscRaw {
  carreraId: string;
  perfilOwner: string;
  perfilId: string;
  categoria: string;
  timestamp: any;
  sessionId?: string;
}

interface InscView {
  id: string;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  carreraId: string;
  perfilId: string;
  categoria: string;
  fechaIns: string;
  titulo: string;
  fechaCarr: string;
  horaSalida?: string;
  ubicacion?: string;
  imagenUrl?: string;
  precio: number;
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
      const q = query(
        collection(db, "inscripciones"),
        where("perfilOwner", "==", user.uid)
      );
      const unsubSnap = onSnapshot(q, async (snap) => {
        const views: InscView[] = await Promise.all(
          snap.docs.map(async (d) => {
            const src = d.data() as InscRaw;
            // → obtener carrera
            const cDoc = await getDoc(doc(db, "carreras", src.carreraId));
            const cdata = cDoc.exists() ? (cDoc.data() as any) : {};
            // → precio según categoría
            const categoriaObj = Array.isArray(cdata.categorias)
              ? (cdata.categorias as any[]).find(
                  (cat) => cat.nombre === src.categoria
                )
              : null;
            const precio: number = categoriaObj?.price ?? 0;
            // → perfil
            let perfilNombre = "", perfilApPaterno = "", perfilApMaterno = "";
            if (src.perfilId === src.perfilOwner) {
              const uDoc = await getDoc(doc(db, "usuarios", src.perfilOwner));
              if (uDoc.exists()) {
                const ud = uDoc.data() as any;
                perfilNombre = ud.nombre;
                perfilApPaterno = ud.apPaterno || ud.apellidoPaterno;
                perfilApMaterno = ud.apMaterno || ud.apellidoMaterno;
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
              }
            }
            // → formatear fechas
            const fechaIns = src.timestamp?.toDate
              ? src.timestamp.toDate().toLocaleString()
              : "";
            let fechaCarr = "";
            if (cdata.fecha instanceof Timestamp) {
              const dt = (cdata.fecha as Timestamp).toDate();
              const local = new Date(
                dt.getTime() + dt.getTimezoneOffset() * 60000
              );
              fechaCarr = `${pad(local.getDate())}/${pad(
                local.getMonth() + 1
              )}/${local.getFullYear()}`;
            } else if (typeof cdata.fecha === "string") {
              const [y, m, d] = (cdata.fecha as string).split("-");
              fechaCarr = `${d}/${m}/${y}`;
            }
            // → estado Stripe
            let paymentStatus: string | undefined;
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
                paymentStatus = "desconocido";
              }
            }
            return {
              id: d.id,
              perfilNombre,
              perfilApPaterno,
              perfilApMaterno,
              carreraId: src.carreraId,
              perfilId: src.perfilId,
              categoria: src.categoria,
              fechaIns,
              titulo: cdata.titulo || "(sin título)",
              fechaCarr,
              horaSalida: cdata.horaSalida,
              ubicacion: cdata.lugar || cdata.ubicacion,
              imagenUrl: cdata.imagenUrl,
              precio,
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

  // **Reintentar pago**: guarda el nuevo sessionId en Firestore
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
    // —> ACTUALIZO EL sessionId Y RESETEO paymentStatus
    const inscRef = doc(db, "inscripciones", item.id);
    await updateDoc(inscRef, { sessionId, paymentStatus: "pending" });
    // redirijo al checkout
    const win = window.open(url, "_blank");
    if (win) win.focus();
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
              <li key={i.id} className="border rounded shadow hover:shadow-lg overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {i.imagenUrl ? (
                    <div className="md:w-1/3 h-48 overflow-hidden">
                      <img src={i.imagenUrl} alt={i.titulo} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="md:w-1/3 h-48 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500">Sin imagen</span>
                    </div>
                  )}
                  <div className="p-4 flex-1 space-y-2">
                    <h2 className="text-xl font-semibold">{i.titulo}</h2>
                    <p className="text-sm text-gray-600">
                      📍 {i.ubicacion || "-"} · 📅 {i.fechaCarr} · ⏰ {i.horaSalida || "-"}
                    </p>
                    <p>
                      <strong>Categoría:</strong> {i.categoria} (${i.precio.toFixed(2)})
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