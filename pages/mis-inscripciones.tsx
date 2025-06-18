import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  DocumentData,
  QueryDocumentSnapshot,
  doc,
  getDoc
} from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import AuthGuard from "@/components/AuthGuard";
import Link from "next/link";

interface InscRaw {
  carreraId: string;
  perfilOwner: string;  // ahora hay un campo perfilOwner en el doc
  categoria: string;
  timestamp: any;
}

interface InscView {
  id: string;
  carreraId: string;
  categoria: string;
  fechaIns: string;
  titulo: string;
  fechaCarr: string;
  ubicacion?: string;
  imagenUrl?: string;
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

      // 1) ahora filtramos por perfilOwner == usuario actual
      const inscQuery = query(
        collection(db, "inscripciones"),
        where("perfilOwner", "==", user.uid)
      );
      const inscSnap = await getDocs(inscQuery);

      // 2) montar la vista con datos de cada carrera
      const v: InscView[] = await Promise.all(
        inscSnap.docs.map(async (d: QueryDocumentSnapshot<DocumentData>) => {
          const src = d.data() as InscRaw;
          // fetch de la carrera
          const cDoc = await getDoc(doc(db, "carreras", src.carreraId));
          const c = cDoc.exists() ? cDoc.data()! : {};

          return {
            id: d.id,
            carreraId: src.carreraId,
            categoria: src.categoria,
            fechaIns: src.timestamp?.toDate
              ? src.timestamp.toDate().toLocaleString()
              : "",
            titulo: (c as any).titulo || "(sin título)",
            fechaCarr: (c as any).fecha?.toDate
              ? (c as any).fecha.toDate().toLocaleDateString()
              : "",
            ubicacion: (c as any).ubicacion,
            imagenUrl: (c as any).imagenUrl,
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
              <li
                key={i.id}
                className="border rounded shadow hover:shadow-lg overflow-hidden"
              >
                <Link href={`/inscribirse?carreraId=${i.carreraId}`}>
                  <a className="flex flex-col md:flex-row">
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
                    <div className="p-4 flex-1">
                      <h2 className="text-xl font-semibold">{i.titulo}</h2>
                      <p className="text-sm text-gray-600 mb-1">
                        📅 {i.fechaCarr} {i.ubicacion && <>· 📍 {i.ubicacion}</>}
                      </p>
                      <p><strong>Categoría:</strong> {i.categoria}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Inscrito: {i.fechaIns}
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