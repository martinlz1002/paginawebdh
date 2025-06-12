import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, app } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Inscripcion {
  id: string;
  carreraId: string;
  categoriaId: string;
  perfil: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    edad?: number;
    fechaNacimiento?: string;
    celular?: string;
    pais?: string;
    estado?: string;
    ciudad?: string;
    club?: string;
  };
  creado: string;
}

export default function MisInscripcionesPage() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "inscripciones"), where("usuarioId", "==", user.uid));
        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) => {
          const insc = doc.data();
          return {
            id: doc.id,
            carreraId: insc.carreraId,
            categoriaId: insc.categoriaId,
            perfil: insc.perfil,
            creado: new Date(insc.creado.seconds * 1000).toLocaleString(),
          };
        });

        setInscripciones(data);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p className="p-6">Cargando inscripciones...</p>;

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Mis inscripciones</h1>
        {inscripciones.length === 0 ? (
          <p>No tienes inscripciones registradas.</p>
        ) : (
          <ul className="space-y-4">
            {inscripciones.map((inscripcion) => (
              <li key={inscripcion.id} className="border p-4 rounded shadow">
                <p>
                  <strong>Nombre:</strong> {inscripcion.perfil.nombre} {inscripcion.perfil.apellidoPaterno} {inscripcion.perfil.apellidoMaterno}
                </p>
                <p>
                  <strong>Edad:</strong> {inscripcion.perfil.edad} años
                </p>
                <p>
                  <strong>Fecha de nacimiento:</strong> {inscripcion.perfil.fechaNacimiento}
                </p>
                <p>
                  <strong>Celular:</strong> {inscripcion.perfil.celular}
                </p>
                <p>
                  <strong>País:</strong> {inscripcion.perfil.pais}, <strong>Estado:</strong> {inscripcion.perfil.estado}, <strong>Ciudad:</strong> {inscripcion.perfil.ciudad}
                </p>
                {inscripcion.perfil.club && <p><strong>Club:</strong> {inscripcion.perfil.club}</p>}
                <p className="text-sm text-gray-500 mt-2">Registrado el {inscripcion.creado}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProtectedRoute>
  );
}
