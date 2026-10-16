/** Rules for internal invoicing marks on work orders (not Minimax invoice state). */
export const STALE_UNINVOICED_DAYS = 10;

/** Cutoff ISO: orders closed before this moment count as "closed > 10 days, not invoiced". */
export const staleCutoffIso = (now: Date = new Date()) =>
  new Date(now.getTime() - STALE_UNINVOICED_DAYS * 86400000).toISOString();

export const isStaleUninvoiced = (o: { status?: string | null; invoiced_at?: string | null; closed_at?: string | null; invalidated_at?: string | null; deleted_at?: string | null }, now: Date = new Date()) =>
  o.status === "closed" && !o.invoiced_at && !o.invalidated_at && !o.deleted_at && !!o.closed_at && o.closed_at < staleCutoffIso(now);

/** How many of the requested rows the database actually changed (RLS may silently skip rows). */
export const updateOutcome = (requested: number, returned: unknown[] | null | undefined) => {
  const changed = Array.isArray(returned) ? returned.length : 0;
  return { changed, skipped: Math.max(0, requested - changed) };
};
