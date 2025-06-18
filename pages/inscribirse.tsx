import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import InscripcionForm from "@/components/InscripcionForm";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
}

interface Carrera {
  id: string;
  titulo: string;
  categorias: Categoria[];
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [mensajeCarrera, setMensajeCarrera] = useState("");

  // 1) Carga la carrera
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const dc = await getDoc(doc(db, "carreras", carreraId as string));
      if (dc.exists()) {
        const data = dc.data()!;
        setCarrera({
          id: dc.id,
          titulo: data.titulo,
          categorias: data.categorias || [],
        });
      } else {
        setMensajeCarrera("Carrera no encontrada");
      }
    })();
  }, [carreraId]);

  if (mensajeCarrera) {
    return (
      <AuthGuard>
        <p className="text-center mt-10 text-red-600">{mensajeCarrera}</p>
      </AuthGuard>
    );
  }

  if (!carrera) {
    return (
      <AuthGuard>
        <p className="text-center mt-10">Cargando carrera…</p>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">{carrera.titulo}</h1>

        {/* Aquí insertamos tu formulario reutilizable */}
        <InscripcionForm carreraId={carrera.id} />
      </div>
    </AuthGuard>
  );
}