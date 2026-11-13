import { auth, db } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export type MesaRange = {
  id: string;
  nombre: string;
  desde: number;
  hasta: number;
  totalCompetidores?: number;
};

let anonymousSignIn: Promise<void> | null = null;

/**
 * Las estaciones se abren mediante enlace. Si el navegador no tiene una
 * sesión Firebase, se crea una sesión anónima transparente para aplicar
 * las reglas de Firestore. No reemplaza una sesión existente.
 */
export async function ensureEntregaAuth(): Promise<void> {
  if (typeof window === "undefined" || auth.currentUser) return;
  if (!anonymousSignIn) {
    anonymousSignIn = signInAnonymously(auth)
      .then(() => undefined)
      .finally(() => {
        anonymousSignIn = null;
      });
  }
  await anonymousSignIn;
}

export function normalizeBib(value: unknown): number {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return NaN;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : NaN;
}

export function validateMesaRanges(ranges: MesaRange[]): string | null {
  if (!ranges.length) return "Agrega al menos una mesa.";
  const ids = new Set<string>();
  const names = new Set<string>();
  const sorted = [...ranges].sort((a, b) => a.desde - b.desde);

  for (const range of sorted) {
    if (!range.id.trim() || !range.nombre.trim()) return "Todas las mesas necesitan identificador y nombre.";
    if (ids.has(range.id)) return "Los identificadores de mesa deben ser únicos.";
    if (names.has(range.nombre.trim().toLowerCase())) return "No repitas nombres de mesa.";
    if (!Number.isSafeInteger(range.desde) || !Number.isSafeInteger(range.hasta) || range.desde < 1 || range.hasta < range.desde) {
      return `El rango de ${range.nombre} no es válido.`;
    }
    ids.add(range.id);
    names.add(range.nombre.trim().toLowerCase());
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].desde <= sorted[i - 1].hasta) {
      return `Los rangos de ${sorted[i - 1].nombre} y ${sorted[i].nombre} se enciman.`;
    }
  }
  return null;
}

export function getMesaForBib(ranges: MesaRange[], bib: number): MesaRange | undefined {
  return ranges.find((range) => bib >= range.desde && bib <= range.hasta);
}

export async function hashEntregaPin(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createEntregaSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyEntregaPin(pin: string, config?: Record<string, any> | null): Promise<boolean> {
  if (!/^\d{4,8}$/.test(pin) || !config?.pinSalt || !config?.pinHash) return false;
  const candidate = await hashEntregaPin(pin, String(config.pinSalt));
  return candidate === String(config.pinHash);
}

export async function loadEntregaConfig(): Promise<Record<string, any> | null> {
  const snapshot = await getDoc(doc(db, "configuracionEntrega", "active"));
  return snapshot.exists() ? snapshot.data() : null;
}
