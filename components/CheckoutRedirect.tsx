import { loadStripe } from "@stripe/stripe-js";
import { useEffect } from "react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Props = {
  userId: string;
  carreraId: string;
};

export default function CheckoutRedirect({ userId, carreraId }: Props) {
  useEffect(() => {
    const redirectToCheckout = async () => {
      const stripe = await stripePromise;
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, carreraId }),
      });
      const session = await res.json();
      await stripe?.redirectToCheckout({ sessionId: session.id });
    };
    redirectToCheckout();
  }, [userId, carreraId]);

  return <p>Redirigiendo al pago...</p>;
}
