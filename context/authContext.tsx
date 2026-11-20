
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import {
  onAuthStateChanged,
  User,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

import {
  registrarUsuario,
  Usuario,
} from "@/lib/usuarios";

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  authVersion: number;
  refreshUser: () => Promise<User | null>;
}

type AuthProviderProps = {
  children: React.ReactNode;
};

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  authVersion: 0,
  refreshUser: async () => null,
});

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authVersion, setAuthVersion] = useState(0);

  // Registrar los datos pendientes cuando el correo ya esté verificado
  const registrarUsuarioPendiente = useCallback(async () => {
    if (typeof window === "undefined") return;

    const pending = localStorage.getItem("pendingUser");

    if (!pending) return;

    try {
      const uData = JSON.parse(pending) as Usuario;

      await registrarUsuario(uData);

      localStorage.removeItem("pendingUser");

      console.log("Usuario registrado correctamente en Firestore");
    } catch (error) {
      console.error(
        "Error registrando usuario pendiente:",
        error
      );
    }
  }, []);

  // Actualizar manualmente el usuario de Firebase
  const refreshUser = useCallback(async (): Promise<User | null> => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setUser(null);
      setAuthVersion((v) => v + 1);
      return null;
    }

    await currentUser.reload();

    const updatedUser = auth.currentUser;

    if (updatedUser) {
      await updatedUser.getIdToken(true);

      // Si ya verificó el correo, registrar sus datos en Firestore
      if (updatedUser.emailVerified) {
        await registrarUsuarioPendiente();
      }

      setUser(updatedUser);
      setAuthVersion((v) => v + 1);
    }

    return updatedUser;
  }, [registrarUsuarioPendiente]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          if (firebaseUser) {
            await firebaseUser.getIdToken(true);

            if (firebaseUser.emailVerified) {
              await registrarUsuarioPendiente();
            }
          }

          setUser(firebaseUser);
          setAuthVersion((v) => v + 1);

        } catch (error) {
          console.error(
            "Error actualizando autenticación:",
            error
          );

          setUser(firebaseUser);
          setAuthVersion((v) => v + 1);

        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [registrarUsuarioPendiente]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authVersion,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
