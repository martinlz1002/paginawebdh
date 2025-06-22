import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { carreraId, perfilId, categoria, precio } = req.body as {
      carreraId: string
      perfilId: string
      categoria: string
      precio: number
    }

    // URL base para volver tras el pago
    const origin = req.headers.origin || ''

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: `Inscripción Carrera ${carreraId}`,
              description: `Perfil ${perfilId} – Categoría ${categoria}`,
            },
            unit_amount: Math.round(precio * 100), // pesos → centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // URLs a donde vuelve el cliente
      success_url: `${origin}/inscribirse?carreraId=${carreraId}&success=true`,
      cancel_url: `${origin}/inscribirse?carreraId=${carreraId}&canceled=true`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe error:', err)
    return res.status(500).json({ error: err.message })
  }
}