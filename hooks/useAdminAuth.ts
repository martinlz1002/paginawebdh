import { useEffect } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export const useAdminAuth = () => {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      const data = userDoc.data();

      // ✅ tu campo real
      if (!data?.admin) {
        router.replace("/");
      }
    });

    return () => unsubscribe();
  }, [router]);
};