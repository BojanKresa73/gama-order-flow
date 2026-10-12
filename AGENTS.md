- Boris AI lives in one edge function (`boris`) with read-only tools using the caller's JWT; add new data domains (finance/Minimax) as extra tools there — never a second assistant. Why: one assistant must reason across all business data under RLS.
- Finance and Boris access is granted only via `finance_access_grants` user IDs checked by `has_finance_access()`, never by role or email. Why: owner requires exact named people.

- Minimax document classification and finance rules live in `src/lib/minimaxFinance.ts` (with tests); the sync must reuse them, and the org ID is fixed server-side. Why: one tested source of truth prevents double-counting and org mixing.
