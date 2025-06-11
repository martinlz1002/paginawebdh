import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import InscripcionForm from "@/components/InscripcionForm";

export default function InscribirsePage() {
  const router = useRouter();
  const { id } = router.query;
  const [nombreCarrera, setNombreCarrera] = useState("");

  useEffect(() => {
    const fetchCarrera = async () => {
      if (id && typeof id === "string") {
        const docRef = doc(db, "carreras", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setNombreCarrera(docSnap.data().nombre);
        }
      }
    };
    fetchCarrera();
  }, [id]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-softPurple mb-6">Inscripción a: {nombreCarrera}</h1>
      {id && typeof id === "string" ? (
        <InscripcionForm carreraId={id} />
      ) : (
        <p className="text-red-600">Cargando datos de la carrera...</p>
      )}
    </div>
  );
}
