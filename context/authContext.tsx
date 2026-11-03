import React, {
  createContext,
  useContext,
  useEffect,
  useState,
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

  // Actualizar manualmente el usuario de Firebase
  const refreshUser = async (): Promise<User | null> => {
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

      setUser(updatedUser);
      setAuthVersion((v) => v + 1);
    }

    return updatedUser;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          if (firebaseUser) {
            await firebaseUser.getIdToken(true);

            if (firebaseUser.emailVerified) {
              const pending =
                typeof window !== "undefined"
                  ? localStorage.getItem("pendingUser")
                  : null;

              if (pending) {
                try {
                  const uData = JSON.parse(pending) as Usuario;

                  await registrarUsuario(uData);

                  localStorage.removeItem("pendingUser");
                } catch (error) {
                  console.error(
                    "Error registrando usuario pendiente:",
                    error
                  );
                }
              }
            }
          }

          setUser(firebaseUser);
          setAuthVersion((v) => v + 1);
        } catch (error) {
          console.error("Error actualizando autenticación:", error);
          setUser(firebaseUser);
          setAuthVersion((v) => v + 1);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

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