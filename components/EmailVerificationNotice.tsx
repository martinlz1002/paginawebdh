
import React, { useEffect, useRef, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/authContext";

export default function EmailVerificationNotice() {
  const { user, loading, refreshUser } = useAuth();

  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");

  const refreshing = useRef(false);

  // Comprobar si el usuario verificó su correo al regresar a DHTime
  useEffect(() => {
    if (!user || !user.email || user.emailVerified) return;

    const checkVerification = async () => {
      if (refreshing.current) return;

      refreshing.current = true;

      try {
        await refreshUser();
      } catch (error) {
        console.error("Error verificando correo:", error);
      } finally {
        refreshing.current = false;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkVerification();
      }
    };

    window.addEventListener("focus", checkVerification);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", checkVerification);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user?.uid, user?.emailVerified, refreshUser]);

  // No mostrar si no hay sesión, correo o si ya está verificado
  if (loading || !user || !user.email || user.emailVerified) {
    return null;
  }

  const handleResend = async () => {
    if (sending || !user) return;

    setSending(true);
    setMessage("");

    try {
      await sendEmailVerification(user);

      setMessageType("success");
      setMessage(
        "¡Correo enviado! Revisa tu bandeja de entrada y también la carpeta de spam."
      );
    } catch (error: any) {
      console.error("Error reenviando verificación:", error);

      setMessageType("error");

      switch (error.code) {
        case "auth/too-many-requests":
          setMessage("Has solicitado demasiados correos. Espera un momento antes de intentarlo nuevamente.");
          break;

        case "auth/network-request-failed":
          setMessage("No se pudo conectar con Firebase. Revisa tu conexión a internet.");
          break;

        case "auth/requires-recent-login":
          setMessage("Tu sesión necesita actualizarse. Cierra sesión e inicia nuevamente.");
          break;

        case "auth/operation-not-allowed":
          setMessage("El envío de correos de verificación no está habilitado en Firebase Authentication.");
          break;

        default:
          setMessage(
            `No se pudo enviar el correo: ${error.message || "Error desconocido"}`
          );
      }
    } finally {
      setSending(false);
    }
  };

  const handleCheck = async () => {
    if (checking) return;

    setChecking(true);
    setMessage("");

    try {
      const updatedUser = await refreshUser();

      if (updatedUser?.emailVerified) {
        setMessageType("success");
        setMessage("¡Tu correo ya está verificado!");
      } else {
        setMessageType("info");
        setMessage(
          "Todavía no aparece como verificado. Abre el enlace del correo y vuelve a comprobarlo."
        );
      }
    } catch (error: any) {
      console.error("Error comprobando verificación:", error);

      setMessageType("error");
      setMessage("No se pudo comprobar la verificación. Intenta nuevamente.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0, y: -8 }}
        animate={{ opacity: 1, height: "auto", y: 0 }}
        exit={{ opacity: 0, height: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="relative z-20 w-full overflow-hidden border-b border-amber-400/20 bg-[#211b0e] text-white"
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">

            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
                <span className="text-xl">✉️</span>
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-bold text-amber-200">
                  Verifica tu correo electrónico
                </h3>

                <p className="text-sm text-amber-100/80 mt-1">
                  Tu dirección{" "}
                  <strong className="break-all text-white">
                    {user.email}
                  </strong>{" "}
                  todavía no está verificada. Confírmala para completar la
                  verificación de tu cuenta DHTime.
                </p>

                <AnimatePresence mode="wait">
                  {message && (
                    <motion.p
                      key={message}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      role="status"
                      aria-live="polite"
                      className={`text-xs mt-2 ${
                        messageType === "success"
                          ? "text-green-400"
                          : messageType === "error"
                          ? "text-red-400"
                          : "text-amber-200"
                      }`}
                    >
                      {message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">

              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-dh-purple text-white text-sm font-bold hover:bg-dh-purple/80 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <span>✉️</span>
                    Reenviar correo
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCheck}
                disabled={checking}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-amber-300/30 text-amber-100 text-sm font-semibold hover:bg-amber-300/10 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {checking ? (
                  <>
                    <span className="w-4 h-4 border-2 border-amber-200/30 border-t-amber-200 rounded-full animate-spin" />
                    Comprobando...
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    Ya verifiqué mi correo
                  </>
                )}
              </button>

            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
