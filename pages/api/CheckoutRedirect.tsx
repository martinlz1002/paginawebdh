import { useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Props = {
  carreraId: string;
  perfilId: string;
  categoria: string;
  distancia: string;
};

export default function CheckoutRedirect({ carreraId, perfilId, categoria, distancia }: Props) {
  useEffect(() => {
    const go = async () => {
      const stripe = await stripePromise;

      const res = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carreraId, perfilId, categoria, distancia }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      if (data?.sessionId) {
        await stripe?.redirectToCheckout({ sessionId: data.sessionId });
        return;
      }

      throw new Error("Respuesta inválida");
    };

    go().catch(console.error);
  }, [carreraId, perfilId, categoria, distancia]);

  return <p>Redirigiendo al pago...</p>;
}
