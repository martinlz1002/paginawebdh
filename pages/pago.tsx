import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/router";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Pago() {
  const router = useRouter();
  const ran = useRef(false);
  const [msg, setMsg] = useState("Preparando pago...");

  useEffect(() => {
    if (!router.isReady) return;
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      const { carreraId, perfilId, categoria, price } = router.query;

      // Validación mínima (directo y sin romanticismo)
      if (
        typeof carreraId !== "string" ||
        typeof perfilId !== "string" ||
        typeof categoria !== "string" ||
        (typeof price !== "string" && typeof price !== "number")
      ) {
        setMsg("Faltan datos para el pago. Regresando…");
        setTimeout(() => router.replace("/"), 900);
        return;
      }

      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        setMsg("Precio inválido. Regresando…");
        setTimeout(() => router.replace(`/inscribirse?carreraId=${carreraId}`), 900);
        return;
      }

      try {
        setMsg("Redirigiendo a Stripe...");

        const res = await fetch("/api/checkout_sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ carreraId, perfilId, categoria, price: priceNum }),
        });

        const data = await res.json();

        // Tu API ya devuelve url y sessionId
        if (data?.url) {
          window.location.href = data.url;
          return;
        }

        if (data?.sessionId) {
          const stripe = await stripePromise;
          await stripe?.redirectToCheckout({ sessionId: data.sessionId });
          return;
        }

        throw new Error(data?.error || "Respuesta inválida desde el servidor.");
      } catch (e: any) {
        console.error(e);
        setMsg("Error iniciando pago. Regresando…");
        setTimeout(() => router.replace(`/inscribirse?carreraId=${router.query.carreraId ?? ""}`), 1200);
      }
    };

    run();
  }, [router.isReady, router.query, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-xl text-gray-700">{msg}</p>
    </div>
  );
}