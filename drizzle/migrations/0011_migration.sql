DO $$ DECLARE d text; n text; BEGIN
d := pg_get_functiondef('public.mm_books_freshness'::regproc);
n := replace(d, 'filter (where journal_type=''BD'') last_statement_booked', 'filter (where journal_type in (''BD'',''BT'')) last_statement_booked');
IF n=d THEN RAISE EXCEPTION 'no change'; END IF; EXECUTE n; END $$;