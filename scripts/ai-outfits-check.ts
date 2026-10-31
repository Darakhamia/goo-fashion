/**
 * The AI outfit generator, run end to end with a stand-in model.
 *
 *   npx tsx scripts/ai-outfits-check.ts
 *
 * No key and no database: a small catalogue is made up here, and the "model"
 * answers with what real models get wrong as well as what they get right —
 * outfits without shoes, men's and women's pieces together, three loud
 * colours, an id that is not in the list, a price in the description, another
 * brand's name, "Casual Look", Russian text, emoji. The script prints what the
 * generator kept, refused and rewrote, and exits non-zero when a check that
 * should hold does not. Run it after changing anything in
 * src/lib/server/ai-outfits.
 */
import type { ColorGroup, Product } from "../src/lib/types";
import { runGeneration, type QueuedLook, type RunInput } from "../src/lib/server/ai-outfits/run";
import { buildMessages, outfitSchema, type ModelOutfit, type PlanRequest } from "../src/lib/server/ai-outfits/model";
import { checkCopy } from "../src/lib/server/ai-outfits/copy";
import { writeOutfitCopy } from "../src/lib/server/ai-outfits/write-copy";

const groups: ColorGroup[] = [
  ["White", 1], ["Multicolor", 2], ["Brown", 3], ["Pink", 4], ["Yellow", 5], ["Orange", 6], ["Grey", 7],
  ["Black", 8], ["Green", 9], ["Red", 10], ["Violet", 11], ["Blue", 12], ["Beige", 13],
].map(([name, id]) => ({ id: id as number, name: name as string, hexCode: "#000", sortOrder: id as number }));
const G = (name: string) => groups.find((g) => g.name === name)!.id;

let n = 0;
// Brands are an open list in the catalogue; the type names only the demo ones.
type PieceInput = Omit<Partial<Product>, "brand"> & Pick<Product, "name" | "category"> & { brand: string };
function piece(p: PieceInput, colour: string, gender?: Product["gender"]): Product {
  n++;
  return {
    id: `p${n}`,
    description: "",
    imageUrl: `https://img.example/p${n}.jpg`,
    images: [],
    colors: [colour],
    colorGroupIds: [G(colour)],
    sizes: [],
    material: "",
    retailers: [{ name: "Store", url: "https://store.example", price: 100, currency: "USD", availability: "in stock" }] as Product["retailers"],
    priceMin: 100 + n,
    priceMax: 100 + n,
    currency: "USD",
    isNew: false,
    isSaved: false,
    styleKeywords: ["minimal"],
    gender,
    ...p,
  } as Product;
}

const catalogue: Product[] = [
  piece({ name: "Wool Overcoat", brand: "Toteme", category: "outerwear", subcategory: "Coats", styleKeywords: ["minimal", "classic"] }, "Beige", "women"),
  piece({ name: "Box Shirt", brand: "Our Legacy", category: "shirts", subcategory: "Shirts" }, "White", "men"),
  piece({ name: "Merino Crewneck", brand: "COS", category: "knitwear", subcategory: "Knitwear" }, "Grey", "unisex"),
  piece({ name: "Silk Blouse", brand: "Toteme", category: "tops", subcategory: "Blouses" }, "Black", "women"),
  piece({ name: "Wide Trousers", brand: "Lemaire", category: "bottoms", subcategory: "Trousers" }, "Black", "women"),
  piece({ name: "1996 Relaxed Jeans", brand: "Acne Studios", category: "jeans", subcategory: "Jeans" }, "Blue", "men"),
  piece({ name: "Pleated Trousers", brand: "Our Legacy", category: "bottoms", subcategory: "Trousers" }, "Brown", "men"),
  piece({ name: "Slip Dress", brand: "The Row", category: "dresses", subcategory: "Dresses" }, "Black", "women"),
  piece({ name: "Leather Loafers", brand: "Toteme", category: "footwear", subcategory: "Loafers", styleKeywords: ["classic"] }, "Black", "women"),
  piece({ name: "Derby Shoes", brand: "Our Legacy", category: "footwear", subcategory: "Shoes" }, "Brown", "men"),
  piece({ name: "Runner Sneakers", brand: "Nike", category: "footwear", subcategory: "Sneakers", styleKeywords: ["sporty"] }, "White", "unisex"),
  piece({ name: "Tote Bag", brand: "The Row", category: "bags", subcategory: "Bags" }, "Brown", "women"),
  piece({ name: "Graphic Hoodie", brand: "Stüssy", category: "tops", subcategory: "Hoodies", styleKeywords: ["streetwear"] }, "Red", "unisex"),
  piece({ name: "Cargo Pants", brand: "Carhartt WIP", category: "bottoms", subcategory: "Cargo", styleKeywords: ["streetwear"] }, "Green", "men"),
  piece({ name: "Puffer Jacket", brand: "Arket", category: "outerwear", subcategory: "Jackets", styleKeywords: ["casual"] }, "Yellow", "unisex"),
  piece({ name: "Sold Out Scarf", brand: "Arket", category: "accessories", retailers: [{ name: "S", url: "https://s.example", price: 1, currency: "USD", availability: "sold out" }] as Product["retailers"] }, "Grey"),
  piece({ name: "Swim Shorts", brand: "Arket", category: "swimwear" }, "Blue", "men"),
];
const id = (name: string) => catalogue.find((p) => p.name === name)!.id;

let failures = 0;
function expect(what: string, ok: boolean) {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${what}`);
  if (!ok) failures++;
}

/** The stand-in model: answers from the candidate list by product name. */
function fakeModel(script: (key: (name: string) => string) => ModelOutfit[]) {
  const asked: PlanRequest[] = [];
  let round = 0;
  return {
    asked,
    plan: async (req: PlanRequest) => {
      asked.push(req);
      const key = (name: string) => req.candidates.find((c) => c.product.id === id(name))?.key ?? `missing:${name}`;
      round++;
      return { outfits: round === 1 ? script(key) : [], usage: { input: 5000, output: 1500, costUsd: 0.0044 } };
    },
  };
}

const o = (pieces: [string, string][], over: Partial<ModelOutfit> = {}): ModelOutfit => ({
  pieces: pieces.map(([id, slot]) => ({ id, slot })),
  styles: ["minimal"],
  seasons: ["autumn"],
  palette: ["black", "beige"],
  name: "Camel Coat Sunday",
  description: "A beige wool overcoat over a black silk blouse and wide trousers, finished with black loafers — for a slow autumn Sunday in town.",
  notes: "Tonal neutrals; the long coat balances the wide trousers.",
  ...over,
});

async function run(input: RunInput, model: ReturnType<typeof fakeModel>, existing = new Set<string>()) {
  const queued: QueuedLook[] = [];
  const log: string[] = [];
  const result = await runGeneration(input, {
    runId: "run-test",
    products: catalogue,
    colorGroups: groups,
    existingSignatures: existing,
    existingNames: new Set(["navy office ease"]),
    seed: 42,
    modelName: "test-model",
    plan: model.plan,
    draw: async (pieces) =>
      pieces.some((p) => p.name === "Derby Shoes")
        ? { ok: false, error: "Replicate timed out", failedUrls: [] }
        : { ok: true, imageUrl: "https://storage.example/look.jpg", persisted: true, prompt: "", referencesUsed: pieces.length, referencesFailed: 0 },
    toUsd: async (amount) => amount,
    queue: async (look) => void queued.push(look),
    report: async (u) => void (u.message && log.push(u.message)),
  });
  return { result, queued, log };
}

const base: RunInput = { count: 4, styles: [], colorGroupIds: [], brands: [], gender: null, imageStyle: "mannequin" };

async function main() {
  console.log("\n1. An open brief: the model's good and bad outfits");
  const model = fakeModel((k) => [
    // good, women
    o([[k("Wool Overcoat"), "outerwear"], [k("Silk Blouse"), "top"], [k("Wide Trousers"), "bottom"], [k("Leather Loafers"), "shoes"]]),
    // no shoes
    o([[k("Box Shirt"), "top"], [k("Pleated Trousers"), "bottom"]], { name: "No Shoes" }),
    // men's jeans with women's loafers
    o([[k("Box Shirt"), "top"], [k("1996 Relaxed Jeans"), "bottom"], [k("Leather Loafers"), "shoes"]], { name: "Mixed Up" }),
    // red + green + yellow
    o([[k("Puffer Jacket"), "outerwear"], [k("Graphic Hoodie"), "top"], [k("Cargo Pants"), "bottom"], [k("Runner Sneakers"), "shoes"]], { name: "Traffic Light" }),
    // an id that is not in the list
    o([["c999", "top"], [k("Wide Trousers"), "bottom"], [k("Leather Loafers"), "shoes"]], { name: "Ghost Piece" }),
    // good, men — but the copy is bad: price, another brand, and the picture fails
    o([[k("Box Shirt"), "top"], [k("Pleated Trousers"), "bottom"], [k("Derby Shoes"), "shoes"]], {
      name: "Casual Look",
      description: "A crisp white shirt and brown pleated trousers with Derby shoes, styled like Balenciaga — complete from $412 across leading retailers.",
    }),
    // good, women one-piece — Russian name, emoji in the description
    o([[k("Slip Dress"), "one_piece"], [k("Leather Loafers"), "shoes"], [k("Tote Bag"), "accessory"]], {
      name: "Вечерний образ",
      description: "A black slip dress with black leather loafers and a brown tote bag 🖤 — for dinner after work!",
    }),
    // a one-piece with a separate top
    o([[k("Slip Dress"), "one_piece"], [k("Merino Crewneck"), "top"], [k("Runner Sneakers"), "shoes"]], { name: "Layer Cake" }),
  ]);
  const a = await run(base, model);
  for (const line of a.log) console.log(`     log: ${line}`);
  expect("3 outfits kept and queued", a.queued.length === 3 && a.result.made === 3);
  expect("5 refused", a.result.refused === 5);
  const reasons = a.log.filter((l) => l.startsWith("Refused")).join(" | ");
  expect("refused: no shoes", reasons.includes("no shoes"));
  expect("refused: mixed genders", reasons.includes("mixed men's and women's"));
  expect("refused: too many colours", reasons.includes("too many colours"));
  expect("refused: unknown id", reasons.includes("not in the list"));
  expect("refused: one-piece with a top", reasons.includes("one-piece worn with a separate top"));
  expect("a second round was asked for, with the reasons", model.asked.length === 2 && model.asked[1].feedback.length === 5);
  const [good, bad, dress] = a.queued;
  expect("good copy kept as written", good.name === "Camel Coat Sunday" && good.ai_meta.copy.length === 0);
  expect("generic name replaced", bad.name !== "Casual Look" && bad.ai_meta.copy.some((c) => c.field === "name" && c.problem === "generic"));
  expect("priced description replaced", !/\$/.test(bad.description) && bad.ai_meta.copy.some((c) => c.field === "description" && c.problem.startsWith("names a price")));
  expect("Russian name replaced", !/[а-я]/i.test(dress.name) && dress.ai_meta.copy.some((c) => c.problem === "not in English"));
  expect("emoji and ! tidied, the description kept", dress.description.includes("slip dress") && !/🖤|!/.test(dress.description));
  expect("failed picture: queued without one, reason kept", bad.generated_image === null && bad.ai_meta.imageError === "Replicate timed out");
  expect("pieces stored under builder slots", dress.pieces.map((p) => p.slot).join(",") === "bottom,shoes,accessories");
  expect("gender read from the pieces: the dress look is women's, the shirt look men's", dress.gender === "women" && bad.gender === "men");
  expect("total in dollars", good.total_price === good.pieces.reduce((s, p) => s + catalogue.find((c) => c.id === p.productId)!.priceMin, 0));
  expect("sold-out and swimwear pieces never offered", !model.asked[0].candidates.some((c) => /Sold Out|Swim/.test(c.product.name)));
  for (const q of a.queued) console.log(`     queued: "${q.name}" — ${q.description}`);

  console.log("\n2. A brief: men, Our Legacy, in brown");
  const model2 = fakeModel((k) => [
    o([[k("Box Shirt"), "top"], [k("Pleated Trousers"), "bottom"], [k("Derby Shoes"), "shoes"]], { name: "Brown Study", description: "A white Our Legacy box shirt with brown pleated trousers and brown derby shoes, for a gallery afternoon." }),
    o([[k("Merino Crewneck"), "top"], [k("1996 Relaxed Jeans"), "bottom"], [k("Runner Sneakers"), "shoes"]], { name: "Weekend Grey" }),
  ]);
  const b = await run({ ...base, count: 2, gender: "men", brands: ["Our Legacy"], colorGroupIds: [G("Brown")] }, model2);
  const offered = model2.asked[0].candidates;
  expect("no women's pieces offered to a men's brief", !offered.some((c) => c.product.gender === "women"));
  expect("no off-palette colours offered (red hoodie, yellow puffer, green cargo)", !offered.some((c) => /Hoodie|Puffer|Cargo/.test(c.product.name)));
  expect("brief outfit kept", b.queued.some((q) => q.name === "Brown Study"));
  expect("a men's brief stores men", b.queued.every((q) => q.gender === "men"));
  expect("outfit without the brand or the colour refused", b.log.some((l) => l.includes("Weekend Grey") && /no piece by Our Legacy|no piece in brown/.test(l)));

  console.log("\n2b. Ids written without their prefix (\"89\" for \"c89\") — the live catalogue's first runs");
  const bare = fakeModel((k) => [
    o([[k("Wool Overcoat").slice(1), "outerwear"], [k("Silk Blouse").slice(1), "top"], [k("Wide Trousers").slice(1), "bottom"], [k("Leather Loafers").slice(1), "shoes"]]),
  ]);
  const e = await run({ ...base, count: 1 }, bare);
  expect("bare numbers read as the pieces they number", e.queued.length === 1);
  const schema = outfitSchema(["c1", "c2"]);
  const idSchema = schema.properties.outfits.items.properties.pieces.items.properties.id;
  expect("the schema allows only the round's ids", JSON.stringify(idSchema.enum) === JSON.stringify(["c1", "c2"]));

  console.log("\n3. A piece set the site already has is refused");
  const same = fakeModel((k) => [o([[k("Wool Overcoat"), "outerwear"], [k("Silk Blouse"), "top"], [k("Wide Trousers"), "bottom"], [k("Leather Loafers"), "shoes"]])]);
  const sig = ["Wool Overcoat", "Silk Blouse", "Wide Trousers", "Leather Loafers"].map(id).sort().join("|");
  const c = await run({ ...base, count: 1 }, same, new Set([sig]));
  expect("duplicate refused", c.queued.length === 0 && c.log.some((l) => l.includes("already has")));

  console.log("\n4. An impossible brief stops before the model is called");
  const none = fakeModel(() => []);
  const d = await run({ ...base, count: 2, gender: "men", colorGroupIds: [G("Pink")] }, none);
  expect("no model call, a reason given", none.asked.length === 0 && Boolean(d.result.error));
  console.log(`     ${d.result.error}`);

  console.log("\n5. Copy checks on their own");
  const outfit = { pieces: [], styles: [], seasons: [], palette: ["black"], name: "", description: "", notes: "" };
  const words = (name: string, description: string) =>
    checkCopy({ ...outfit, name, description, pieces: a.queued.length ? [] : [] } as never, { knownBrands: ["Nike", "Balenciaga"], takenNames: new Set() });
  expect("name with a price replaced", words("Under $500 Edit", "x".repeat(80)).notes.some((n) => n.problem === "names a price"));
  expect("name that says AI replaced", words("AI Black Edit", "x".repeat(80)).notes.some((n) => n.problem === "says AI"));
  expect("vague description replaced", words("Night Shift", "An effortless look for every occasion, made to be worn again and again all year.").notes.some((n) => n.problem.startsWith("says nothing")));

  console.log("\n6. The prompt the model receives");
  const { system, user } = await buildMessages({ ...model.asked[0], feedback: ["\"No Shoes\": no shoes"] });
  expect("house style and styling rules are in the system prompt", system.includes("HOUSE STYLE FOR NAMES") && system.includes("STYLING RULES"));
  expect("candidate lines carry slot, colours, gender and price", /c\d+ \| top \| .* \| colours: .* \| for: .* \| \$\d+/.test(user));
  expect("refusals go back to the model", user.includes("were refused"));
  console.log(user.split("\n").slice(0, 8).map((l) => `     ${l}`).join("\n"));

  console.log("\n7. One copywriter: the review, the studio's editor and the shopper's Suggest (write-copy.ts)");
  // The model is answered at the network: the real request is built and sent.
  const sent: { system: string; user: string }[] = [];
  let reply = {
    name: "Camel Coat Sunday",
    description: "A beige wool overcoat over a black silk blouse and wide black trousers, finished with leather loafers — for slow autumn Sundays in town.",
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.includes("api.openai.com")) return realFetch(input, init);
    const raw = input instanceof Request ? await input.clone().text() : String(init?.body ?? "{}");
    const body = JSON.parse(raw) as { messages: { content: string }[] };
    sent.push({ system: body.messages[0].content, user: body.messages[1].content });
    const completion = {
      id: "chatcmpl-test", object: "chat.completion", created: 0, model: "gpt-4.1-mini",
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(reply), refusal: null } }],
      usage: { prompt_tokens: 900, completion_tokens: 80, total_tokens: 980 },
    };
    return new Response(JSON.stringify(completion), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const lookPieces = ["Wool Overcoat", "Silk Blouse", "Wide Trousers", "Leather Loafers"].map((name) => catalogue.find((p) => p.name === name)!);
  const brief = {
    productIds: lookPieces.map((p) => p.id),
    products: lookPieces,
    styles: ["minimal"],
    seasons: ["autumn"],
    gender: null,
    current: { name: "Outfit 44", description: "" },
  };
  const written = await writeOutfitCopy(brief, "sk-test", new Set());
  expect("the model's words come back", written.name === "Camel Coat Sunday" && written.description.startsWith("A beige wool overcoat"));
  expect("the house style is the system prompt", sent[0]?.system.includes("HOUSE STYLE FOR NAMES AND DESCRIPTIONS"));
  expect("the pieces, the brief and the current name go to the model",
    Boolean(sent[0]?.user.includes("Wool Overcoat") && sent[0].user.includes("for women") && sent[0].user.includes("minimal") && sent[0].user.includes("\"Outfit 44\"")));
  reply = { name: "Casual Look", description: "Get the whole look for $480 — a coat, a blouse, trousers and loafers that work for autumn days in the city." };
  const checked = await writeOutfitCopy(brief, "sk-test", new Set(["camel coat sunday"]));
  expect("a generic name and a price are replaced, with notes", checked.name !== "Casual Look" && !/\$\d/.test(checked.description) && checked.notes.some((n) => n.action === "replaced"));
  console.log(`     ${checked.name} — ${checked.description}`);
  reply = { name: "Camel Coat Sunday", description: written.description };
  const takenOnce = await writeOutfitCopy(brief, "sk-test", new Set(["camel coat sunday"]));
  expect("a name another outfit has is replaced", takenOnce.name.toLowerCase() !== "camel coat sunday");
  const own = await writeOutfitCopy({ ...brief, current: { name: "Camel Coat Sunday", description: "" } }, "sk-test", new Set(["camel coat sunday"]));
  expect("the outfit's own name is not taken from it", own.name === "Camel Coat Sunday");
  globalThis.fetch = realFetch;

  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

void main();
