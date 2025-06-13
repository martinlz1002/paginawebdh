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
  addDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { useRouter } from "next/router";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
  const [filtro, setFiltro] = useState<string>("");
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [nuevaCarrera, setNuevaCarrera] = useState({
    titulo: "",
    descripcion: "",
    ubicacion: "",
    fecha: "",
    imagenUrl: "",
  });

  const auth = getAuth();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        const userData = userDoc.data();
        if (userData?.admin) {
          setIsAdmin(true);
          const carrerasSnap = await getDocs(collection(db, "carreras"));
          const carrerasList = carrerasSnap.docs.map((doc) => ({
            id: doc.id,
            titulo: doc.data().titulo,
          }));
          setCarreras(carrerasList);
        } else {
          router.push("/");
        }
      } else {
        router.push("/login");
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

  const agregarCarrera = async () => {
    if (!nuevaCarrera.titulo || !nuevaCarrera.fecha) return;
    let imagenUrl = "";

    try {
      if (imagenArchivo) {
        const storage = getStorage();
        const storageRef = ref(storage, `carreras/${Date.now()}_${imagenArchivo.name}`);
        await uploadBytes(storageRef, imagenArchivo);
        imagenUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "carreras"), {
        titulo: nuevaCarrera.titulo,
        descripcion: nuevaCarrera.descripcion,
        ubicacion: nuevaCarrera.ubicacion,
        fecha: Timestamp.fromDate(new Date(nuevaCarrera.fecha)),
        imagenUrl: imagenUrl || null,
        creado: serverTimestamp(),
      });

      setNuevaCarrera({ titulo: "", descripcion: "", ubicacion: "", fecha: "", imagenUrl: "" });
      setImagenArchivo(null);
      alert("Carrera agregada exitosamente");
    } catch (e) {
      console.error("Error al agregar carrera:", e);
      alert("Error al agregar carrera");
    }
  };

  const inscripcionesFiltradas = inscripciones.filter((insc) => {
    const termino = filtro.toLowerCase();
    return Object.values(insc).some((valor) =>
      typeof valor === "string" || typeof valor === "number"
        ? valor.toString().toLowerCase().includes(termino)
        : false
    );
  });

  if (!auth.currentUser) return <p className="p-6 text-center">Verificando sesión...</p>;
  if (!isAdmin) return <p className="p-6 text-center text-red-600">Acceso denegado. No eres administrador.</p>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Panel de Administración</h1>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Agregar nueva carrera</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" placeholder="Título" value={nuevaCarrera.titulo} onChange={(e) => setNuevaCarrera({ ...nuevaCarrera, titulo: e.target.value })} className="border p-2 rounded" />
          <input type="text" placeholder="Ubicación" value={nuevaCarrera.ubicacion} onChange={(e) => setNuevaCarrera({ ...nuevaCarrera, ubicacion: e.target.value })} className="border p-2 rounded" />
          <input type="date" value={nuevaCarrera.fecha} onChange={(e) => setNuevaCarrera({ ...nuevaCarrera, fecha: e.target.value })} className="border p-2 rounded" />
          <input type="file" accept="image/*" onChange={(e) => setImagenArchivo(e.target.files?.[0] || null)} className="border p-2 rounded" />
          <textarea placeholder="Descripción" value={nuevaCarrera.descripcion} onChange={(e) => setNuevaCarrera({ ...nuevaCarrera, descripcion: e.target.value })} className="border p-2 rounded col-span-1 md:col-span-2" />
        </div>
        <button onClick={agregarCarrera} className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Agregar carrera</button>
      </div>

      <label className="block mb-2 font-semibold">Selecciona una carrera:</label>
      <select
        value={carreraSeleccionada}
        onChange={(e) => setCarreraSeleccionada(e.target.value)}
        className="border p-2 rounded w-full mb-4"
      >
        <option value="">Seleccione una carrera</option>
        {carreras.map((carrera) => (
          <option key={carrera.id} value={carrera.id}>
            {carrera.titulo}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Buscar en todos los campos..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="border p-2 rounded w-full mb-4"
      />

      {inscripcionesFiltradas.length > 0 && (
        <>
          <button
            onClick={exportCSV}
            className="mb-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Exportar a CSV
          </button>

          <div className="overflow-auto">
            <table className="min-w-full table-auto border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">Nombre</th>
                  <th className="border p-2">Apellido Paterno</th>
                  <th className="border p-2">Apellido Materno</th>
                  <th className="border p-2">Edad</th>
                  <th className="border p-2">Fecha Nacimiento</th>
                  <th className="border p-2">Celular</th>
                  <th className="border p-2">País</th>
                  <th className="border p-2">Estado</th>
                  <th className="border p-2">Ciudad</th>
                  <th className="border p-2">Club</th>
                  <th className="border p-2">Categoría</th>
                  <th className="border p-2">Registrado el</th>
                </tr>
              </thead>
              <tbody>
                {inscripcionesFiltradas.map((insc) => (
                  <tr key={insc.id} className="hover:bg-gray-50">
                    <td className="border p-2">{insc.nombre}</td>
                    <td className="border p-2">{insc.apellidoPaterno}</td>
                    <td className="border p-2">{insc.apellidoMaterno}</td>
                    <td className="border p-2">{insc.edad}</td>
                    <td className="border p-2">{insc.fechaNacimiento}</td>
                    <td className="border p-2">{insc.celular}</td>
                    <td className="border p-2">{insc.pais}</td>
                    <td className="border p-2">{insc.estado}</td>
                    <td className="border p-2">{insc.ciudad}</td>
                    <td className="border p-2">{insc.club}</td>
                    <td className="border p-2">{insc.categoriaId}</td>
                    <td className="border p-2 text-xs text-gray-600">{insc.creado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
