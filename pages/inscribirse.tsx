import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { app, db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { registrarInscripcion } from "@/lib/Inscripciones";
import {
  ClipboardIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
}
interface Distancia {
  distancia: string;
  categorias: Categoria[];
}
type AgeBasis = "endOfYear" | "eventDate";
interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  lugar?: string;
  fecha?: string;
  horaSalida?: string;
  bannerUrl?: string;
  distancias: Distancia[];
  ageBasis: AgeBasis;
}
interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  birthDate: Date;
}

function computeAge(birthDate: Date, basisDate: Date): number {
  let age = basisDate.getFullYear() - birthDate.getFullYear();
  const m = basisDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && basisDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const STRIPE_RATE = 0.041;
const FIXED_FEE = 3;
const IVA_RATE = 0.16;

function computeGross(desiredNet: number): number {
  const ivaMult = 1 + IVA_RATE;
  const raw = (desiredNet + FIXED_FEE * ivaMult) / (1 - STRIPE_RATE * ivaMult);
  let gross = Math.ceil(raw * 100) / 100;
  for (let i = 0; i < 500; i++) {
    const commission = parseFloat((gross * STRIPE_RATE + FIXED_FEE).toFixed(2));
    const iva = parseFloat((commission * IVA_RATE).toFixed(2));
    const netSim = gross - commission - iva;
    if (netSim >= desiredNet) break;
    gross = parseFloat((gross + 0.01).toFixed(2));
  }
  return gross;
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [competitorNumber, setCompetitorNumber] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [loadingPerfiles, setLoadingPerfiles] = useState(true);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const auth = getAuth(app);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const snap = await getDoc(doc(db, "carreras", carreraId as string));
      if (!snap.exists()) {
        setMensaje("Carrera no encontrada");
        return;
      }
      const d: any = snap.data();
      setCarrera({
        id: snap.id,
        titulo: d.titulo,
        descripcion: d.descripcion,
        lugar: d.lugar || d.ubicacion,
        fecha:
          d.fecha instanceof Timestamp
            ? d.fecha.toDate().toISOString().split("T")[0]
            : d.fecha,
        horaSalida: d.horaSalida,
        bannerUrl: d.bannerUrl,
        distancias: d.distancias || [],
        ageBasis: d.ageBasis || "endOfYear",
      });
    })();
  }, [carreraId]);

  const tablaCategorias = carrera?.distancias.flatMap((d) =>
    d.categorias.map((cat) => (
      <tr key={`${d.distancia}-${cat.nombre}`} className="hover:bg-gray-50">
        <td className="border px-4 py-2">{d.distancia}</td>
        <td className="border px-4 py-2">{cat.nombre}</td>
        <td className="border px-4 py-2">{cat.minAge}</td>
        <td className="border px-4 py-2">{cat.maxAge}</td>
        <td className="border px-4 py-2">${cat.price.toFixed(2)}</td>
      </tr>
    ))
  );

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow overflow-hidden">
      {carrera?.bannerUrl && (
        <div
          className="h-56 bg-cover bg-center"
          style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
        />
      )}
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">{carrera?.titulo}</h1>
        {carrera?.descripcion && <p className="text-gray-700">{carrera.descripcion}</p>}
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center space-x-2">
            <ClipboardIcon className="w-6 h-6 text-green-700" />
            <span>Categorías y precios</span>
          </h2>
          <table className="w-full table-auto border text-gray-700">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-4 py-2">Distancia</th>
                <th className="border px-4 py-2">Categoría</th>
                <th className="border px-4 py-2">Edad mínima</th>
                <th className="border px-4 py-2">Edad máxima</th>
                <th className="border px-4 py-2">Precio (MXN)</th>
              </tr>
            </thead>
            <tbody>{tablaCategorias}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}