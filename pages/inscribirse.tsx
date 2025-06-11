import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const schema = z.object({
  nombre: z.string().min(1),
  apellidoPaterno: z.string().min(1),
  apellidoMaterno: z.string().min(1),
  email: z.string().email(),
  celular: z.string().min(10),
  fechaNacimiento: z.string(),
  club: z.string().optional(),
  carreraId: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function InscribirsePage() {
  const { register, handleSubmit, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const router = useRouter();
  const [carreras, setCarreras] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const ref = doc(db, "usuarios", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setValue("nombre", data.nombre);
          setValue("apellidoPaterno", data.apellidoPaterno);
          setValue("apellidoMaterno", data.apellidoMaterno);
          setValue("email", data.email);
          setValue("celular", data.celular);
          setValue("fechaNacimiento", data.fechaNacimiento);
          setValue("club", data.club || "");
        }
      }
    });

    const cargarCarreras = async () => {
  try {
    const snapshot = await getDocs(collection(db, "carreras"));
    const docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setCarreras(docs);
  } catch (error) {
    console.error("Error cargando carreras:", error);
  }
};

    cargarCarreras();
  }, [setValue]);

  const onSubmit = async (data: FormData) => {
    const stripe = await stripePromise;
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const session = await res.json();

    if (session.id && stripe) {
      await stripe.redirectToCheckout({ sessionId: session.id });
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Formulario de inscripción</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input {...register("nombre")} placeholder="Nombre" className="w-full p-2 border rounded" />
        <input {...register("apellidoPaterno")} placeholder="Apellido paterno" className="w-full p-2 border rounded" />
        <input {...register("apellidoMaterno")} placeholder="Apellido materno" className="w-full p-2 border rounded" />
        <input {...register("email")} placeholder="Email" className="w-full p-2 border rounded" />
        <input {...register("celular")} placeholder="Celular" className="w-full p-2 border rounded" />
        <input {...register("fechaNacimiento")} type="date" className="w-full p-2 border rounded" />
        <input {...register("club")} placeholder="Club (opcional)" className="w-full p-2 border rounded" />

        <select {...register("carreraId")} className="w-full p-2 border rounded">
          <option value="">Selecciona una carrera</option>
          {carreras.map((carrera) => (
            <option key={carrera.id} value={carrera.id}>
              {carrera.titulo}
            </option>
          ))}
        </select>

        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Proceder al pago
        </button>
      </form>
    </div>
  );
}
