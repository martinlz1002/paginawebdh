
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/authContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/router";

export default function AgeCorrectionNotice() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [needsCorrection, setNeedsCorrection] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkBirthDate = async () => {
      if (loading) return;

      if (!user) {
        setNeedsCorrection(false);
        setChecking(false);
        return;
      }

      setChecking(true);

      try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          if (!cancelled) setNeedsCorrection(false);
          return;
        }

        const data = userSnap.data();
        const fechaNacimiento = data.fechaNacimiento;

        if (!fechaNacimiento || typeof fechaNacimiento !== "string") {
          if (!cancelled) setNeedsCorrection(false);
          return;
        }

        const nacimiento = new Date(
          fechaNacimiento + "T00:00:00"
        );

        if (isNaN(nacimiento.getTime())) {
          if (!cancelled) setNeedsCorrection(false);
          return;
        }

        const hoy = new Date();

        let edad =
          hoy.getFullYear() - nacimiento.getFullYear();

        const diferenciaMes =
          hoy.getMonth() - nacimiento.getMonth();

        if (
          diferenciaMes < 0 ||
          (diferenciaMes === 0 &&
            hoy.getDate() < nacimiento.getDate())
        ) {
          edad--;
        }

        // Detectar perfiles con menos de 2 años
        if (!cancelled) {
          setNeedsCorrection(edad < 2);
        }
      } catch (error) {
        console.error(
          "Error comprobando fecha de nacimiento:",
          error
        );

        if (!cancelled) setNeedsCorrection(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    checkBirthDate();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, loading]);

  if (
    loading ||
    checking ||
    !user ||
    !needsCorrection
  ) {
    return null;
  }

  const handleUpdate = () => {
    router.push("/perfil");
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
                <span className="text-xl">🎂</span>
              </div>

              <div className="min-w-0">

                <h3 className="text-sm font-bold text-amber-200">
                  Corrige tu fecha de nacimiento
                </h3>

                <p className="text-sm text-amber-100/80 mt-1">
                  Detectamos que tu fecha de nacimiento
                  registrada en DHTime podría ser incorrecta.
                  Si al crear tu cuenta colocaste la fecha
                  actual por error, actualízala para poder
                  inscribirte a nuestras carreras.
                </p>

                <p className="text-xs text-amber-200/70 mt-2">
                  Es importante registrar tu fecha de
                  nacimiento correcta.
                </p>

              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">

              <button
                type="button"
                onClick={handleUpdate}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-400 text-black text-sm font-bold hover:bg-amber-300 transition-all duration-200"
              >
                <span>✏️</span>
                Actualizar mis datos
              </button>

            </div>

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
