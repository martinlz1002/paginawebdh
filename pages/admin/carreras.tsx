import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

export default function AdminCarreras() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [carreras, setCarreras] = useState<any[]>([]);
  const [nuevaCarrera, setNuevaCarrera] = useState({ nombre: "", fecha: "" });

  const fetchCarreras = async () => {
    const snap = await getDocs(collection(db, "carreras"));
    setCarreras(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const agregarCarrera = async () => {
    if (nuevaCarrera.nombre && nuevaCarrera.fecha) {
      await addDoc(collection(db, "carreras"), nuevaCarrera);
      setNuevaCarrera({ nombre: "", fecha: "" });
      fetchCarreras();
    }
  };

  const eliminarCarrera = async (id: string) => {
    if (confirm("¿Eliminar esta carrera?")) {
      await deleteDoc(doc(db, "carreras", id));
      fetchCarreras();
    }
  };

  const editarCarrera = async (id: string, nombre: string, fecha: string) => {
    const nuevoNombre = prompt("Nuevo nombre:", nombre);
    const nuevaFecha = prompt("Nueva fecha:", fecha);
    if (nuevoNombre && nuevaFecha) {
      await updateDoc(doc(db, "carreras", id), {
        nombre: nuevoNombre,
        fecha: nuevaFecha,
      });
      fetchCarreras();
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        setUser(user);
        fetchCarreras();
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-bold text-softPurple mb-4">Gestión de Carreras</h1>

      <div className="mb-6 flex gap-2">
        <input
          type="text"
          placeholder="Nombre de la carrera"
          className="border p-2 rounded w-1/2"
          value={nuevaCarrera.nombre}
          onChange={(e) => setNuevaCarrera({ ...nuevaCarrera, nombre: e.target.value })}
        />
        <input
          type="date"
          className="border p-2 rounded w-1/3"
          value={nuevaCarrera.fecha}
          onChange={(e) => setNuevaCarrera({ ...nuevaCarrera, fecha: e.target.value })}
        />
        <button
          onClick={agregarCarrera}
          className="bg-softGreen text-white px-4 py-2 rounded"
        >
          Agregar
        </button>
      </div>

      <div className="space-y-2">
        {carreras.map((c) => (
          <div
            key={c.id}
            className="p-4 bg-gray-100 rounded shadow flex justify-between items-center"
          >
            <div>
              <p className="font-semibold">{c.nombre}</p>
              <p className="text-sm text-gray-500">Fecha: {c.fecha}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => editarCarrera(c.id, c.nombre, c.fecha)}
                className="px-3 py-1 bg-blue-500 text-white rounded"
              >
                Editar
              </button>
              <button
                onClick={() => eliminarCarrera(c.id)}
                className="px-3 py-1 bg-red-500 text-white rounded"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
