import { loadStripe } from "@stripe/stripe-js";
import { useEffect } from "react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Props = {
  userId: string;
  carreraId: string;
};

export default function CheckoutRedirect({ userId, carreraId }: Props) {
  useEffect(() => {
    async function redirectToCheckout() {
      const stripe = await stripePromise;
      const res = await fetch("/api/checkout-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, carreraId }),
      });
      const { id: sessionId } = await res.json();
      if (stripe && sessionId) {
        await stripe.redirectToCheckout({ sessionId });
      }
    }

    redirectToCheckout();
  }, [userId, carreraId]);

  return <p>Redirigiendo al pago…</p>;
}