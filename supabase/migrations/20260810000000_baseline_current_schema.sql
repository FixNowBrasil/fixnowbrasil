-- FixNow database baseline
-- Captures the current schema of Supabase project alskvtcmsrofmabtjjbo.
-- IMPORTANT: this migration is a reconstruction baseline for version control.
-- It is NOT intended to be applied to the existing database as-is.
-- Existing production/demo data is intentionally excluded.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('client', 'provider', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.request_status AS ENUM ('sent', 'analyzing', 'confirmed', 'on_the_way', 'in_progress', 'completed', 'rated', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'wrench'::text,
  emoji text NOT NULL DEFAULT '🔧'::text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_slug_key UNIQUE (slug)
);

CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  price_from numeric NOT NULL DEFAULT 0,
  popular boolean NOT NULL DEFAULT false,
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_slug_key UNIQUE (slug),
  CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL DEFAULT ''::text,
  phone text,
  avatar_url text,
  city text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  blocked boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'client'::public.app_role,
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

CREATE TABLE public.providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  avatar_url text,
  headline text,
  bio text,
  category_id uuid,
  city text NOT NULL DEFAULT 'São Paulo'::text,
  neighborhood text,
  distance_km numeric NOT NULL DEFAULT 3.0,
  radius_km integer NOT NULL DEFAULT 15,
  years_experience integer NOT NULL DEFAULT 1,
  price_from numeric NOT NULL DEFAULT 80,
  rating numeric NOT NULL DEFAULT 0.0,
  reviews_count integer NOT NULL DEFAULT 0,
  jobs_done integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  available_now boolean NOT NULL DEFAULT true,
  approved boolean NOT NULL DEFAULT false,
  work_photos text[] NOT NULL DEFAULT '{}'::text[],
  availability text NOT NULL DEFAULT 'Seg a Sáb, 8h às 18h'::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT providers_pkey PRIMARY KEY (id),
  CONSTRAINT providers_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL,
  CONSTRAINT providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.provider_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  service_id uuid NOT NULL,
  price_from numeric NOT NULL DEFAULT 80,
  CONSTRAINT provider_services_pkey PRIMARY KEY (id),
  CONSTRAINT provider_services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE,
  CONSTRAINT provider_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE,
  CONSTRAINT provider_services_provider_id_service_id_key UNIQUE (provider_id, service_id)
);

CREATE TABLE public.service_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  provider_id uuid,
  service_id uuid,
  category_id uuid,
  need text,
  description text NOT NULL DEFAULT ''::text,
  photos text[] NOT NULL DEFAULT '{}'::text[],
  when_option text NOT NULL DEFAULT 'now'::text,
  scheduled_at timestamptz,
  address text NOT NULL DEFAULT ''::text,
  status public.request_status NOT NULL DEFAULT 'sent'::public.request_status,
  price_estimate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_requests_pkey PRIMARY KEY (id),
  CONSTRAINT service_requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL,
  CONSTRAINT service_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT service_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL,
  CONSTRAINT service_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL
);

CREATE TABLE public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  estimated_time text,
  message text,
  status text NOT NULL DEFAULT 'sent'::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_pkey PRIMARY KEY (id),
  CONSTRAINT quotes_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE,
  CONSTRAINT quotes_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE
);

CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  request_id uuid,
  client_id uuid,
  author_name text NOT NULL DEFAULT 'Cliente FixNow'::text,
  rating integer NOT NULL DEFAULT 5,
  punctuality integer NOT NULL DEFAULT 5,
  quality integer NOT NULL DEFAULT 5,
  service integer NOT NULL DEFAULT 5,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT reviews_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE,
  CONSTRAINT reviews_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE SET NULL,
  CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT reviews_punctuality_check CHECK (punctuality >= 1 AND punctuality <= 5),
  CONSTRAINT reviews_quality_check CHECK (quality >= 1 AND quality <= 5),
  CONSTRAINT reviews_service_check CHECK (service >= 1 AND service <= 5)
);

CREATE TABLE public.addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Casa'::text,
  street text NOT NULL DEFAULT ''::text,
  number text,
  complement text,
  neighborhood text,
  city text NOT NULL DEFAULT ''::text,
  state text,
  zip text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT addresses_pkey PRIMARY KEY (id),
  CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE,
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT favorites_user_id_provider_id_key UNIQUE (user_id, provider_id)
);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE,
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX categories_slug_key ON public.categories (slug);
CREATE UNIQUE INDEX services_slug_key ON public.services (slug);
CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles (user_id, role);
CREATE UNIQUE INDEX provider_services_provider_id_service_id_key ON public.provider_services (provider_id, service_id);
CREATE UNIQUE INDEX favorites_user_id_provider_id_key ON public.favorites (user_id, provider_id);
CREATE UNIQUE INDEX quotes_one_accepted_per_request ON public.quotes (request_id) WHERE status = 'accepted'::text;
CREATE UNIQUE INDEX reviews_one_per_request_idx ON public.reviews (request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX service_requests_provider_scheduled_at_active_idx ON public.service_requests (provider_id, scheduled_at) WHERE provider_id IS NOT NULL AND scheduled_at IS NOT NULL AND status <> 'cancelled'::public.request_status;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'client');
  assigned_role public.app_role := CASE WHEN requested_role = 'provider' THEN 'provider' ELSE 'client' END;
  full_name_value text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, ''), '@', 1));
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, city, avatar_url)
  VALUES (new.id, full_name_value, nullif(new.raw_user_meta_data->>'phone', ''), nullif(new.raw_user_meta_data->>'city', ''), nullif(new.raw_user_meta_data->>'avatar_url', ''))
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = new.id AND ur.role = assigned_role) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, assigned_role);
  END IF;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE client uuid; prov_user uuid; target uuid;
BEGIN
  SELECT sr.client_id, p.user_id INTO client, prov_user FROM public.service_requests sr LEFT JOIN public.providers p ON p.id = sr.provider_id WHERE sr.id = NEW.request_id;
  target := CASE WHEN NEW.sender_id = client THEN prov_user ELSE client END;
  IF target IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link) VALUES (target, 'Nova mensagem', left(NEW.body, 120), '/pedidos/' || NEW.request_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE client uuid;
BEGIN
  SELECT client_id INTO client FROM public.service_requests WHERE id = NEW.request_id;
  IF client IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link) VALUES (client, 'Você recebeu um orçamento', COALESCE(NEW.message, 'Confira o valor proposto'), '/pedidos/' || NEW.request_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE target uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO target FROM public.providers WHERE id = NEW.provider_id;
    IF target IS NOT NULL THEN INSERT INTO public.notifications (user_id, title, body, link) VALUES (target, 'Nova solicitação recebida', COALESCE(NEW.need, NEW.description), '/pedidos/' || NEW.id); END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, title, body, link) VALUES (NEW.client_id, 'Status do seu serviço mudou', NEW.status::text, '/pedidos/' || NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_profile_moderation_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role('admin', auth.uid()) THEN
    IF TG_OP = 'INSERT' AND coalesce(NEW.blocked, false) THEN RAISE EXCEPTION 'A new profile cannot be created as blocked'; END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Profile ownership cannot be changed'; END IF;
      IF NEW.blocked IS DISTINCT FROM OLD.blocked THEN RAISE EXCEPTION 'Only an administrator can change the blocked flag'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_provider_moderation_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role('admin', auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      IF coalesce(NEW.approved, false) OR coalesce(NEW.verified, false) OR coalesce(NEW.rating, 0) <> 0 OR coalesce(NEW.reviews_count, 0) <> 0 OR coalesce(NEW.jobs_done, 0) <> 0 THEN RAISE EXCEPTION 'Provider moderation fields are administrator controlled'; END IF;
    ELSE
      IF NEW.id <> OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Provider ownership cannot be changed'; END IF;
      IF NEW.approved IS DISTINCT FROM OLD.approved OR NEW.verified IS DISTINCT FROM OLD.verified OR NEW.rating IS DISTINCT FROM OLD.rating OR NEW.reviews_count IS DISTINCT FROM OLD.reviews_count OR NEW.jobs_done IS DISTINCT FROM OLD.jobs_done THEN RAISE EXCEPTION 'Marketplace moderation fields are administrator controlled'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.validate_service_request_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE actor uuid := auth.uid(); actor_provider_id uuid;
BEGIN
  IF public.has_role('admin', actor) THEN RETURN NEW; END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN RAISE EXCEPTION 'Request ownership cannot be changed'; END IF;
  SELECT p.id INTO actor_provider_id FROM public.providers p WHERE p.user_id = actor;
  IF OLD.client_id = actor THEN
    IF OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN RAISE EXCEPTION 'Assigned provider cannot be replaced by the client'; END IF;
    RETURN NEW;
  ELSIF actor_provider_id IS NOT NULL AND OLD.provider_id = actor_provider_id THEN
    IF NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN RAISE EXCEPTION 'Provider assignment cannot be changed'; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'You are not a participant in this request';
END; $$;

CREATE OR REPLACE FUNCTION public.validate_service_request_status_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE actor uuid := auth.uid(); actor_provider_id uuid;
BEGIN
  IF public.has_role('admin', actor) THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT p.id INTO actor_provider_id FROM public.providers p WHERE p.user_id = actor;
  IF actor = OLD.client_id THEN
    IF NEW.status = 'cancelled' THEN
      IF OLD.status NOT IN ('sent','analyzing','confirmed') THEN RAISE EXCEPTION 'Request can no longer be cancelled'; END IF; RETURN NEW;
    END IF;
    IF NEW.status = 'confirmed' THEN
      IF OLD.status <> 'analyzing' THEN RAISE EXCEPTION 'Request must be under analysis before confirmation'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.request_id = OLD.id AND q.status = 'accepted') THEN RAISE EXCEPTION 'An accepted quote is required before confirmation'; END IF;
      RETURN NEW;
    END IF;
    IF NEW.status = 'rated' THEN
      IF OLD.status <> 'completed' THEN RAISE EXCEPTION 'Request must be completed before rating'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.reviews rv WHERE rv.request_id = OLD.id AND rv.client_id = actor) THEN RAISE EXCEPTION 'A review is required before marking the request as rated'; END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Client cannot make this request status transition';
  END IF;
  IF actor_provider_id = OLD.provider_id THEN
    IF NEW.status = 'analyzing' AND OLD.status = 'sent' THEN RETURN NEW; END IF;
    IF NEW.status = 'cancelled' AND OLD.status IN ('sent','analyzing','confirmed') THEN RETURN NEW; END IF;
    IF NEW.status = 'on_the_way' AND OLD.status = 'confirmed' THEN RETURN NEW; END IF;
    IF NEW.status = 'in_progress' AND OLD.status = 'on_the_way' THEN RETURN NEW; END IF;
    IF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Provider cannot make this request status transition';
  END IF;
  RAISE EXCEPTION 'You are not a participant in this request';
END; $$;

CREATE OR REPLACE FUNCTION public.validate_service_request_price()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role('admin', auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.price_estimate IS DISTINCT FROM OLD.price_estimate THEN
    IF OLD.client_id <> auth.uid() OR NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.request_id = OLD.id AND q.status = 'accepted' AND q.amount = NEW.price_estimate) THEN
      RAISE EXCEPTION 'Price estimate must match an accepted quote';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.validate_service_request_scheduling()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role('admin', auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    IF OLD.client_id <> auth.uid() THEN RAISE EXCEPTION 'Only the request owner can schedule this service'; END IF;
    IF NEW.provider_id IS NULL THEN RAISE EXCEPTION 'A provider is required before scheduling'; END IF;
    IF NEW.status <> 'confirmed' THEN RAISE EXCEPTION 'A service must be confirmed before scheduling'; END IF;
    IF NEW.scheduled_at IS NULL THEN RAISE EXCEPTION 'A scheduled time cannot be cleared from the client flow'; END IF;
    IF NEW.scheduled_at <= now() THEN RAISE EXCEPTION 'Scheduled time must be in the future'; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.validate_quote_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE actor uuid := auth.uid(); actor_provider_id uuid; request_provider_id uuid; request_client_id uuid;
BEGIN
  IF public.has_role('admin', actor) THEN RETURN NEW; END IF;
  SELECT p.id INTO actor_provider_id FROM public.providers p WHERE p.user_id = actor;
  SELECT r.provider_id, r.client_id INTO request_provider_id, request_client_id FROM public.service_requests r WHERE r.id = CASE WHEN TG_OP='INSERT' THEN NEW.request_id ELSE OLD.request_id END;
  IF TG_OP='INSERT' THEN
    IF actor_provider_id IS NULL OR NEW.provider_id <> actor_provider_id OR request_provider_id IS DISTINCT FROM actor_provider_id THEN RAISE EXCEPTION 'Only the assigned provider can create a quote'; END IF;
    IF NEW.status NOT IN ('pending','sent') THEN RAISE EXCEPTION 'New quotes must start pending or sent'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id <> OLD.id OR NEW.provider_id IS DISTINCT FROM OLD.provider_id OR NEW.request_id IS DISTINCT FROM OLD.request_id THEN RAISE EXCEPTION 'Quote ownership cannot be changed'; END IF;
  IF actor_provider_id = OLD.provider_id THEN
    IF OLD.status IN ('accepted','rejected') THEN
      IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.estimated_time IS DISTINCT FROM OLD.estimated_time OR NEW.message IS DISTINCT FROM OLD.message OR NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Finalized quote cannot be changed by the provider'; END IF;
    ELSIF NEW.status NOT IN ('pending','sent') THEN RAISE EXCEPTION 'Provider cannot accept or reject their own quote'; END IF;
    RETURN NEW;
  ELSIF request_client_id = actor THEN
    IF OLD.status IN ('accepted','rejected') THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Finalized quote cannot be changed by the client'; END IF;
      RETURN NEW;
    END IF;
    IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.provider_id IS DISTINCT FROM OLD.provider_id OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.message IS DISTINCT FROM OLD.message OR NEW.estimated_time IS DISTINCT FROM OLD.estimated_time THEN RAISE EXCEPTION 'Client can only change quote status'; END IF;
    IF NEW.status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'Client can only accept or reject a quote'; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'You are not a participant in this quote';
END; $$;

CREATE OR REPLACE FUNCTION public.validate_review_write()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE actor uuid := auth.uid(); request_client_id uuid; request_provider_id uuid; request_status public.request_status;
BEGIN
  IF public.has_role('admin', actor) THEN RETURN NEW; END IF;
  IF NEW.request_id IS NULL THEN RAISE EXCEPTION 'A review must be linked to a service request'; END IF;
  SELECT sr.client_id, sr.provider_id, sr.status INTO request_client_id, request_provider_id, request_status FROM public.service_requests sr WHERE sr.id = NEW.request_id;
  IF request_client_id IS NULL OR request_provider_id IS NULL THEN RAISE EXCEPTION 'The reviewed service request must have a client and provider'; END IF;
  IF request_status NOT IN ('completed','rated') THEN RAISE EXCEPTION 'A review can only be created after the service is completed'; END IF;
  IF actor IS DISTINCT FROM request_client_id OR NEW.client_id IS DISTINCT FROM request_client_id OR NEW.provider_id IS DISTINCT FROM request_provider_id THEN RAISE EXCEPTION 'Review ownership does not match the service request'; END IF;
  IF TG_OP='UPDATE' AND (NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.provider_id IS DISTINCT FROM OLD.provider_id) THEN RAISE EXCEPTION 'A review cannot be reassigned'; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();
CREATE TRIGGER profiles_protect_moderation_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_moderation_fields();
CREATE TRIGGER profiles_protect_moderation_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_moderation_fields();
CREATE TRIGGER providers_protect_moderation_insert BEFORE INSERT ON public.providers FOR EACH ROW EXECUTE FUNCTION public.protect_provider_moderation_fields();
CREATE TRIGGER providers_protect_moderation_update BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.protect_provider_moderation_fields();
CREATE TRIGGER quotes_notify AFTER INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.notify_on_quote();
CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER quotes_validate_insert BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.validate_quote_update();
CREATE TRIGGER quotes_validate_update BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.validate_quote_update();
CREATE TRIGGER reviews_validate_insert BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.validate_review_write();
CREATE TRIGGER reviews_validate_update BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.validate_review_write();
CREATE TRIGGER service_requests_validate_status BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.validate_service_request_status_update();
CREATE TRIGGER service_requests_notify AFTER INSERT OR UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.notify_on_request();
CREATE TRIGGER service_requests_validate_price BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.validate_service_request_price();
CREATE TRIGGER service_requests_validate_scheduling BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.validate_service_request_scheduling();
CREATE TRIGGER service_requests_validate_update BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.validate_service_request_update();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies are reconstructed from the current production schema and intentionally
-- kept in this baseline so future schema changes remain version-controlled.
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages categories" ON public.categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "services public read" ON public.services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages services" ON public.services FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admin reads profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin updates profiles" ON public.profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR has_role('admin'::app_role, auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role('admin'::app_role, auth.uid())) WITH CHECK (has_role('admin'::app_role, auth.uid()));
CREATE POLICY "providers public read" ON public.providers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "provider self insert" ON public.providers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "provider self update" ON public.providers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin inserts providers" ON public.providers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin updates providers" ON public.providers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "provider_services public read" ON public.provider_services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "client creates requests" ON public.service_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "client reads own requests" ON public.service_requests FOR SELECT TO authenticated USING ((auth.uid() = client_id) OR has_role(auth.uid(), 'admin'::app_role) OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()));
CREATE POLICY "client or provider updates" ON public.service_requests FOR UPDATE TO authenticated USING ((auth.uid() = client_id) OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())) WITH CHECK ((auth.uid() = client_id) OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()));
CREATE POLICY "client deletes own requests" ON public.service_requests FOR DELETE TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "provider creates quote" ON public.quotes FOR INSERT TO authenticated WITH CHECK (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()));
CREATE POLICY "quotes read by parties" ON public.quotes FOR SELECT TO authenticated USING (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()) OR request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "quote update by parties" ON public.quotes FOR UPDATE TO authenticated USING (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()) OR request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid())) WITH CHECK (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()) OR request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid()));
CREATE POLICY "reviews public read" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "client writes review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "client updates own review" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);
CREATE POLICY "admin deletes reviews" ON public.reviews FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "own addresses" ON public.addresses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own favorites" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages read by parties" ON public.messages FOR SELECT TO authenticated USING (request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid() OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())));
CREATE POLICY "messages sent by parties" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid() OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())));
CREATE POLICY "messages marked read by parties" ON public.messages FOR UPDATE TO authenticated USING (request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid() OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()))) WITH CHECK (request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid() OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())));
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTE: The auth.users trigger that calls handle_new_user and Storage objects
-- live outside public schema and must be versioned separately after their exact
-- definitions are captured from the Supabase project.
