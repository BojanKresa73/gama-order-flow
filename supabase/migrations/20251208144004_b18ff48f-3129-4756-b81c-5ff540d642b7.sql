CREATE OR REPLACE FUNCTION public.get_work_order_full(p_identifier text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare 
  wo jsonb;
begin
  select to_jsonb(w.*) ||
         jsonb_build_object(
           'client_name', c.name,
           'client_email', c.email,
           'client_pib', c.pib,
           'items',
           case w.order_type
             when 'film' then (
               select coalesce(jsonb_agg(f.*), '[]'::jsonb)
               from film_jobs f where f.work_order_id = w.id
             )
             when 'digital' then (
               select coalesce(jsonb_agg(d.*), '[]'::jsonb)
               from digital_jobs d where d.work_order_id = w.id
             )
             else (
               select coalesce(jsonb_agg(e.*), '[]'::jsonb)
               from file_entries e where e.work_order_id = w.id
             )
           end
         )
    into wo
  from work_orders w
  join clients c on c.id = w.client_id
  where (w.id::text = p_identifier or w.display_order_number = p_identifier)
    and w.deleted_at is null;

  if wo is null then
    raise exception 'Work order not found';
  end if;

  return wo;
end $function$;