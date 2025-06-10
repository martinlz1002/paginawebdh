import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// Config de Firebase
const firebaseConfig = {
  // tus credenciales aquí
};

const app = initializeApp(firebaseConfig);

let analytics;

if (typeof window !== "undefined") {
  // Solo en navegador, chequeamos si es soportado Analytics
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, analytics };