# AI Stylist Architecture — GOO Fashion

_Created: 2026-04-18 — Planning document for Follow-up Phases D & E_

---

## 1. Current State Audit

### How the mock drawer works today

The AI Stylist drawer in `src/app/builder/page.tsx` is entirely client-side. When a user sends a message:

1. `sendMessage(text)` appends a user `ChatMessage` to state.
2. A `setTimeout(900 + random*500ms)` fires to simulate latency.
3. `generateMockReply(text, products, selection)` runs — a pure function with hard-coded keyword matching (`warm`, `sharp`, `under $X`, `street`, `complet`).
4. The reply `{ text: string, suggestions: Product[] }` is appended to state.
5. Suggestions come from filtering `products[]` (the full catalog already in memory) by style keywords or price.

**No network call is made.** The function is declared at module level with this contract:

```typescript
function generateMockReply(
  userText: string,
  products: Product[],
  selection: Partial<Record<SlotId, Product>>
): { text: string; suggestions: Product[] }
```

### What can be reused

| Piece | Status | Reuse decision |
|---|---|---|
| `ChatMessage` interface `{ id, role, text, suggestions?: Product[] }` | Keep as-is | ✅ Reuse — response shape maps cleanly |
| `QUICK_REPLIES` constant | Keep | ✅ Reuse — user-facing chip labels stay the same |
| `sendMessage()` function skeleton | Modify | ✅ Replace the `setTimeout` + `generateMockReply` block with a real `fetch` call |
| Chat thread UI, typing indicator, suggestion strips | Keep as-is | ✅ No changes needed |
| Product filtering via `styleKeywords` (mock fallback) | Keep as fallback | ✅ Used when API is unavailable or returns keywords only |
| `products` state (full catalog in memory on builder page) | Keep | ✅ Used to resolve `suggestedProductIds` returned by the API into full `Product` objects |

### What must be replaced

| Piece | Problem | Replacement |
|---|---|---|
| `generateMockReply()` function | Returns keyword-matched hallucinations, no real LLM | `POST /api/stylist/chat` → GPT-4o-mini |
| OpenAI key via `localStorage` + `x-openai-key` header | Browser-only, not shared, insecure for production | Server-side key from Supabase `settings` table or env var |
| Admin settings page (`localStorage.setItem`) | Key is not accessible to any server-side route | Server-persisted key via new `POST /api/admin/settings` route |

---

## 2. Real API Architecture

### Recommended route

```
POST /api/stylist/chat
```

Single route. Stateless — caller sends full conversation history with each request (standard OpenAI chat pattern). The server does not store session state.

### Request shape

```typescript
interface StylistChatRequest {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  context: {
    surface: "builder" | "browse" | "product";
    // Builder context
    selection?: Array<{
      slot: string;
      productId: string;
      name: string;
      brand: string;
      priceMin: number;
      styleKeywords: string[];
      category: string;
    }>;
    // Product-page context (future)
    focusProductId?: string;
    focusProductName?: string;
    focusProductBrand?: string;
    // Browse context (future)
    activeFilters?: {
      category?: string;
      priceMax?: number;
      brands?: string[];
    };
  };
}
```

### Response shape

```typescript
interface StylistChatResponse {
  text: string;
  suggestedProductIds?: string[];   // IDs from the real catalog (not AI hallucinations)
  styleKeywords?: string[];          // Fallback: keywords the frontend uses to filter catalog
  error?: string;
}
```

The `suggestedProductIds` field is optional in v1. If absent, the frontend falls back to `styleKeywords` filtering (same logic as the mock today).

### How builder context is passed

The builder already has `selection` (the current outfit) and `products` (the full catalog) in state. When sending a message:

```typescript
// In sendMessage() — replaces the setTimeout/generateMockReply block
const body: StylistChatRequest = {
  messages: chatMessages
    .filter(m => m.role !== "assistant" || m.text !== WELCOME_MSG)
    .map(m => ({ role: m.role, content: m.text })),
  context: {
    surface: "builder",
    selection: Object.entries(selection)
      .filter(([, p]) => p != null)
      .map(([slot, p]) => ({
        slot,
        productId: p!.id,
        name: p!.name,
        brand: p!.brand,
        priceMin: p!.priceMin,
        styleKeywords: p!.styleKeywords,
        category: p!.category,
      })),
  },
};

const res = await fetch("/api/stylist/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const json: StylistChatResponse = await res.json();

// Resolve suggestedProductIds → full Product objects
const suggestions: Product[] = json.suggestedProductIds
  ? json.suggestedProductIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is Product => p != null)
      .slice(0, 4)
  : products
      .filter(p => json.styleKeywords?.some(kw => p.styleKeywords.includes(kw as StyleKeyword)))
      .slice(0, 4);

setChatMessages(prev => [
  ...prev,
  { id: `msg-${Date.now()}-ai`, role: "assistant", text: json.text, suggestions },
]);
```

### How browse/product-page context is passed (Phase E)

The same `POST /api/stylist/chat` route accepts the `surface` field. For product pages:

```typescript
context: {
  surface: "product",
  focusProductId: product.id,
  focusProductName: product.name,
  focusProductBrand: product.brand,
}
```

For browse:

```typescript
context: {
  surface: "browse",
  activeFilters: { category: "tops", priceMax: 500 },
}
```

The server-side system prompt builder switches on `surface` to inject the right context block.

---

## 3. Admin Key Management

### Current implementation audit

**`src/app/admin/settings/page.tsx`:**
- Reads/writes `localStorage.getItem("goo-openai-key")`
- On every generate request, the browser reads this key and sends it as `x-openai-key` header
- `src/app/api/generate-outfit/route.ts` reads: `req.headers.get("x-openai-key")?.trim() || process.env.OPENAI_API_KEY`

**Problems with this approach:**
1. The key only exists in the browser that set it — invisible to anyone else (including server-rendered paths and other admin users)
2. Keys in `localStorage` are accessible to any JavaScript on the domain — XSS risk
3. The key is transmitted as a request header on every API call — logged by proxies unless explicitly suppressed
4. No shared server-side key means the AI Stylist cannot be "on" for all users by default

### Proposed server-side storage approach

**Supabase `settings` table:**

```sql
create table settings (
  key   text primary key,
  value text not null,
  updated_at timestamptz default now()
);
-- Row-level security: only service_role can read/write
alter table settings enable row level security;
-- No public access policy — all access via service_role key
```

**New API routes:**

```
GET  /api/admin/settings?key=openai_api_key   → { value: "sk-proj-..." | null }
POST /api/admin/settings                       → { key: "openai_api_key", value: "sk-proj-..." }
```

Both routes must be **admin-gated** using Clerk's `auth()` on the server:

```typescript
// src/app/api/admin/settings/route.ts
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Optionally check against ADMIN_USER_ID env var
  ...
}
```

**How the app reads and uses the key:**

```typescript
// Shared helper: src/lib/server/get-openai-key.ts
// Only runs server-side (API routes / Server Components)
export async function getOpenAIKey(): Promise<string | null> {
  // 1. Env var always wins (production deployment, CI, Vercel secret)
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  // 2. Supabase settings table (admin-configured via UI)
  if (!supabase) return null;
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "openai_api_key")
    .single();
  return data?.value ?? null;
}
```

**Key resolution priority (final):**

```
process.env.OPENAI_API_KEY   (Vercel secret / .env.local)
  → Supabase settings table   (admin UI)
  → null                      (feature disabled, show error)
```

**Remove:** The `x-openai-key` header pattern should be retired for the AI Stylist. The generate-outfit route can keep it temporarily for backwards compatibility, but the chat route should never accept a key from the browser.

**Admin settings page changes required:**
- Replace `localStorage.setItem` with `fetch("POST /api/admin/settings", { key, value })`
- Replace `localStorage.getItem` on mount with `fetch("GET /api/admin/settings?key=openai_api_key")`
- The page no longer needs to pass the key anywhere — it's read server-side on each request

---

## 4. Catalog Grounding

### The core problem

Without catalog grounding, GPT will invent product names, brands, and prices that don't exist in GOO's catalog. This produces a broken user experience: the AI recommends a product, the user asks to see it, it doesn't exist.

### Product fields to expose to the AI

The system prompt should include a catalog summary. Not all product fields are useful — here's what the AI actually needs:

```typescript
// Minimal product context for AI injection
interface ProductContext {
  id: string;
  name: string;
  brand: string;
  category: string;
  styleKeywords: string[];   // The AI uses these for recommendations
  priceMin: number;
}
```

**Excluded from AI context:** `imageUrl`, `description`, `retailers`, `cropData`, `colorImages`, `variantGroupId` — these are either not useful to the language model or too verbose.

### Approach for v1: static catalog summary in system prompt

The simplest production-ready approach. At request time, the server injects a summary of the available catalog into the system prompt. The AI is then instructed to recommend by `styleKeywords` only — no hallucinated product names.

**System prompt catalog block (generated at request time):**

```
Available catalog summary:
- Categories: outerwear, tops, knitwear, bottoms, dresses, footwear, accessories
- Brands: Acne Studios, Balenciaga, Fear of God, Toteme, Lemaire, The Row, Jil Sander,
  Maison Margiela, A.P.C., COS, Arket, Massimo Dutti, Zara, & Other Stories, Nike
- Price range: $30 – $3,000
- Style keywords: minimal, streetwear, classic, avant-garde, romantic, utilitarian,
  bohemian, preppy, sporty, dark, maximalist, coastal, academic
- Total products: {N}

When recommending products, you MUST respond with a JSON block of this shape:
  { "styleKeywords": ["minimal", "classic"], "suggestedProductIds": [] }
Do NOT invent product names or IDs. The suggestedProductIds field must be empty or contain only IDs from the list below.
```

**Optional: small-catalog product list injection**

If the catalog is ≤ 200 products, the server can inject the full minimal product list:

```
Available products (id | name | brand | category | priceMin | styleKeywords):
prod_001 | Wool Overcoat | Toteme | outerwear | 890 | minimal,classic
prod_002 | Relaxed Blazer | A.P.C. | outerwear | 550 | classic,preppy
...
```

At ≤ 200 products this fits in a ~4k token context block (gpt-4o-mini has a 128k context window, so this is fine).

**Token estimate:** 200 products × ~25 tokens each = ~5,000 tokens. Well within budget at gpt-4o-mini pricing ($0.15/1M input tokens = ~$0.00075 per chat message including catalog context).

### For the builder: resolving AI responses to products

Since the builder already has `products[]` in state (fetched from `/api/products` on mount), resolution is client-side and zero-cost:

```typescript
// If AI returns suggestedProductIds
suggestions = json.suggestedProductIds
  .map(id => products.find(p => p.id === id))
  .filter(Boolean);

// If AI returns styleKeywords only (fallback)
suggestions = products
  .filter(p => json.styleKeywords.some(kw => p.styleKeywords.includes(kw)))
  .filter(p => !Object.values(selection).some(s => s?.id === p.id))
  .slice(0, 4);
```

### Phase E: non-builder surfaces

Browse and product pages do not have `products[]` in state. Options:
- **Option A (simplest):** The API route fetches suggestions from Supabase and returns full product objects in the response. Avoids a second fetch on the client.
- **Option B:** Client fetches `POST /api/products/bulk` with the returned IDs.

Option A is recommended for Phase E.

---

## 5. Prompt Design

### System prompt structure

```
You are the AI Stylist for GOO, a curated luxury and contemporary fashion platform.
Your job is to help users build outfits, discover pieces, and understand how to style them.

PERSONALITY:
- Confident but not arrogant. You have good taste and can explain why.
- Concise. Your replies are 1–3 sentences. Never lecture.
- Specific. Reference the user's actual outfit when relevant.
- Warm but editorial — like a knowledgeable friend who works in fashion.

RULES:
1. ONLY recommend products that exist in the GOO catalog (see below).
2. NEVER invent brand names, product names, prices, or styles that are not in the catalog.
3. If you cannot find a relevant match, say so honestly and suggest an alternative direction.
4. When you make suggestions, you MUST include a JSON block at the end of your message:
   ```json
   { "styleKeywords": ["minimal"], "suggestedProductIds": ["prod_001", "prod_003"] }
   ```
   If you have no specific product suggestions, use: { "styleKeywords": [], "suggestedProductIds": [] }
5. Do not include the JSON block in your visible text — the app will parse it separately.
6. Do not repeat what the user already has in their outfit unless commenting on it.

CURRENT OUTFIT:
{outfit_context}

CATALOG SUMMARY:
{catalog_summary}
```

### Outfit context block (builder)

```
Current outfit:
- Outerwear slot: {name} by {brand} (${price}) — style: {keywords}
- Top slot: empty
- Bottom slot: {name} by {brand} (${price}) — style: {keywords}
- Shoes: empty
- Accessories: empty
Outfit style profile: minimal, classic
Price so far: $1,240
```

### Empty context block (no selection)

```
Current outfit: empty — user is starting fresh.
```

### Behavior when context is incomplete

The prompt instructs the model to handle missing context gracefully:

```
If the user asks about something outside the available catalog, say:
"We don't have that exact thing right now, but here's something similar that might work."
Then suggest the closest catalog match by styleKeywords.

If the outfit is empty and the user asks for help, ask one clarifying question:
"What's the occasion? That'll help me point you in the right direction."
```

### JSON parsing strategy on the server

The route extracts the JSON block from the AI's reply before returning it to the client:

```typescript
function extractJsonBlock(text: string): { styleKeywords: string[]; suggestedProductIds: string[] } {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return { styleKeywords: [], suggestedProductIds: [] };
  try {
    return JSON.parse(match[1]);
  } catch {
    return { styleKeywords: [], suggestedProductIds: [] };
  }
}

// Strip the JSON block from the visible reply text
const cleanText = reply.replace(/```json[\s\S]*?```/g, "").trim();
```

This ensures the user never sees the JSON block in the chat thread.

---

## 6. Site-Wide Integration Plan

### Builder integration (Phase D)

**Target:** Replace `generateMockReply` with real API call. Zero visible UI changes.

**Entry point:** The existing Stylist drawer in `src/app/builder/page.tsx`.

**What changes:**
- `sendMessage()` function body: replace `setTimeout/generateMockReply` with `fetch("/api/stylist/chat", ...)`
- Add loading/error handling (already has `chatLoading` state and typing indicator)
- The `useCart` import on the same page is already in place — no layout changes needed

**What stays the same:**
- `ChatMessage` interface
- All drawer UI (thread, chips, suggestions strip, composer)
- `QUICK_REPLIES` chips
- The `products[]` catalog for suggestion resolution

### Browse integration (Phase E — surface A)

**Target:** Contextual style advice while browsing the catalog.

**Entry point:** A "Stylist" trigger button in the browse page filter sidebar or a floating action button.

**What's needed:**
- Extract the chat drawer into `src/components/stylist/StylistDrawer.tsx` (reusable component)
- Add `surface: "browse"` context
- The drawer on browse has no outfit selection — it advises on style direction and filters
- The drawer can pre-fill suggestions based on the active filter state

### Product page integration (Phase E — surface B)

**Target:** "What goes with this?" context-aware advice from any product page.

**Entry point:** A "Get styling advice" button on the product detail page.

**What's needed:**
- Same `StylistDrawer` component with `surface: "product"` context
- `focusProductId` passed to the API
- The AI responds with: "This piece works well with... here are a few options."
- Suggested products come from the API response, not from a pre-loaded catalog state

### Possible global entry point (Phase E — surface C)

A persistent floating chat button (bottom-right) on all pages except `/admin`.

**Risk:** High implementation cost relative to value. Only worth building after validating that users engage with the drawer on builder and product pages. Deferred past Phase E initial.

**If/when built:** Requires `StylistContext` at the app level (not page-level) to persist conversation history across route changes. This is the most complex integration.

### Phase D vs Phase E boundary

| Feature | Phase |
|---|---|
| Real API route `POST /api/stylist/chat` | D |
| Admin settings → Supabase key storage | D |
| Builder drawer wired to real API | D |
| Error/loading/fallback states in builder | D |
| Extract `StylistDrawer` as reusable component | E |
| Browse page integration | E |
| Product page integration | E |
| Global floating chat widget | E (optional, post-validation) |
| `StylistContext` cross-page persistence | E (only if global widget is built) |

---

## 7. Safety and UX

### Loading states

The builder already has `chatLoading` state and a typing indicator animation. For the real API:

```typescript
setChatLoading(true);
try {
  const res = await fetch("/api/stylist/chat", { ... });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  const json = await res.json();
  // append assistant message
} catch (err) {
  setChatMessages(prev => [...prev, {
    id: `err-${Date.now()}`,
    role: "assistant",
    text: "Something went wrong. Try again in a moment.",
  }]);
} finally {
  setChatLoading(false);
}
```

gpt-4o-mini typically responds in 1–3 seconds. The existing typing indicator covers this adequately. No streaming needed for v1.

### Fallback if API key is missing

The `/api/stylist/chat` route should return HTTP 501 with a structured error when no key is configured:

```typescript
const key = await getOpenAIKey();
if (!key) {
  return NextResponse.json(
    { error: "AI Stylist is not configured. Ask your admin to add an OpenAI key." },
    { status: 501 }
  );
}
```

The client handles 501 specifically:

```typescript
if (res.status === 501) {
  setChatMessages(prev => [...prev, {
    id: `err-${Date.now()}`,
    role: "assistant",
    text: "AI Stylist is not available yet — please check back soon.",
  }]);
  return;
}
```

This means the drawer still opens, shows the welcome message, and accepts user input — but gives a clear soft failure rather than a broken spinner. Do not silently fall back to the mock in production (it's misleading).

### Rate limiting considerations

Without rate limiting, a single user can exhaust the OpenAI quota with repeated chat messages. Acceptable approaches in order of implementation cost:

| Approach | Cost | Recommended phase |
|---|---|---|
| Per-IP throttle via Upstash Redis (5 req/min) | Low | Phase D |
| Per-user throttle via Clerk `userId` + Supabase usage table | Medium | Phase D (if auth is required) |
| Plan-gating: free=10 messages/day, plus/ultra=unlimited | Medium–High | Phase E |
| No rate limiting (acceptable for internal/admin-only use) | Zero | Phase D initial |

For Phase D initial with a single admin-set key and a small user base: no rate limiting required. Add Upstash throttle before any public launch.

### What happens if no catalog match is found

The system prompt instructs the model to respond honestly and redirect. Server-side, if `suggestedProductIds` is empty and `styleKeywords` returns 0 results, the client should NOT show an empty suggestions strip — it should show the text reply only with no horizontal scroll area. The `ChatMessage` interface already supports this via `suggestions?: Product[]` (undefined = omit the strip).

---

## 8. Implementation Phases

### Phase D — Recommended coding order

**Step D1: Server-side key infrastructure**
- Create `src/lib/server/get-openai-key.ts` — shared key resolution helper
- Create `src/app/api/admin/settings/route.ts` — GET/POST (Supabase-backed, Clerk-gated)
- Modify `src/app/admin/settings/page.tsx` — swap localStorage → API calls
- Create `settings` table in Supabase (or confirm schema via admin SQL)

**Step D2: Chat API route**
- Create `src/app/api/stylist/chat/route.ts`
- Implement: key resolution → catalog summary building → system prompt assembly → OpenAI call → JSON block extraction → clean response
- Test: verify that `suggestedProductIds` contains only real product IDs from the catalog

**Step D3: Wire builder drawer**
- Modify `src/app/builder/page.tsx` `sendMessage()` — replace mock with real fetch
- Handle loading, error, 501 no-key states
- Verify suggestion strip still works with real product IDs

**Step D4: End-to-end test**
- Set key via admin panel → open builder → type a message → verify real response
- Test "Complete my look" quick reply → verify product suggestions are real catalog items
- Test with no key set → verify graceful degradation message

### Phase E — Recommended coding order

**Step E1: Extract StylistDrawer component**
- Create `src/components/stylist/StylistDrawer.tsx`
- Accept props: `surface`, `selectionContext?`, `focusProduct?`, `activeFilters?`
- Move all chat state inside the component (or pass via props from parent)

**Step E2: Product page integration**
- Add "Stylist" button to `src/app/product/[id]/page.tsx`
- Mount `<StylistDrawer surface="product" focusProduct={product} />`

**Step E3: Browse page integration**
- Add Stylist trigger to browse filter sidebar or page header
- Mount `<StylistDrawer surface="browse" activeFilters={filters} />`

**Step E4: Rate limiting (if public launch)**
- Add Upstash Redis rate limiting to `POST /api/stylist/chat`

### Files to add or modify

| File | Action | Phase |
|---|---|---|
| `src/lib/server/get-openai-key.ts` | **New** | D1 |
| `src/app/api/admin/settings/route.ts` | **New** | D1 |
| `src/app/admin/settings/page.tsx` | **Modify** (swap localStorage → API) | D1 |
| `src/app/api/stylist/chat/route.ts` | **New** | D2 |
| `src/app/builder/page.tsx` | **Modify** (sendMessage, error states) | D3 |
| `src/components/stylist/StylistDrawer.tsx` | **New** | E1 |
| `src/app/product/[id]/page.tsx` | **Modify** (add drawer) | E2 |
| `src/app/browse/page.tsx` | **Modify** (add drawer) | E3 |

---

## Open Questions

**OQ1 — Shared vs. per-user API key model**
Should there be one shared OpenAI key (admin-configured, all users share it) or per-user keys?

- Shared key = SaaS model. GOO absorbs costs. Rate limiting is necessary.
- Per-user key = Current generate-outfit model. No GOO cost, but friction for users.

Recommended: shared key for AI Stylist chat (it's a product feature, not a power-user tool). Per-user key is acceptable only for the image generation feature which is expensive.

**OQ2 — Supabase `settings` table: does it exist?**
The architecture assumes this table can be created. If the Supabase project already has a `settings` table with a different schema, this plan needs adjustment.

**OQ3 — Clerk auth for admin routes**
The admin settings API must be auth-gated. Is there a Clerk admin user ID to hardcode as `ADMIN_USER_ID` env var, or should the gate check a custom Clerk role/claim instead?

**OQ4 — Catalog size for product ID injection**
How many products are currently in the Supabase catalog? If < 200, full ID injection into the prompt is feasible. If > 500, the keyword-only approach is safer. This determines whether v1 can offer true product ID suggestions or only style keyword filtering.

**OQ5 — Streaming vs. non-streaming**
GPT-4o-mini responses arrive in 1–3 seconds. Is non-streaming acceptable for v1 (simpler implementation), or is word-by-word streaming preferred for perceived responsiveness?

**OQ6 — Product page: does `/app/product/[id]/page.tsx` exist?**
The browse page (`src/app/browse/page.tsx`) exists. Is there a product detail page at `/product/[id]`? If so, Phase E2 is straightforward. If not, it must be created before Phase E2 can proceed.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| AI hallucinating product IDs not in catalog | High | Server-side ID validation: strip any `suggestedProductIds` not found in `getAllProducts()` |
| OpenAI API costs from unlimited chat usage | Medium | Add per-IP rate limiting before public launch (Upstash Redis, ~5 min) |
| API key stored in Supabase without encryption | Medium | Acceptable for internal/small-scale use; for production use Vercel env secrets instead |
| `x-openai-key` header pattern left active | Low | Retire for chat route; keep for generate-outfit backwards compat only |
| Context window overflow on large catalogs | Low | Cap catalog injection at 200 products; use styleKeywords-only fallback for larger catalogs |
| gpt-4o-mini model changes or deprecation | Low | API route uses `model` as a constant — easy to swap |
| Supabase `settings` table not created | Blocking D1 | Must be done manually in Supabase SQL editor before D1 can ship |

---

## Recommended Next Coding Prompt

After reviewing and approving this architecture document, the recommended next prompt is:

> **"Implement Phase D Step 1: server-side OpenAI key infrastructure. Create the Supabase `settings` table SQL, the `get-openai-key.ts` server helper, the `POST/GET /api/admin/settings` route (Clerk-gated), and update the admin settings page to use the API instead of localStorage. Do not implement the chat route yet."**

This step has no user-facing changes (other than the admin panel) and zero risk of breaking the existing builder or generate-outfit feature. It establishes the foundation that D2 (the chat route) depends on.

---

_End of AI_STYLIST_ARCHITECTURE.md_
