- Natalija AI lives in one edge function (`natalija`) with read-only tools using the caller's JWT; add new data domains (finance/Minimax) as extra tools there — never a second assistant. Why: one assistant must reason across all business data under RLS.
- Finance and Natalija access is granted only via `finance_access_grants` user IDs checked by `has_finance_access()`, never by role or email. Why: owner requires exact named people.

- Minimax document classification and finance rules live in `src/lib/minimaxFinance.ts` (with tests); the sync must reuse them, and the org ID is fixed server-side. Why: one tested source of truth prevents double-counting and org mixing.
- Minimax data is mirrored read-only into `mm_*` tables by the `minimax-sync` edge function (resumable per entity/year, upsert by org+Minimax ID); UI and Boris read only through `mm_control_summary`/`mm_profit_by_month`. Why: one verified server-side calculation for Finansije and Boris, no duplicates on re-import.
- `supabase/functions/_shared/minimaxFinance.ts` must stay byte-identical to `src/lib/minimaxFinance.ts` (a test enforces it). Why: edge functions cannot import from `src/`.
