import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { session_id } = req.query;
  if (typeof session_id !== 'string') return res.status(400).end('session_id missing');

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    res.status(200).json({
      payment_status: session.payment_status,
      payment_intent: session.payment_intent,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}