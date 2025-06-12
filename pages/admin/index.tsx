import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { useRouter } from "next/router";

interface Inscripcion {
  id: string;
  carreraId: string;
  categoriaId: string;
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

export default function AdminPage() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [carreras, setCarreras] = useState<{ id: string; titulo: string }[]>([]);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const auth = getAuth();
  const router = useRouter();

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      router.push("/login");
      return;
    }

    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    const userData = userDoc.data();

    if (userData?.admin === true) {
      setIsAdmin(true);

      const carrerasSnap = await getDocs(collection(db, "carreras"));
      const carrerasList = carrerasSnap.docs.map((doc) => ({
        id: doc.id,
        titulo: doc.data().titulo,
      }));
      setCarreras(carrerasList);
    } else {
      router.push("/"); // Redirigir si no es admin
    }
  });

  return () => unsubscribe();
}, []);

  useEffect(() => {
    const fetchInscripciones = async () => {
      if (!carreraSeleccionada) return;
      const q = query(collection(db, "inscripciones"), where("carreraId", "==", carreraSeleccionada));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => {
        const insc = doc.data();
        return {
          id: doc.id,
          carreraId: insc.carreraId,
          categoriaId: insc.categoriaId,
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
        };
      });
      setInscripciones(data);
    };

    fetchInscripciones();
  }, [carreraSeleccionada]);

  const exportCSV = () => {
    const csv = Papa.unparse(inscripciones);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "inscripciones.csv");
  };

  if (!isAdmin) return null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Panel de Administración</h1>

      <label className="block mb-2 font-semibold">Selecciona una carrera:</label>
      <select
        value={carreraSeleccionada}
        onChange={(e) => setCarreraSeleccionada(e.target.value)}
        className="border p-2 rounded w-full mb-6"
      >
        <option value="">Seleccione una carrera</option>
        {carreras.map((carrera) => (
          <option key={carrera.id} value={carrera.id}>
            {carrera.titulo}
          </option>
        ))}
      </select>

      {inscripciones.length > 0 && (
        <>
          <button
            onClick={exportCSV}
            className="mb-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Exportar a CSV
          </button>

          <ul className="space-y-4">
            {inscripciones.map((inscripcion) => (
              <li key={inscripcion.id} className="border p-4 rounded shadow">
                <p><strong>Nombre:</strong> {inscripcion.nombre} {inscripcion.apellidoPaterno} {inscripcion.apellidoMaterno}</p>
                <p><strong>Edad:</strong> {inscripcion.edad} años</p>
                <p><strong>Fecha de nacimiento:</strong> {inscripcion.fechaNacimiento}</p>
                <p><strong>Celular:</strong> {inscripcion.celular}</p>
                <p><strong>País:</strong> {inscripcion.pais}, <strong>Estado:</strong> {inscripcion.estado}, <strong>Ciudad:</strong> {inscripcion.ciudad}</p>
                {inscripcion.club && <p><strong>Club:</strong> {inscripcion.club}</p>}
                <p className="text-sm text-gray-500 mt-2">Registrado el {inscripcion.creado}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
