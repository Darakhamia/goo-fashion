import type { Gender, Season } from "@/lib/types";

/**
 * Suggest, for a shopper's look: a name and description from the site's
 * copywriter (`/api/looks/copy`), the one the studio uses for its outfits.
 * Used by the Builder's Save look and My looks → Edit info.
 *
 * Pieces go as product ids — the colour the shopper picked where there is one,
 * so the words name the right colour. Resolves to the words, or to the reason
 * there are none.
 */
export async function suggestLookCopy(input: {
  productIds: string[];
  name: string;
  description: string;
  styleKeywords: string[];
  seasons: Season[];
  gender: Gender;
}): Promise<{ name: string; description: string } | { error: string }> {
  try {
    const res = await fetch("/api/looks/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.name !== "string") {
      return { error: typeof data.error === "string" ? data.error : "Couldn't write a suggestion right now. Try again." };
    }
    return { name: data.name, description: typeof data.description === "string" ? data.description : "" };
  } catch {
    return { error: "Network error. Check your connection." };
  }
}
