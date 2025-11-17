-- Create trigger function to queue email when work order is closed
create or replace function public.fn_queue_email_on_close()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client_email text;
  v_subject text;
  v_html text;
  v_pdf_url text;
begin
  -- React only when status changes to 'closed'
  if TG_OP = 'UPDATE' and NEW.status = 'closed' and OLD.status is distinct from 'closed' then
    -- Get client email
    select c.email
      into v_client_email
      from public.clients c
     where c.id = NEW.client_id;

    if v_client_email is null or v_client_email = '' then
      return NEW; -- No recipient, skip
    end if;

    -- Check if delivery note PDF exists (from delivery_notes table)
    select dn.pdf_path
      into v_pdf_url
      from public.delivery_notes dn
     where dn.work_order_id = NEW.id
     order by dn.created_at desc
     limit 1;

    -- Subject and body (HTML)
    v_subject := coalesce('Nalog ' || coalesce(NEW.display_order_number, NEW.id::text) || ' je završen', 'Vaš nalog je završen');

    v_html := format($h$
      <p>Poštovani,</p>
      <p>Vaš nalog <strong>%s</strong> je zatvoren %s.</p>
      %s
      <p>Hvala na poverenju,<br><strong>Gama United</strong></p>
    $h$,
      coalesce(NEW.display_order_number, NEW.id::text),
      to_char(coalesce(NEW.closed_at, now()), 'DD.MM.YYYY. HH24:MI'),
      case when v_pdf_url is not null then
        format('<p>Otpremnicu možete preuzeti ovde: <a href="%s">%s</a></p>', v_pdf_url, v_pdf_url)
      else '' end
    );

    insert into public.email_jobs (work_order_id, client_email, subject, html_body, attachment_url)
    values (NEW.id, v_client_email, v_subject, v_html, v_pdf_url);
  end if;

  return NEW;
end;
$$;

-- Create trigger
drop trigger if exists trg_queue_email_on_close on public.work_orders;
create trigger trg_queue_email_on_close
after update on public.work_orders
for each row
execute function public.fn_queue_email_on_close();