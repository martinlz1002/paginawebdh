import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { app, db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, collection, getDocs, addDoc, serverTimestamp, query, where
} from "firebase/firestore";
import { registrarInscripcion } from "@/lib/Inscripciones";

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const [carrera, setCarrera] = useState<any>(null);
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Carga de carrera
  useEffect(() => {
    if (!carreraId) return;
    getDoc(doc(db, "carreras", carreraId as string)).then(dc => {
      if (dc.exists()) setCarrera({ id: dc.id, ...dc.data() });
      else setMensaje("Carrera no encontrada");
    });
  }, [carreraId]);

  // Carga de perfiles tras login
  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) return router.replace("/login");
      loadPerfiles(user.uid);
    });
    return () => unsub();
  }, []);

  async function loadPerfiles(uid: string) {
    const lista: any[] = [];
    const udoc = await getDoc(doc(db, "usuarios", uid));
    if (udoc.exists()) {
      const d: any = udoc.data();
      lista.push({ id: uid, nombre: d.nombre, apP: d.apPaterno, edad: d.edad });
    }
    const snap = await getDocs(collection(db, "usuarios", uid, "perfiles"));
    snap.docs.forEach(d => lista.push({ id: d.id, ...(d.data() as any) }));
    setPerfiles(lista);
    if (!perfilSeleccionado && lista.length) setPerfilSeleccionado(lista[0].id);
  }

  // Al inscribir…
  const handleInscribir = async () => {
    if (!perfilSeleccionado || !categoriaSeleccionada) {
      setMensaje("Selecciona perfil y categoría");
      return;
    }

    // 1) Chequeamos duplicados en la colección raíz
    const dupQ = query(
      collection(db, "inscripciones"),
      where("carreraId", "==", carrera!.id),
      where("perfilId", "==", perfilSeleccionado)
    );
    const dupSnap = await getDocs(dupQ);
    if (!dupSnap.empty) {
      setMensaje("Ya estás inscrito en esta carrera.");
      return;
    }

    // 2) Creamos la inscripción en /inscripciones
    try {
      await registrarInscripcion({
        carreraId: carrera!.id,
        perfilId: perfilSeleccionado,
        categoria: categoriaSeleccionada,
      });
      setMensaje("¡Inscripción exitosa!");
    } catch (err: any) {
      setMensaje("Error al inscribir: " + err.message);
    }
  };

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">{carrera?.titulo}</h1>

        {/* Perfil */}
        <select
          className="w-full border p-2 rounded"
          value={perfilSeleccionado}
          onChange={e => setPerfilSeleccionado(e.target.value)}
        >
          {perfiles.map(p => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.edad} años)
            </option>
          ))}
        </select>

        {/* Categoría */}
        <select
          className="w-full border p-2 rounded"
          value={categoriaSeleccionada}
          onChange={e => setCategoriaSeleccionada(e.target.value)}
        >
          <option value="">-- Elige categoría --</option>
          {carrera?.categorias
            .filter((cat: any) => {
              const p = perfiles.find(x => x.id === perfilSeleccionado)!;
              return p.edad >= cat.minAge && p.edad <= cat.maxAge;
            })
            .map((cat: any) => (
              <option key={cat.nombre} value={cat.nombre}>
                {cat.nombre} ({cat.minAge}–{cat.maxAge})
              </option>
            ))}
        </select>

        <button
          onClick={handleInscribir}
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
        >
          Inscribirme
        </button>

        {mensaje && <p className="mt-4 text-center">{mensaje}</p>}
      </div>
    </AuthGuard>
  );
}