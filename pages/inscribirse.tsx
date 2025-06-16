import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import InscripcionForm from "@/components/InscripcionForm";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Carrera {
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: any;
  imagenUrl?: string;
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const [carrera, setCarrera] = useState<Carrera | null>(null);

  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const snap = await getDoc(doc(db, 'carreras', carreraId as string));
      if (snap.exists()) setCarrera(snap.data() as Carrera);
      else router.push('/carreras');
    })();
  }, [carreraId]);

  return (
    <ProtectedRoute>
      <div className="max-w-md mx-auto my-10">
        <h1 className="text-2xl font-bold mb-4">Inscribirse</h1>
        {carrera && <InscripcionForm carreraId={carreraId as string} />}
      </div>
    </ProtectedRoute>
  );
}