import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, getDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/router";

type Props = {
  carreraId: string;
};

export default function InscripcionForm({ carreraId }: Props) {
  const [form, setForm] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    fechaNacimiento: "",
    edad: "",
    email: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
  });
  const [userId, setUserId] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setForm((prev) => ({
            ...prev,
            ...data,
            edad: calcularEdad(data.fechaNacimiento)
          }));
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const calcularEdad = (fecha: string) => {
    const hoy = new Date();
    const nacimiento = new Date(fecha);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad.toString();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "fechaNacimiento" ? { edad: calcularEdad(value) } : {})
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "inscripciones"), {
      ...form,
      carreraId,
      userId,
      pago: false,
      timestamp: new Date(),
    });
    router.push("/success");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {[
        { name: "nombre", label: "Nombre" },
        { name: "apellidoPaterno", label: "Apellido Paterno" },
        { name: "apellidoMaterno", label: "Apellido Materno" },
        { name: "fechaNacimiento", label: "Fecha de Nacimiento", type: "date" },
        { name: "edad", label: "Edad", disabled: true },
        { name: "email", label: "Correo Electrónico", type: "email" },
        { name: "celular", label: "Celular" },
        { name: "pais", label: "País" },
        { name: "estado", label: "Estado" },
        { name: "ciudad", label: "Ciudad" },
        { name: "club", label: "Club (opcional)", required: false },
      ].map(({ name, label, type = "text", disabled = false, required = true }) => (
        <div key={name}>
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <input
            type={type}
            name={name}
            value={(form as any)[name]}
            onChange={handleChange}
            disabled={disabled}
            required={required}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-softPurple focus:ring-softPurple sm:text-sm"
          />
        </div>
      ))}
      <button
        type="submit"
        className="w-full bg-softGreen text-white py-2 px-4 rounded hover:bg-green-600"
      >
        Continuar con el pago
      </button>
    </form>
  );
}
