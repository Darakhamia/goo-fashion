/**
 * Writing a colour group: these cards are one piece in several colours.
 *
 * Shared by the importer, which groups each page with the colourways already in
 * the catalogue, and by the Duplicates screen, which groups the ones that were
 * collected before it could. Both decide WHICH cards belong together
 * (`variant-group.ts`); this only makes the database say so — and folds every
 * group those cards already sit in into one (`planColourGroup`), so a piece
 * whose colours were collected from two stores ends up as one card, not two.
 */
import { supabase } from "@/lib/supabase";
import { planColourGroup, type GroupedCard, type GroupWrite } from "@/lib/server/parser/variant-group";

/** Ids per `.in()` filter: they travel in the query string. */
const ID_SLICE = 100;

/** The most members a group may bring in — a run-away group is a mistake to stop, not to spread. */
const MAX_GROUP_MEMBERS = 200;

type Row = { id: string; variant_group_id: string | null; is_group_primary: boolean | null };

const toCard = (r: Row): GroupedCard => ({
  id: r.id,
  variantGroupId: r.variant_group_id,
  isGroupPrimary: r.is_group_primary,
});

/**
 * Make `ids` one colour group, with every card of the groups they are already
 * in. `leadId` leads it when no group has a lead. Answers the group's id and
 * how many cards were written, or what went wrong.
 */
export async function joinColourGroup(
  ids: string[],
  leadId: string,
): Promise<{ groupId: string; written: number } | { error: string }> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (wanted.length < 2 || !wanted.includes(leadId)) return { error: "A colour group needs two cards and its lead among them" };

  const cards = new Map<string, GroupedCard>();
  for (let i = 0; i < wanted.length; i += ID_SLICE) {
    const { data, error } = await supabase!
      .from("products")
      .select("id, variant_group_id, is_group_primary")
      .in("id", wanted.slice(i, i + ID_SLICE));
    if (error) return { error: error.message };
    for (const r of (data ?? []) as Row[]) cards.set(r.id, toCard(r));
  }
  if (!cards.has(leadId) || cards.size < 2) return { error: "These products no longer exist — reload the list." };

  const groups = [...new Set([...cards.values()].map((c) => c.variantGroupId).filter((g): g is string => !!g))];
  if (groups.length) {
    const { data, error } = await supabase!
      .from("products")
      .select("id, variant_group_id, is_group_primary")
      .in("variant_group_id", groups)
      .limit(MAX_GROUP_MEMBERS + 1);
    if (error) return { error: error.message };
    const members = (data ?? []) as Row[];
    if (members.length > MAX_GROUP_MEMBERS) return { error: `These groups hold more than ${MAX_GROUP_MEMBERS} cards together` };
    for (const r of members) if (!cards.has(r.id)) cards.set(r.id, toCard(r));
  }

  // The lead first, so a tie between groups goes to the lead's own.
  const ordered = [cards.get(leadId)!, ...[...cards.values()].filter((c) => c.id !== leadId)];
  const { groupId, writes } = planColourGroup(ordered, leadId, () => crypto.randomUUID());
  const error = await writeGroup(groupId, writes);
  return error ? { error } : { groupId, written: writes.length };
}

/**
 * The writes, members before the lead: should one fail half-way, the group
 * is left without a new lead rather than with two.
 */
async function writeGroup(groupId: string, writes: GroupWrite[]): Promise<string | null> {
  const members = writes.filter((w) => !w.is_group_primary).map((w) => w.id);
  for (let i = 0; i < members.length; i += ID_SLICE) {
    const { error } = await supabase!
      .from("products")
      .update({ variant_group_id: groupId, is_group_primary: false })
      .in("id", members.slice(i, i + ID_SLICE));
    if (error) return error.message;
  }
  for (const w of writes.filter((x) => x.is_group_primary)) {
    const { error } = await supabase!
      .from("products")
      .update({ variant_group_id: groupId, is_group_primary: true })
      .eq("id", w.id);
    if (error) return error.message;
  }
  return null;
}
