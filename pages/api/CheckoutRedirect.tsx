import { loadStripe } from "@stripe/stripe-js";
import { useEffect } from "react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Props = {
  carreraId: string;
  perfilId: string;
  categoria: string;
  price: number;
};

export default function CheckoutRedirect({ carreraId, perfilId, categoria, price }: Props) {
  useEffect(() => {
    const redirectToCheckout = async () => {
      const stripe = await stripePromise;

      const res = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carreraId, perfilId, categoria, price }),
      });

      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      if (data?.sessionId) {
        await stripe?.redirectToCheckout({ sessionId: data.sessionId });
        return;
      }

      throw new Error(data?.error || "Respuesta inválida");
    };

    redirectToCheckout().catch((err) => console.error(err));
  }, [carreraId, perfilId, categoria, price]);

  return <p>Redirigiendo al pago...</p>;
}