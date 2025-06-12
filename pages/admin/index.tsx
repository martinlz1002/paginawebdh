// pages/admin/index.tsx
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db, app } from "@/lib/firebase";
import { useRouter } from "next/router";
import Papa from "papaparse";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const userDoc = await getDocs(collection(db, "usuarios"));
      const currentUser = userDoc.docs.find(doc => doc.id === user.uid);
      const admin = currentUser?.data()?.admin;

      if (!admin) {
        alert("Acceso denegado");
        router.push("/");
        return;
      }

      setIsAdmin(true);

      const snapshot = await getDocs(collection(db, "inscripciones"));
      const data = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          carreraId: d.carreraId,
          categoriaId: d.categoriaId,
          nombre: d.nombre,
          apellidoPaterno: d.apellidoPaterno,
          apellidoMaterno: d.apellidoMaterno,
          edad: d.edad,
          fechaNacimiento: d.fechaNacimiento,
          celular: d.celular,
          pais: d.pais,
          estado: d.estado,
          ciudad: d.ciudad,
          club: d.club,
          creado: new Date(d.creado?.seconds * 1000).toLocaleString(),
        };
      });

      setInscripciones(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const exportarCSV = () => {
    const csv = Papa.unparse(inscripciones);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "inscripciones.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <p className="p-6">Cargando...</p>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Panel de Administrador</h1>
      <button
        onClick={exportarCSV}
        className="mb-4 bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800"
      >
        Descargar CSV
      </button>
      <table className="w-full table-auto border border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Nombre</th>
            <th className="border px-2 py-1">Edad</th>
            <th className="border px-2 py-1">Ciudad</th>
            <th className="border px-2 py-1">País</th>
            <th className="border px-2 py-1">Carrera</th>
            <th className="border px-2 py-1">Fecha de inscripción</th>
          </tr>
        </thead>
        <tbody>
          {inscripciones.map((insc) => (
            <tr key={insc.id}>
              <td className="border px-2 py-1">
                {insc.nombre} {insc.apellidoPaterno} {insc.apellidoMaterno}
              </td>
              <td className="border px-2 py-1">{insc.edad}</td>
              <td className="border px-2 py-1">{insc.ciudad}</td>
              <td className="border px-2 py-1">{insc.pais}</td>
              <td className="border px-2 py-1">{insc.carreraId}</td>
              <td className="border px-2 py-1">{insc.creado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}