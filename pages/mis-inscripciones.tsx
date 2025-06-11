import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Inscripcion {
  id: string;
  carreraId: string;
  perfilId: string;
}

interface Carrera {
  titulo: string;
}

interface Perfil {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

export default function MisInscripcionesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [inscripciones, setInscripciones] = useState<
    { carrera: Carrera; perfil: Perfil }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
      if (usuario) {
        setUser(usuario);
        const inscripcionesSnapshot = await getDocs(
          collection(db, "usuarios", usuario.uid, "inscripciones")
        );

        const data = await Promise.all(
          inscripcionesSnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as Inscripcion;

            const carreraDoc = await getDoc(doc(db, "carreras", data.carreraId));
            const perfilDoc = await getDoc(
              doc(db, "usuarios", usuario.uid, "perfiles", data.perfilId)
            );

            return {
              carrera: carreraDoc.exists()
                ? (carreraDoc.data() as Carrera)
                : { titulo: "Carrera no encontrada" },
              perfil: perfilDoc.exists()
                ? (perfilDoc.data() as Perfil)
                : { nombre: "Perfil", apellidoPaterno: "no", apellidoMaterno: "encontrado" },
            };
          })
        );

        setInscripciones(data);
        setLoading(false);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <ProtectedRoute>
        <p className="text-center mt-10">Cargando inscripciones...</p>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto mt-10 p-4">
        <h1 className="text-2xl font-bold mb-6">Mis inscripciones</h1>
        {inscripciones.length === 0 ? (
          <p className="text-gray-600">No tienes inscripciones registradas.</p>
        ) : (
          <ul className="space-y-4">
            {inscripciones.map(({ carrera, perfil }, i) => (
              <li
                key={i}
                className="border p-4 rounded-xl shadow hover:shadow-md transition"
              >
                <p className="font-semibold text-lg">
                  {carrera.titulo}
                </p>
                <p className="text-gray-600">
                  Inscrito como: {perfil.nombre} {perfil.apellidoPaterno} {perfil.apellidoMaterno}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProtectedRoute>
  );
}