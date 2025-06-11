import { useState } from "react";
import { useRouter } from "next/router";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    email: "",
    password: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
    fechaNacimiento: "",
  });
  const [mensaje, setMensaje] = useState("");
  const [exito, setExito] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const calcularEdad = (fechaNacimiento: string): number => {
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje("");
    setExito(false);

    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      password,
      celular,
      pais,
      estado,
      ciudad,
      fechaNacimiento,
    } = formData;

    if (
      !nombre ||
      !apellidoPaterno ||
      !apellidoMaterno ||
      !email ||
      !password ||
      !celular ||
      !pais ||
      !estado ||
      !ciudad ||
      !fechaNacimiento
    ) {
      setMensaje("Por favor, completa todos los campos obligatorios.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMensaje("El correo electrónico no es válido.");
      return;
    }

    if (password.length < 6) {
      setMensaje("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const edad = calcularEdad(fechaNacimiento);

      await setDoc(doc(db, "usuarios", user.uid), {
        ...formData,
        uid: user.uid,
        edad,
      });

      await sendEmailVerification(user);

      setExito(true);
      setMensaje("¡Registro exitoso! Te hemos enviado un correo de verificación.");

      setTimeout(() => {
        router.push("/perfil");
      }, 3000); // Redirige después de 3 segundos

    } catch (error: any) {
      setMensaje("Error: " + error.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 border rounded-2xl shadow">
      <h1 className="text-2xl font-bold mb-4">Registro de Usuario</h1>
      <form onSubmit={handleSignup} className="grid grid-cols-1 gap-4">
        {[
          { name: "nombre", label: "Nombre" },
          { name: "apellidoPaterno", label: "Apellido paterno" },
          { name: "apellidoMaterno", label: "Apellido materno" },
          { name: "email", label: "Correo electrónico", type: "email" },
          { name: "password", label: "Contraseña", type: "password" },
          { name: "celular", label: "Celular" },
          { name: "pais", label: "País" },
          { name: "estado", label: "Estado" },
          { name: "ciudad", label: "Ciudad" },
          { name: "club", label: "Club (opcional)", required: false },
          { name: "fechaNacimiento", label: "Fecha de nacimiento", type: "date" },
        ].map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium">
              {field.label}
              <input
                type={field.type || "text"}
                name={field.name}
                value={(formData as any)[field.name]}
                onChange={handleChange}
                className="w-full border p-2 rounded mt-1"
                required={field.required !== false}
              />
            </label>
          </div>
        ))}
        <button
          type="submit"
          className="bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          Registrarse
        </button>
      </form>

      {mensaje && (
        <p className={`mt-4 ${exito ? "text-green-600" : "text-red-600"}`}>
          {mensaje}
        </p>
      )}
    </div>
  );
}