-- Function to manually enqueue email for a work order (used for resending)
create or replace function public.enqueue_email_for_work_order(_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w record;
  v_subject text;
  v_html text;
  v_pdf_url text;
begin
  -- Get work order and client info
  select wo.id, wo.display_order_number, wo.closed_at,
         c.email as client_email, c.name as client_name
    into w
    from public.work_orders wo
    join public.clients c on c.id = wo.client_id
   where wo.id = _work_order_id;

  if not found then
    raise exception 'Work order not found';
  end if;

  if w.client_email is null or w.client_email = '' then
    raise exception 'Client email missing';
  end if;

  -- Get the latest delivery note PDF
  select dn.pdf_path
    into v_pdf_url
    from public.delivery_notes dn
   where dn.work_order_id = _work_order_id
   order by dn.created_at desc
   limit 1;

  -- Build email subject and body
  v_subject := coalesce('Nalog ' || coalesce(w.display_order_number, w.id::text) || ' je završen',
                        'Vaš nalog je završen');

  v_html := format($h$
    <p>Poštovani,</p>
    <p>Vaš nalog <strong>%s</strong> je zatvoren %s.</p>
    %s
    <p>Hvala na poverenju,<br><strong>Gama United</strong></p>
  $h$,
    coalesce(w.display_order_number, w.id::text),
    to_char(coalesce(w.closed_at, now()), 'DD.MM.YYYY. HH24:MI'),
    case when v_pdf_url is not null then
      format('<p>Otpremnicu možete preuzeti ovde: <a href="%s">%s</a></p>', v_pdf_url, v_pdf_url)
    else '' end
  );

  -- Insert into email queue
  insert into public.email_jobs(work_order_id, client_email, subject, html_body, attachment_url)
  values (_work_order_id, w.client_email, v_subject, v_html, v_pdf_url);
end;
$$;