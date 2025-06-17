import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { app, db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

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

interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  edad: number;
  // …otros campos
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSelected, setPerfilSelected] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newProfile, setNewProfile] = useState<any>({ /* …inicial…*/ });
  const [catSelected, setCatSelected] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const auth = getAuth(app);

  // — 1) Carga de carrera —
  useEffect(() => {
    if (!carreraId) return;
    getDoc(doc(db, "carreras", carreraId as string)).then(dc => {
      if (dc.exists()) {
        const d = dc.data()!;
        setCarrera({
          id: dc.id,
          titulo: d.titulo,
          categorias: d.categorias || [],
        });
      } else {
        setMsg("Carrera no encontrada");
      }
    });
  }, [carreraId]);

  // — 2) Auth + carga perfiles —
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) return router.replace("/login");
      loadPerfiles(user.uid);
    });
    return unsub;
  }, []);

  async function loadPerfiles(uid: string) {
    const list: Perfil[] = [];
    // perfil principal
    const udoc = await getDoc(doc(db, "usuarios", uid));
    if (udoc.exists()) {
      const d: any = udoc.data();
      list.push({
        id: uid,
        nombre: d.nombre,
        apellidoPaterno: d.apPaterno,
        apellidoMaterno: d.apMaterno,
        edad: d.edad,
      });
    }
    // secundarios
    const snap = await getDocs(collection(db, "usuarios", uid, "perfiles"));
    snap.docs.forEach(d => {
      const p: any = d.data();
      list.push({
        id: d.id,
        nombre: p.nombre,
        apellidoPaterno: p.apellidoPaterno,
        apellidoMaterno: p.apellidoMaterno,
        edad: p.edad,
      });
    });
    setPerfiles(list);
    if (!perfilSelected && list.length) {
      setPerfilSelected(list[0].id);
    }
  }

  // — 3) auto-scroll al form nuevos perfiles —
  useEffect(() => {
    if (showForm && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showForm]);

  // — 4) Inscripción —
  const handleInscribir = async () => {
    if (!perfilSelected || !catSelected || !carrera) {
      setMsg("Selecciona perfil y categoría");
      return;
    }
    setSubmitting(true);
    setMsg("");
    try {
      // evitar duplicados en raíz
      const dupQ = query(
        collection(db, "inscripciones"),
        where("carreraId", "==", carrera.id),
        where("perfilId", "==", perfilSelected)
      );
      const dup = await getDocs(dupQ);
      if (!dup.empty) {
        setMsg("Ya estás inscrito en esta carrera.");
      } else {
        await addDoc(collection(db, "inscripciones"), {
          carreraId: carrera.id,
          perfilId: perfilSelected,
          categoria: catSelected,
          timestamp: serverTimestamp(),
        });
        setMsg("¡Inscripción exitosa!");
      }
    } catch (e: any) {
      setMsg("Error al inscribir: " + e.message);
    }
    setSubmitting(false);
  };

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">{carrera?.titulo}</h1>

        {/* PERFIL */}
        <div>
          <label className="block font-medium">Perfil</label>
          <select
            className="mt-1 w-full border p-2 rounded"
            value={perfilSelected}
            onChange={e => setPerfilSelected(e.target.value)}
          >
            {perfiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellidoPaterno} ({p.edad} años)
              </option>
            ))}
          </select>
          <button
            className="mt-2 text-blue-600 hover:underline"
            onClick={() => setShowForm(v => !v)}
          >
            {showForm ? "Cancelar" : "+ Crear nuevo perfil"}
          </button>
        </div>

        {/* NUEVO PERFIL */}
        {showForm && (
          <div ref={scrollRef} className="border-t pt-4">
            {/* … aquí tu formulario de creación de perfil … */}
          </div>
        )}

        {/* CATEGORÍA e INSCRIBIR */}
        {perfilSelected && carrera && (
          <div>
            <label className="block font-medium">Categoría</label>
            <select
              className="mt-1 w-full border p-2 rounded"
              value={catSelected}
              onChange={e => setCatSelected(e.target.value)}
            >
              <option value="">-- elige --</option>
              {carrera.categorias
                .filter(cat => {
                  const p = perfiles.find(x => x.id === perfilSelected)!;
                  return p.edad >= cat.minAge && p.edad <= cat.maxAge;
                })
                .map(cat => (
                  <option key={cat.nombre} value={cat.nombre}>
                    {cat.nombre} ({cat.minAge}–{cat.maxAge})
                  </option>
                ))}
            </select>
            <button
              onClick={handleInscribir}
              disabled={submitting}
              className={`mt-4 w-full py-2 rounded text-white ${
                submitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {submitting ? "Enviando…" : "Inscribirme"}
            </button>
          </div>
        )}

        {msg && (
          <p className="mt-4 text-center text-red-600">{msg}</p>
        )}
      </div>
    </AuthGuard>
  );
}