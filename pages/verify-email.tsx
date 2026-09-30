import React, { useEffect, useState } from "react";
import {
  getAuth,
  onAuthStateChanged,
  User,
  sendEmailVerification,
} from "firebase/auth";
import { useRouter } from "next/router";
import { registrarUsuario } from "@/lib/usuarios";
import { app } from "@/lib/firebase";

export default function VerifyEmailPage() {
  const router = useRouter();
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => unsub();
  }, [auth]);

  /**
   * Comprueba si el correo ya fue verificado
   * y registra el perfil si corresponde.
   */
  const verificarCorreo = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setMensaje(
        "No hay una sesión activa. Inicia sesión nuevamente para continuar."
      );
      return;
    }

    setLoading(true);
    setMensaje(null);

    try {
      // Recarga la información real desde Firebase
      await currentUser.reload();

      // Volvemos a obtener el usuario actualizado
      const updatedUser = auth.currentUser;

      if (!updatedUser) {
        setMensaje("No se pudo obtener la sesión actual.");
        return;
      }

      setUser(updatedUser);

      if (!updatedUser.emailVerified) {
        setMensaje(
          "Aún no está verificado. Revisa tu correo y haz clic en el enlace de verificación."
        );
        return;
      }

      // Recuperar los datos del registro
      const pending = localStorage.getItem("pendingUser");

      if (!pending) {
        setMensaje(
          "Tu correo ya está verificado, pero no se encontraron los datos del registro."
        );
        return;
      }

      let uData;

      try {
        uData = JSON.parse(pending);
      } catch {
        setMensaje("Los datos pendientes del registro están dañados.");
        return;
      }

      // Guardar perfil en Firestore
      await registrarUsuario(uData);

      // Ya no necesitamos los datos temporales
      localStorage.removeItem("pendingUser");

      // Ir al perfil
      router.push("/perfil");
    } catch (error: any) {
      console.error("Error verificando correo:", error);

      setMensaje(
        "Error verificando la cuenta: " +
          (error?.message || "Error desconocido")
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reenviar correo de verificación
   */
  const reenviarCorreo = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setMensaje("No hay una sesión activa.");
      return;
    }

    if (currentUser.emailVerified) {
      setMensaje("Tu correo ya está verificado.");
      return;
    }

    setReenviando(true);
    setMensaje(null);

    try {
      await sendEmailVerification(currentUser);

      setMensaje(
        "Correo de verificación enviado nuevamente. Revisa tu bandeja de entrada o spam."
      );
    } catch (error: any) {
      console.error("Error reenviando correo:", error);

      setMensaje(
        "No se pudo reenviar el correo: " +
          (error?.message || "Error desconocido")
      );
    } finally {
      setReenviando(false);
    }
  };

  /**
   * Si no hay usuario, mostramos aviso
   */
  if (!user) {
    return (
      <div className="relative min-h-screen bg-[#0c0c0f] flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center shadow-[0_0_60px_rgba(0,0,0,0.4)]">
          <h1 className="text-2xl font-bold text-white mb-4">
            Sesión no encontrada
          </h1>

          <p className="text-white/60 mb-6">
            No encontramos una cuenta activa. Inicia sesión nuevamente.
          </p>

          <button
            onClick={() => router.push("/login")}
            className="w-full bg-dh-purple text-black font-bold py-3 rounded-2xl hover:scale-[1.02] transition"
          >
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0c0c0f] flex items-center justify-center px-6 overflow-hidden">

      {/* Fondo */}
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/20 via-black to-dh-purpleDark/20 blur-3xl opacity-40" />

      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.4)]">

          {/* Icono */}
          <div className="mx-auto mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-dh-purple/20 border border-dh-purple/30">
            <span className="text-3xl">
              {user.emailVerified ? "✓" : "✉"}
            </span>
          </div>

          <h1 className="text-3xl font-black text-white text-center">
            {user.emailVerified
              ? "Correo verificado"
              : "Confirma tu correo"}
          </h1>

          <p className="mt-4 text-center text-white/60 leading-relaxed">
            Hemos enviado un correo de verificación a:
          </p>

          <p className="mt-2 text-center text-white font-semibold break-all">
            {user.email}
          </p>

          {!user.emailVerified ? (
            <>
              <p className="mt-5 text-center text-white/60 leading-relaxed">
                Revisa tu bandeja de entrada y también la carpeta de spam.
                Después de hacer clic en el enlace, regresa aquí.
              </p>

              <button
                onClick={verificarCorreo}
                disabled={loading}
                className="w-full mt-7 bg-dh-purple text-black font-bold py-4 rounded-2xl hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,255,120,0.4)] transition disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading
                  ? "Comprobando..."
                  : "Ya confirmé mi correo"}
              </button>

              <button
                onClick={reenviarCorreo}
                disabled={reenviando}
                className="w-full mt-3 bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-2xl hover:bg-white/15 transition disabled:opacity-50"
              >
                {reenviando
                  ? "Enviando..."
                  : "Reenviar correo de verificación"}
              </button>
            </>
          ) : (
            <>
              <p className="mt-5 text-center text-green-400 font-semibold">
                ✓ Tu correo ya fue verificado correctamente.
              </p>

              <button
                onClick={verificarCorreo}
                disabled={loading}
                className="w-full mt-7 bg-dh-purple text-black font-bold py-4 rounded-2xl hover:scale-[1.02] transition disabled:opacity-50"
              >
                {loading ? "Guardando..." : "Continuar"}
              </button>
            </>
          )}

          {mensaje && (
            <div
              className={`mt-5 p-4 rounded-2xl text-center text-sm ${
                mensaje.includes("enviado")
                  ? "bg-green-500/10 border border-green-500/20 text-green-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}
            >
              {mensaje}
            </div>
          )}

          <button
            onClick={() => router.push("/login")}
            className="w-full mt-6 text-white/50 hover:text-white text-sm transition"
          >
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}