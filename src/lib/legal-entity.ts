/**
 * Who operates goo-fashion.com: the sole trader's details, as the legal pages
 * and /contacts print them (CEO, 2026-10-14). One place to change them —
 * every page reads them from here, in both languages.
 */

export const OPERATOR_EMAIL = "anything@goo-fashion.com";

/** РНОКПП — the registration number of the taxpayer's account card. */
export const OPERATOR_TAX_ID = "3845301017";

export const OPERATOR_IBAN = "UA793220010000026008350074987";

interface OperatorDetails {
  name: string;
  /** City only: the street address stays off the site (CEO, 2026-10-14). */
  city: string;
  /** The line that says the full registered address is given on request. */
  addressNote: string;
  /** "Tax ID (RNOKPP): …" — the label and the number, for running text. */
  taxId: string;
  bank: string;
}

export const OPERATOR: Record<"en" | "uk", OperatorDetails> = {
  en: {
    name: "David Arakhamia, Sole Trader",
    city: "Mykolaiv, Ukraine",
    addressNote: "Registered address available on request.",
    taxId: `Tax ID (RNOKPP): ${OPERATOR_TAX_ID}`,
    bank: "JSC UNIVERSAL BANK, bank code (MFO) 322001",
  },
  uk: {
    name: "ФОП Арахамія Давід Давидович",
    city: "м. Миколаїв, Україна",
    addressNote: "Адреса реєстрації — на запит.",
    taxId: `РНОКПП: ${OPERATOR_TAX_ID}`,
    bank: "АТ «УНІВЕРСАЛ БАНК», МФО 322001",
  },
};
