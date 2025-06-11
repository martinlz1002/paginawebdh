import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

export default function AdminInscripciones() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [inscripciones, setInscripciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInscripciones = async () => {
    const insSnap = await getDocs(collection(db, "inscripciones"));
    setInscripciones(
      insSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
  };

  const eliminarInscripcion = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta inscripción?")) {
      await deleteDoc(doc(db, "inscripciones", id));
      fetchInscripciones();
    }
  };

  const marcarComoPagado = async (id: string) => {
    await updateDoc(doc(db, "inscripciones", id), {
      estadoPago: "pagado",
    });
    fetchInscripciones();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        setUser(user);
        fetchInscripciones();
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-bold text-softPurple mb-4">Gestión de Inscripciones</h1>
      <div className="space-y-4">
        {inscripciones.map((i) => (
          <div
            key={i.id}
            className="bg-gray-100 p-4 rounded shadow flex justify-between items-center"
          >
            <div>
              <p>
                <strong>{i.nombre} {i.apellidoPaterno}</strong> - {i.carrera}
              </p>
              <p className="text-sm text-gray-600">Pago: {i.estadoPago}</p>
            </div>
            <div className="flex gap-2">
              {i.estadoPago !== "pagado" && (
                <button
                  onClick={() => marcarComoPagado(i.id)}
                  className="px-2 py-1 bg-green-500 text-white rounded"
                >
                  Marcar como pagado
                </button>
              )}
              <button
                onClick={() => eliminarInscripcion(i.id)}
                className="px-2 py-1 bg-red-500 text-white rounded"
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
