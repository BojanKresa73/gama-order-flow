-- Update the trigger function to allow up to 3 portal users per client
CREATE OR REPLACE FUNCTION public.check_max_portal_users()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (SELECT COUNT(*) FROM public.client_portal_users WHERE client_id = NEW.client_id) >= 3 THEN
        RAISE EXCEPTION 'Maksimalno 3 korisnika portala po klijentu';
    END IF;
    RETURN NEW;
END;
$function$;