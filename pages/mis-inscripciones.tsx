import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp
} from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";

interface InscRaw {
  carreraId: string;
  perfilOwner: string;
  perfilId: string;
  categoria: string;
  timestamp: any;
  sessionId?: string;
  paymentStatus?: string;
}

interface InscView {
  id: string;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  carreraId: string;
  categoria: string;
  fechaIns: string;
  titulo: string;
  fechaCarr: string;
  horaSalida?: string;
  ubicacion?: string;
  imagenUrl?: string;
  paymentStatus: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function MisInscripcionesPage() {
  const [list, setList] = useState<InscView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        setLoading(false);
        return;
      }

      // 1) Traer todas las inscripciones del usuario
      const inscSnap = await getDocs(
        query(
          collection(db, "inscripciones"),
          where("perfilOwner", "==", user.uid)
        )
      );

      const v = await Promise.all(
        inscSnap.docs.map(async d => {
          const src = d.data() as InscRaw;
          // 2) Información de la carrera
          const cDoc = await getDoc(doc(db, "carreras", src.carreraId));
          const c = cDoc.exists() ? cDoc.data()! : {};

          // 3) Información del perfil
          let perfilNombre = "", perfilApPaterno = "", perfilApMaterno = "";
          if (src.perfilId === src.perfilOwner) {
            const uDoc = await getDoc(doc(db, "usuarios", src.perfilOwner));
            if (uDoc.exists()) {
              const ud = uDoc.data() as any;
              perfilNombre    = ud.nombre;
              perfilApPaterno = ud.apPaterno  || ud.apellidoPaterno;
              perfilApMaterno = ud.apMaterno  || ud.apellidoMaterno;
            }
          } else {
            const subDoc = await getDoc(
              doc(db, "usuarios", src.perfilOwner, "perfiles", src.perfilId)
            );
            if (subDoc.exists()) {
              const sd = subDoc.data() as any;
              perfilNombre    = sd.nombre;
              perfilApPaterno = sd.apellidoPaterno;
              perfilApMaterno = sd.apellidoMaterno;
            }
          }

          // 4) Formatear fechas
          const fechaIns = src.timestamp?.toDate
            ? src.timestamp.toDate().toLocaleString()
            : "";

          let fechaCarr = "";
          if ((c as any).fecha instanceof Timestamp) {
            const dt = (c as any).fecha.toDate();
            const local = new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
            fechaCarr = `${pad(local.getDate())}/${pad(local.getMonth()+1)}/${local.getFullYear()}`;
          } else if (typeof (c as any).fecha === "string") {
            const [y,m,d] = (c as any).fecha.split("-");
            fechaCarr = `${d}/${m}/${y}`;
          }

          // 5) Estado de pago (viene de Firestore, actualizado por tu webhook)
          const paymentStatus = src.paymentStatus || "pending";

          return {
            id            : d.id,
            perfilNombre,
            perfilApPaterno,
            perfilApMaterno,
            carreraId     : src.carreraId,
            categoria     : src.categoria,
            fechaIns,
            titulo        : (c as any).titulo || "(sin título)",
            fechaCarr,
            horaSalida    : (c as any).horaSalida,
            ubicacion     : (c as any).lugar || (c as any).ubicacion,
            imagenUrl     : (c as any).imagenUrl,
            paymentStatus
          };
        })
      );

      setList(v);
      setLoading(false);
    });
    return () => unsub();
  }, []);

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
            {list.map(i => (
              <li key={i.id} className="border rounded shadow hover:shadow-lg overflow-hidden">
                <Link href={`/inscribirse?carreraId=${i.carreraId}`}>
                  <a className="flex flex-col md:flex-row">
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
                      <p><strong>Inscrito como:</strong> {i.perfilNombre} {i.perfilApPaterno} {i.perfilApMaterno}</p>
                      <p><strong>Categoría:</strong> {i.categoria}</p>
                      <p className="text-sm text-gray-500">Inscripción: {i.fechaIns}</p>
                      <p>
                        <strong>Pago:</strong>{" "}
                        <span className={`font-medium capitalize ${
                          i.paymentStatus === "paid"      ? "text-green-600" :
                          i.paymentStatus === "pending"   ? "text-yellow-600" :
                          i.paymentStatus === "unpaid"    ? "text-red-600" : ""
                        }`}>
                          {i.paymentStatus}
                        </span>
                      </p>
                    </div>
                  </a>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AuthGuard>
  );
}