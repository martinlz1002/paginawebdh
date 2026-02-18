import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import { registrarInscripcion } from "@/lib/Inscripciones";
import type { Carrera as CarreraFull } from "@/types/carrera";

interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
}

interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  birthDate: Date;
  email: string;
  celular: string;
  ciudad: string;
  estado: string;
  pais: string;
  club: string;
  rama: string;
}

function safeDate(v: any): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  return new Date(v);
}

function computeAge(birth: Date, race: Date) {
  let age = race.getFullYear() - birth.getFullYear();
  const m = race.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && race.getDate() < birth.getDate())) age--;
  return age;
}

function fullName(n: string, p: string, m: string) {
  return `${n} ${p} ${m}`.trim();
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [carrera, setCarrera] = useState<CarreraFull | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilId, setPerfilId] = useState("");
  const [distancia, setDistancia] = useState("");
  const [categoria, setCategoria] = useState("");
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<Categoria[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const perfilSeleccionado = useMemo(
    () => perfiles.find((p) => p.id === perfilId) || null,
    [perfilId, perfiles]
  );

  const distancias = useMemo(
    () => (carrera?.distancias ?? []) as any[],
    [carrera]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const snap = await getDoc(doc(db, "carreras", carreraId as string));
      if (snap.exists()) {
        setCarrera({ id: snap.id, ...(snap.data() as any) } as CarreraFull);
      }
    })();
  }, [carreraId]);

 useEffect(() => {
  if (!user) return;

  (async () => {
    try {
      const lista: Perfil[] = [];

      // 🔹 PERFIL PRINCIPAL
      const mainSnap = await getDoc(doc(db, "usuarios", user.uid));
      if (mainSnap.exists()) {
        const d: any = mainSnap.data();

        lista.push({
          id: user.uid,
          nombre: d.nombre || "",
          apellidoPaterno: d.apPaterno || "",
          apellidoMaterno: d.apMaterno || "",
          birthDate: safeDate(d.fechaNacimiento ?? d.birthDate),
          email: d.email || user.email || "",
          celular: d.celular || "",
          ciudad: d.ciudad || "",
          estado: d.estado || "",
          pais: d.pais || "",
          club: d.club || "",
          rama: d.rama || "",
        });
      }

      // 🔹 SUBPERFILES
      const subSnap = await getDocs(
        collection(db, "usuarios", user.uid, "perfiles")
      );

      subSnap.forEach((docSnap) => {
        const p: any = docSnap.data();

        lista.push({
          id: docSnap.id,
          nombre: p.nombre || "",
          apellidoPaterno: p.apPaterno || "",
          apellidoMaterno: p.apMaterno || "",
          birthDate: safeDate(p.fechaNacimiento ?? p.birthDate),
          email: p.email || user.email || "",
          celular: p.celular || "",
          ciudad: p.ciudad || "",
          estado: p.estado || "",
          pais: p.pais || "",
          club: p.club || "",
          rama: p.rama || "",
        });
      });

      setPerfiles(lista);

      if (lista.length) {
        setPerfilId((prev) => prev || lista[0].id);
      }
    } catch (error) {
      console.error("Error cargando perfiles:", error);
    }
  })();
}, [user]);

  useEffect(() => {
    if (!perfilSeleccionado || !distancia || !carrera) return;

    const raceDate = new Date((carrera as any).fecha);
    const edad = computeAge(perfilSeleccionado.birthDate, raceDate);

    const dist = distancias.find((d: any) => d.distancia === distancia);
    if (!dist) return;

    const cats = (dist.categorias ?? []).filter(
      (c: any) => edad >= c.minAge && edad <= c.maxAge
    );

    setCategoriasPermitidas(cats);
  }, [perfilSeleccionado, distancia, carrera]);

  const handlePagar = async () => {
    if (!carrera || !perfilSeleccionado || !distancia || !categoria) {
      setMensaje("Completa todos los campos.");
      return;
    }

    setProcesando(true);

    try {
      const res = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carreraId: carrera.id, perfilId, categoria, distancia }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      window.location.href = data.url;
    } catch (err: any) {
      setMensaje(err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (!carrera) return null;

  return (
    <div className="min-h-screen bg-dh-bg">

      {/* BANNER */}
      {carrera.bannerUrl && (
        <div
          className="h-72 bg-cover bg-center"
          style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* INFO CARRERA */}
        <div className="card p-8 space-y-4">
          <h1 className="text-3xl font-extrabold text-dh-purple">
            {carrera.titulo}
          </h1>

          <p className="text-dh-muted">
            {new Date((carrera as any).fecha).toLocaleDateString("es-MX")}
          </p>

          {carrera.lugar && (
            <p className="text-dh-muted">{carrera.lugar}</p>
          )}

          {carrera.descripcion && (
            <p className="text-gray-600 pt-2">{carrera.descripcion}</p>
          )}
        </div>

        {/* PERFIL */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-dh-ink">1. Selecciona perfil</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            {perfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPerfilId(p.id);
                  setDistancia("");
                  setCategoria("");
                }}
                className={`p-5 rounded-2xl border transition ${
                  perfilId === p.id
                    ? "border-dh-purple bg-dh-purple/5"
                    : "border-dh-border hover:border-dh-purple/40"
                }`}
              >
                {p.nombre} {p.apellidoPaterno}
              </button>
            ))}
          </div>
        </div>

        {/* DISTANCIA */}
        {perfilId && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-dh-ink">
              2. Selecciona distancia
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              {distancias.map((d: any) => (
                <button
                  key={d.distancia}
                  onClick={() => {
                    setDistancia(d.distancia);
                    setCategoria("");
                  }}
                  className={`p-6 rounded-2xl border transition ${
                    distancia === d.distancia
                      ? "border-dh-green bg-dh-green/5"
                      : "border-dh-border hover:border-dh-green/40"
                  }`}
                >
                  {d.distancia}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CATEGORIA */}
        {distancia && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-dh-ink">
              3. Selecciona categoría
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {categoriasPermitidas.map((cat) => (
                <button
                  key={cat.nombre}
                  onClick={() => setCategoria(cat.nombre)}
                  className={`p-6 rounded-2xl border transition ${
                    categoria === cat.nombre
                      ? "border-dh-green bg-dh-green/5"
                      : "border-dh-border hover:border-dh-green/40"
                  }`}
                >
                  <div className="font-bold">{cat.nombre}</div>
                  <div className="text-sm text-dh-muted">
                    {cat.minAge}-{cat.maxAge} años
                  </div>
                  <div className="text-lg font-extrabold mt-2">
                    ${cat.price}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BOTON */}
        {categoria && (
          <div className="pt-6 animate-fade-in">
            <button
              onClick={handlePagar}
              disabled={procesando}
              className="w-full py-4 rounded-xl font-extrabold bg-dh-green text-dh-dark hover:opacity-95 transition"
            >
              {procesando ? "Procesando..." : "Inscribirme y Pagar"}
            </button>

            {mensaje && (
              <p className="text-red-600 text-sm mt-3 text-center">
                {mensaje}
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
