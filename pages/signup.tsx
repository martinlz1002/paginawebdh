import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/router";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { doc, setDoc, getFirestore } from "firebase/firestore";
import { app } from "@/lib/firebase";

const schema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const router = useRouter();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setMensaje("");

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      const user = userCredential.user;

      await setDoc(doc(db, "usuarios", user.uid), {
        nombre: data.nombre,
        email: data.email,
        uid: user.uid,
      });

      setMensaje("¡Bienvenido! Redirigiendo al perfil...");
      setTimeout(() => {
        router.push("/perfil");
      }, 1500);
    } catch (error: any) {
      console.error("Error al registrar usuario:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-2xl shadow">
      <h1 className="text-2xl font-bold mb-4">Registro</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block mb-1">Nombre completo</label>
          <input
            type="text"
            {...register("nombre")}
            className="w-full border p-2 rounded"
          />
          {errors.nombre && (
            <p className="text-red-500 text-sm">{errors.nombre.message}</p>
          )}
        </div>
        <div>
          <label className="block mb-1">Correo electrónico</label>
          <input
            type="email"
            {...register("email")}
            className="w-full border p-2 rounded"
          />
          {errors.email && (
            <p className="text-red-500 text-sm">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="block mb-1">Contraseña</label>
          <input
            type="password"
            {...register("password")}
            className="w-full border p-2 rounded"
          />
          {errors.password && (
            <p className="text-red-500 text-sm">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          {loading ? "Registrando..." : "Registrarse"}
        </button>

        {mensaje && <p className="text-green-600 text-center mt-2">{mensaje}</p>}
      </form>
    </div>
  );
}