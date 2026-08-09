CREATE OR REPLACE FUNCTION public.notify_on_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO target FROM public.providers WHERE id = NEW.provider_id;
    IF target IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (target, 'Nova solicitação recebida', COALESCE(NEW.need, NEW.description), '/pedidos/' || NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.client_id, 'Status do seu serviço mudou', NEW.status::text, '/pedidos/' || NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER service_requests_notify
AFTER INSERT OR UPDATE ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_request();

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE client uuid; prov_user uuid; target uuid;
BEGIN
  SELECT sr.client_id, p.user_id INTO client, prov_user
  FROM public.service_requests sr
  LEFT JOIN public.providers p ON p.id = sr.provider_id
  WHERE sr.id = NEW.request_id;

  target := CASE WHEN NEW.sender_id = client THEN prov_user ELSE client END;
  IF target IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (target, 'Nova mensagem', left(NEW.body, 120), '/pedidos/' || NEW.request_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER messages_notify
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

CREATE OR REPLACE FUNCTION public.notify_on_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE client uuid;
BEGIN
  SELECT client_id INTO client FROM public.service_requests WHERE id = NEW.request_id;
  IF client IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (client, 'Você recebeu um orçamento', COALESCE(NEW.message, 'Confira o valor proposto'), '/pedidos/' || NEW.request_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER quotes_notify
AFTER INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_quote();