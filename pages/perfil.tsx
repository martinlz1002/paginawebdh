import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function Perfil() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [inscripciones, setInscripciones] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const q = query(
          collection(db, "inscripciones"),
          where("uid", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const datos = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setInscripciones(datos);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto bg-white shadow rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-4 text-softPurple">Mi perfil</h1>
        {user && (
          <div className="mb-6">
            <p><strong>Nombre:</strong> {user.displayName}</p>
            <p><strong>Email:</strong> {user.email}</p>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-2 text-softGreen">Mis inscripciones</h2>
        <div className="space-y-4">
          {inscripciones.length > 0 ? (
            inscripciones.map((i) => (
              <div
                key={i.id}
                className="p-4 border rounded shadow-sm bg-gray-100 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">{i.carrera}</p>
                  <p className="text-sm text-gray-600">Pago: {i.estadoPago}</p>
                </div>
              </div>
            ))
          ) : (
            <p>No tienes inscripciones aún.</p>
          )}
        </div>
      </div>
    </div>
  );
}
