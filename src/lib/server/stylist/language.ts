/**
 * The language a shopper writes to the AI stylist in, so it answers in the
 * same one.
 *
 * The stylist used to decide by alphabet: any Cyrillic was Russian, any "é"
 * Spanish (the Spanish test ran before the French one), Italian and Polish did
 * not exist. On the live site (2026-11-05) every one of 11 questions in
 * Ukrainian was answered in Russian, French in Spanish, Italian in French and
 * Polish in Spanish.
 *
 * Now each language is scored on what is particular to it — letters only it
 * uses, and the short everyday words a sentence cannot do without ("що", "je",
 * "ich", "szukam"). A message that says too little to tell ("ok", "а дешевле?")
 * is read together with the shopper's previous messages. Cyrillic that shows
 * neither Ukrainian nor Russian signs is left to the model to match, rather
 * than guessed.
 */

export interface ReplyLanguage {
  /** What the system prompt says to reply in. */
  prompt: string;
  /** ISO 639-1 code for the language, or null when it is left to the model. */
  code: string | null;
  /**
   * The language of the route's own messages (limits, fallback reply): the
   * detected one when there are messages in it, else Ukrainian for Cyrillic
   * that could not be told apart (the site's second language) and English.
   */
  ui: StylistUiLanguage;
}

interface LatinLanguage {
  code: string;
  name: string;
  /** Letters this language uses and English does not. */
  letters: RegExp;
  /** Short, frequent words. */
  words: readonly string[];
}

const LATIN: readonly LatinLanguage[] = [
  {
    code: "de", name: "German", letters: /[äöüß]/g,
    words: ["ich", "und", "nicht", "ein", "eine", "einen", "einer", "für", "mit", "bin", "ist", "was", "soll", "der",
      "die", "das", "zu", "bitte", "möchte", "suche", "kann", "habe", "mir", "mich", "auf", "bei", "nächste"],
  },
  {
    code: "fr", name: "French", letters: /[àâçèêëîïôûœ]/g,
    words: ["je", "suis", "une", "des", "pour", "avec", "et", "est", "le", "la", "les", "mon", "ma", "mes", "cherche",
      "voudrais", "quoi", "porter", "du", "au", "aux", "en", "pas", "qui", "très", "chaussures"],
  },
  {
    code: "es", name: "Spanish", letters: /[ñ¿¡]/g,
    words: ["soy", "para", "una", "que", "con", "el", "los", "las", "necesito", "quiero", "busco", "ropa", "algo",
      "pero", "del", "muy", "mi", "estoy", "fin", "semana", "máximo", "cómoda", "cómodo"],
  },
  {
    code: "it", name: "Italian", letters: /[ìòù]/g,
    words: ["per", "con", "che", "sono", "cerco", "vorrei", "qualcosa", "di", "il", "gli", "della", "delle", "dei",
      "colleghi", "ma", "più", "mi", "un'", "anche", "molto", "vestito", "stile"],
  },
  {
    code: "pt", name: "Portuguese", letters: /[ãõ]/g,
    words: ["para", "uma", "com", "não", "você", "eu", "estou", "procuro", "quero", "roupa", "muito", "do", "da"],
  },
  {
    code: "pl", name: "Polish", letters: /[ąćęłńśźż]/g,
    words: ["szukam", "jest", "nie", "dla", "się", "na", "do", "chcę", "potrzebuję", "budżet", "jestem", "mam",
      "lubię", "coś", "styl"],
  },
  {
    code: "nl", name: "Dutch", letters: /[ĳ]/g,
    words: ["ik", "een", "het", "voor", "met", "zoek", "niet", "wil", "graag", "kleding", "mijn", "naar", "wat"],
  },
  {
    // ä and ö are German letters too; the words decide between the two.
    code: "sv", name: "Swedish", letters: /[åäö]/g,
    words: ["jag", "och", "ett", "för", "söker", "inte", "är", "vill", "kläder", "min", "till", "med"],
  },
  {
    code: "en", name: "English", letters: /(?!)/g,
    words: ["i", "i'm", "im", "the", "a", "an", "for", "with", "need", "want", "looking", "and", "my", "is", "what",
      "to", "under", "some", "something", "me", "show", "wear", "of", "in", "on", "it"],
  },
];

const UK_LETTERS = /[іїєґ]/g;
const RU_LETTERS = /[ыэъё]/g;
const UK_WORDS = new Set([
  "що", "як", "це", "мені", "тобі", "він", "вона", "вони", "дуже", "також", "або", "чи", "будь", "ласка",
  "привіт", "дякую", "добрий", "потрібно", "потрібна", "потрібен", "треба", "можна", "який", "яка", "яке",
  "які", "вже", "ще", "лише", "тільки", "теж", "хочу", "мій", "моя", "мої", "для", "до", "та", "й", "на",
]);
const RU_WORDS = new Set([
  "что", "как", "это", "мне", "тебе", "он", "она", "они", "очень", "также", "или", "ли", "пожалуйста",
  "привет", "спасибо", "добрый", "нужно", "нужна", "нужен", "надо", "можно", "какой", "какая", "какое",
  "какие", "уже", "ещё", "еще", "только", "тоже", "хочу", "мой", "моя", "мои", "для", "до", "и", "на",
]);

function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
}

function count(re: RegExp, text: string): number {
  return (text.match(re) ?? []).length;
}

const SCRIPTS: ReadonlyArray<readonly [RegExp, string, string]> = [
  [/[一-鿿]/, "zh", "Chinese"],
  [/[぀-ヿ]/, "ja", "Japanese"],
  [/[가-힯]/, "ko", "Korean"],
  [/[؀-ۿ]/, "ar", "Arabic"],
  [/[֐-׿]/, "he", "Hebrew"],
  [/[Ͱ-Ͽ]/, "el", "Greek"],
];

/**
 * The language of one piece of text, or null when it says too little to tell.
 * `cyrillic` is set when the text is Cyrillic but neither Ukrainian nor
 * Russian could be told apart.
 */
function detect(text: string): { code: string; name: string } | "cyrillic" | null {
  const lower = (text ?? "").toLowerCase();
  if (!lower.trim()) return null;

  if (/[Ѐ-ӿ]/.test(lower)) {
    const ws = words(lower);
    const uk = count(UK_LETTERS, lower) * 3 + ws.filter((w) => UK_WORDS.has(w) && !RU_WORDS.has(w)).length;
    const ru = count(RU_LETTERS, lower) * 3 + ws.filter((w) => RU_WORDS.has(w) && !UK_WORDS.has(w)).length;
    if (uk > ru) return { code: "uk", name: "Ukrainian" };
    if (ru > uk) return { code: "ru", name: "Russian" };
    return "cyrillic";
  }

  for (const [re, code, name] of SCRIPTS) if (re.test(lower)) return { code, name };

  const ws = words(lower);
  let best: { code: string; name: string; score: number } | null = null;
  let second = 0;
  for (const lang of LATIN) {
    const vocab = new Set(lang.words);
    const score = count(lang.letters, lower) * 2 + ws.filter((w) => vocab.has(w)).length;
    if (!best || score > best.score) {
      second = best?.score ?? 0;
      best = { code: lang.code, name: lang.name, score };
    } else if (score > second) {
      second = score;
    }
  }
  if (!best || best.score === 0) return null;
  // A dead heat between two languages says nothing; one clear word does.
  if (best.score === second) return null;
  return { code: best.code, name: best.name };
}

/**
 * The language to reply in: the current message's, or — when it says too
 * little — that of the shopper's previous messages. Falls back to "the
 * language the shopper writes in", which the model is good at matching, rather
 * than to a guess.
 */
export function replyLanguage(userMessage: string, previousUserMessages: string[] = []): ReplyLanguage {
  const own = detect(userMessage);
  let found = own;
  if (own === null || own === "cyrillic") {
    const withHistory = detect([...previousUserMessages.slice(-2), userMessage].join(" "));
    // Cyrillic that could not be told apart may be settled by the conversation
    // — but only as Ukrainian or Russian, never as the English of an earlier turn.
    if (own === null) found = withHistory;
    else if (withHistory && withHistory !== "cyrillic" && (withHistory.code === "uk" || withHistory.code === "ru")) {
      found = withHistory;
    }
  }
  if (found && found !== "cyrillic") {
    return { prompt: found.name, code: found.code, ui: uiLanguage(found.code) };
  }
  if (found === "cyrillic") {
    return {
      prompt: "the same language as the user's message (it is Ukrainian or Russian — match it exactly, never switch between them)",
      code: null,
      ui: "uk",
    };
  }
  return { prompt: "the same language as the user's message", code: null, ui: "en" };
}

// ── The route's own messages ────────────────────────────────────────────────

export type StylistUiLanguage = "en" | "uk" | "ru" | "de" | "fr" | "es" | "it" | "pl";

function uiLanguage(code: string): StylistUiLanguage {
  return (["uk", "ru", "de", "fr", "es", "it", "pl"] as const).find((c) => c === code) ?? "en";
}

export interface StylistMessages {
  tooFast: string;
  anonLimit: string;
  planLimit: (messages: number, plan: string) => string;
  higherPlan: string;
  fallbackReply: string;
}

export const STYLIST_MESSAGES: Record<StylistUiLanguage, StylistMessages> = {
  en: {
    tooFast: "Too fast — wait a moment and try again.",
    anonLimit: "You've reached today's free limit. Sign in to keep chatting with the stylist.",
    planLimit: (n, plan) => `You've used all ${n} messages for today. Upgrade to ${plan} for more.`,
    higherPlan: "a higher plan",
    fallbackReply: "How can I help with your style? Tell me what you're looking for.",
  },
  uk: {
    tooFast: "Занадто швидко — зачекайте трохи й спробуйте ще раз.",
    anonLimit: "Безкоштовний ліміт на сьогодні вичерпано. Увійдіть в акаунт, щоб продовжити розмову зі стилістом.",
    planLimit: (n, plan) => `Ви використали всі ${n} повідомлень на сьогодні. Оформіть ${plan}, щоб отримати більше.`,
    higherPlan: "вищий тариф",
    fallbackReply: "Чим допомогти зі стилем? Опишіть, що шукаєте.",
  },
  ru: {
    tooFast: "Слишком быстро — подождите немного и попробуйте снова.",
    anonLimit: "Дневной бесплатный лимит исчерпан. Войдите в аккаунт, чтобы продолжить общение со стилистом.",
    planLimit: (n, plan) => `Вы использовали все ${n} сообщений на сегодня. Оформите ${plan}, чтобы получить больше.`,
    higherPlan: "более высокий план",
    fallbackReply: "Чем могу помочь со стилем? Опиши, что ищешь.",
  },
  de: {
    tooFast: "Zu schnell – warte kurz und versuche es noch einmal.",
    anonLimit: "Das kostenlose Tageslimit ist erreicht. Melde dich an, um weiter mit dem Stylisten zu chatten.",
    planLimit: (n, plan) => `Du hast alle ${n} Nachrichten für heute verbraucht. Wechsle zu ${plan}, um mehr zu bekommen.`,
    higherPlan: "einem höheren Tarif",
    fallbackReply: "Wie kann ich dir beim Styling helfen? Beschreib, was du suchst.",
  },
  fr: {
    tooFast: "Trop rapide — patientez un instant et réessayez.",
    anonLimit: "Vous avez atteint la limite gratuite du jour. Connectez-vous pour continuer avec le styliste.",
    planLimit: (n, plan) => `Vous avez utilisé vos ${n} messages du jour. Passez à ${plan} pour en avoir plus.`,
    higherPlan: "une formule supérieure",
    fallbackReply: "Comment puis-je vous aider pour votre style ? Dites-moi ce que vous cherchez.",
  },
  es: {
    tooFast: "Demasiado rápido: espera un momento y vuelve a intentarlo.",
    anonLimit: "Has alcanzado el límite gratuito de hoy. Inicia sesión para seguir hablando con el estilista.",
    planLimit: (n, plan) => `Has usado los ${n} mensajes de hoy. Pásate a ${plan} para tener más.`,
    higherPlan: "un plan superior",
    fallbackReply: "¿En qué te ayudo con tu estilo? Cuéntame qué buscas.",
  },
  it: {
    tooFast: "Troppo veloce: aspetta un attimo e riprova.",
    anonLimit: "Hai raggiunto il limite gratuito di oggi. Accedi per continuare a parlare con lo stylist.",
    planLimit: (n, plan) => `Hai usato tutti i ${n} messaggi di oggi. Passa a ${plan} per averne di più.`,
    higherPlan: "un piano superiore",
    fallbackReply: "Come posso aiutarti con il tuo stile? Dimmi cosa cerchi.",
  },
  pl: {
    tooFast: "Za szybko — poczekaj chwilę i spróbuj ponownie.",
    anonLimit: "Wykorzystano dzisiejszy darmowy limit. Zaloguj się, aby dalej rozmawiać ze stylistą.",
    planLimit: (n, plan) => `Wykorzystano wszystkie ${n} wiadomości na dziś. Przejdź na ${plan}, aby mieć więcej.`,
    higherPlan: "wyższy plan",
    fallbackReply: "W czym mogę pomóc ze stylem? Napisz, czego szukasz.",
  },
};
