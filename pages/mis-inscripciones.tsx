import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, app } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Inscripcion {
  id: string;
  carreraId: string;
  carreraTitulo: string;
  carreraFecha: string;
  categoriaId: string;
  categoriaNombre: string;
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
  creado: string;
}

export default function MisInscripcionesPage() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(
          collection(db, "inscripciones"),
          where("usuarioId", "==", user.uid)
        );
        const snapshot = await getDocs(q);

        const data: Inscripcion[] = [];

        for (const docSnap of snapshot.docs) {
          const insc = docSnap.data();

          // Datos de la carrera
          let carreraTitulo = "Desconocido";
          let carreraFecha = "Sin fecha";
          let categoriaNombre = "Categoría desconocida";

          try {
            const carreraRef = doc(db, "carreras", insc.carreraId);
            const carreraSnap = await getDoc(carreraRef);
            if (carreraSnap.exists()) {
              const carreraData = carreraSnap.data();
              carreraTitulo = carreraData.titulo;
              carreraFecha = carreraData.fecha.toDate().toLocaleDateString();

              // Buscar la categoría en la subcolección
              const catRef = doc(
                db,
                "carreras",
                insc.carreraId,
                "categorias",
                insc.categoriaId
              );
              const catSnap = await getDoc(catRef);
              if (catSnap.exists()) {
                categoriaNombre = catSnap.data().nombre;
              }
            }
          } catch (error) {
            console.error("Error obteniendo carrera o categoría:", error);
          }

          data.push({
            id: docSnap.id,
            carreraId: insc.carreraId,
            carreraTitulo,
            carreraFecha,
            categoriaId: insc.categoriaId,
            categoriaNombre,
            nombre: insc.nombre,
            apellidoPaterno: insc.apellidoPaterno,
            apellidoMaterno: insc.apellidoMaterno,
            edad: insc.edad,
            fechaNacimiento: insc.fechaNacimiento,
            celular: insc.celular,
            pais: insc.pais,
            estado: insc.estado,
            ciudad: insc.ciudad,
            club: insc.club,
            creado: new Date(insc.creado?.seconds * 1000 || Date.now()).toLocaleString(),
          });
        }

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
                  <strong>Carrera:</strong> {inscripcion.carreraTitulo}
                </p>
                <p>
                  <strong>Fecha:</strong> {inscripcion.carreraFecha}
                </p>
                <p>
                  <strong>Categoría:</strong> {inscripcion.categoriaNombre}
                </p>
                <p>
                  <strong>Nombre:</strong> {inscripcion.nombre} {inscripcion.apellidoPaterno} {inscripcion.apellidoMaterno}
                </p>
                <p>
                  <strong>Edad:</strong> {inscripcion.edad} años
                </p>
                <p>
                  <strong>Fecha de nacimiento:</strong> {inscripcion.fechaNacimiento}
                </p>
                <p>
                  <strong>Celular:</strong> {inscripcion.celular}
                </p>
                <p>
                  <strong>País:</strong> {inscripcion.pais}, <strong>Estado:</strong> {inscripcion.estado}, <strong>Ciudad:</strong> {inscripcion.ciudad}
                </p>
                {inscripcion.club && <p><strong>Club:</strong> {inscripcion.club}</p>}
                <p className="text-sm text-gray-500 mt-2">
                  Registrado el {inscripcion.creado}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProtectedRoute>
  );
}