import React, { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/router";
import { registrarUsuario } from "@/lib/usuarios";

export default function VerifyEmailPage() {
  const [user, setUser] = useState<User | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const router = useRouter();
  const auth = getAuth();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  const handleConfirmed = async () => {
    if (!user) return;
    await user.reload();

    if (!user.emailVerified) {
      setMensaje("Aún no está verificado. Revisa tu correo.");
      return;
    }

    // Recupera datos guardados antes
    const pending = localStorage.getItem("pendingUser");
    if (!pending) {
      setMensaje("No se encontraron datos de registro.");
      return;
    }

    const uData = JSON.parse(pending);
    try {
      await registrarUsuario(uData);
      localStorage.removeItem("pendingUser");
      router.push("/perfil");
    } catch (e: any) {
      setMensaje("Error guardando perfil: " + e.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded shadow-lg text-center">
      <h1 className="text-xl font-semibold mb-4">Confirma tu correo</h1>
      <p>
        Te hemos enviado un email de verificación. Por favor revísalo y haz clic
        en el enlace.
      </p>
      <button
        onClick={handleConfirmed}
        className="mt-6 px-4 py-2 bg-green-600 text-white rounded"
      >
        Ya confirmé mi correo
      </button>
      {mensaje && <p className="mt-4 text-red-600">{mensaje}</p>}
    </div>
  );
}