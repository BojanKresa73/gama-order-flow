-- Update get_work_order_full function to filter deleted orders
CREATE OR REPLACE FUNCTION public.get_work_order_full(p_identifier text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare 
  wo jsonb;
begin
  -- p_identifier can be UUID (id) or public_id
  select to_jsonb(w.*) ||
         jsonb_build_object(
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
  where (w.id::text = p_identifier or w.display_order_number = p_identifier)
    and w.deleted_at is null;

  if wo is null then
    raise exception 'Work order not found';
  end if;

  return wo;
end $function$;