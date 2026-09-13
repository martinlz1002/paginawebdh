import Stripe from "stripe";
import { stripe } from "./stripe";

/**
 * Crea una cuenta Stripe Connect Express
 * para un organizador.
 */
export async function createOrganizerAccount({
  email,
  country = "MX",
  businessType = "individual",
}: {
  email: string;
  country?: string;
  businessType?: Stripe.AccountCreateParams.BusinessType;
}) {
  return stripe.accounts.create({
    type: "express",
    country,
    email,
    business_type: businessType,

    capabilities: {
      card_payments: {
        requested: true,
      },
      transfers: {
        requested: true,
      },
    },
  });
}

/**
 * Genera el enlace de onboarding de Stripe.
 *
 * El enlace es temporal y debe generarse
 * cada vez que el organizador necesite entrar
 * al proceso de configuración.
 */
export async function createOrganizerOnboardingLink({
  accountId,
  refreshUrl,
  returnUrl,
}: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return stripe.accountLinks.create({
    account: accountId,

    refresh_url: refreshUrl,
    return_url: returnUrl,

    type: "account_onboarding",
  });
}

/**
 * Consulta directamente el estado de la cuenta
 * conectada en Stripe.
 */
export async function getOrganizerAccount(
  accountId: string
) {
  return stripe.accounts.retrieve(accountId);
}