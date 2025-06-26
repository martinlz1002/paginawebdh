import { buffer } from 'micro';
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc
} from 'firebase/firestore';

export const config = {
  api: {
    bodyParser: false
  }
};

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Método ${req.method} No Permitido`);
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature']!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    const paymentStatus = session.payment_status;

    // Buscar la inscripción que tenga este sessionId
    const inscQ = query(
      collection(db, 'inscripciones'),
      where('sessionId', '==', sessionId)
    );
    const snap = await getDocs(inscQ);

    // Actualizar cada documento encontrado
    await Promise.all(
      snap.docs.map(d =>
        updateDoc(doc(db, 'inscripciones', d.id), { paymentStatus })
      )
    );

    console.log(
      `✅ Inscripciones actualizadas a "${paymentStatus}" para session ${sessionId}`
    );
  }

  res.status(200).json({ received: true });
}