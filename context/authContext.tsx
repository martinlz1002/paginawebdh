import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { registrarUsuario, Usuario } from "@/lib/usuarios";

interface AuthContextProps {
  user: User | null;
  loading: boolean;
}

type AuthProviderProps = { children: React.ReactNode };

const AuthContext = createContext<AuthContextProps>({ user: null, loading: true });

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Forzar refresco del token para obtener emailVerified actualizado
        await firebaseUser.getIdToken(true);

        // Si ya verificó el email y hay datos pendientes, los guardamos en Firestore
        if (firebaseUser.emailVerified) {
          const pending = typeof window !== "undefined"
            ? localStorage.getItem("pendingUser")
            : null;
          if (pending) {
            try {
              const uData = JSON.parse(pending) as Usuario;
              await registrarUsuario(uData);
              localStorage.removeItem("pendingUser");
            } catch (e) {
              console.error("Error registrando usuario pendiente:", e);
            }
          }
        }
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);