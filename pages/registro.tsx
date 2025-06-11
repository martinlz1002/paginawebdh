import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/router";

export default function Registro() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    fechaNacimiento: "",
    email: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
    password: ""
  });

  const calcularEdad = (fecha: string) => {
    const nacimiento = new Date(fecha);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { email, password, fechaNacimiento, ...resto } = form;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const edad = calcularEdad(fechaNacimiento);
      await setDoc(doc(db, "usuarios", userCredential.user.uid), {
        ...resto,
        email,
        fechaNacimiento,
        edad,
        pago: false
      });
      router.push("/perfil");
    } catch (error) {
      console.error("Error al registrar:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <form onSubmit={handleSubmit} className="bg-purple-50 p-8 rounded-xl shadow-md max-w-lg w-full space-y-4">
        <h1 className="text-2xl font-bold text-softPurple mb-4 text-center">Registro de Usuario</h1>
        {["nombre", "apellidoPaterno", "apellidoMaterno", "fechaNacimiento", "email", "celular", "pais", "estado", "ciudad", "club", "password"].map((campo) => (
          <input
            key={campo}
            type={campo === "fechaNacimiento" ? "date" : campo === "email" ? "email" : campo === "password" ? "password" : "text"}
            name={campo}
            placeholder={campo.charAt(0).toUpperCase() + campo.slice(1)}
            value={form[campo as keyof typeof form]}
            onChange={handleChange}
            required={campo !== "club"}
            className="w-full p-2 border rounded"
          />
        ))}
        <button className="bg-softGreen text-white py-2 px-4 rounded w-full hover:bg-green-600 transition">Registrarse</button>
      </form>
    </div>
  );
}
