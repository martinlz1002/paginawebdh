import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

const COL = 'testimonios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const q = query(
        collection(db, COL),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as any),
      }));
      return res.status(200).json(items);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Error al leer testimonios.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { author, text, avatarUrl } = req.body;
      if (!author || !text) {
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
      }
      const docRef = await addDoc(collection(db, COL), {
        author,
        text,
        avatarUrl: avatarUrl || null,
        timestamp: serverTimestamp(),
      });
      return res.status(201).json({ id: docRef.id });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Error al crear testimonio.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}