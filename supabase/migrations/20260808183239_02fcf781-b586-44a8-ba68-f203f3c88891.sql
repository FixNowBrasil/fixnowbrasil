
-- ROLES
CREATE TYPE public.app_role AS ENUM ('client','provider','admin');
CREATE TYPE public.request_status AS ENUM ('sent','analyzing','confirmed','on_the_way','in_progress','completed','rated','cancelled');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  city text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'client',
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, city)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'city');
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'client'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATALOG
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'wrench',
  emoji text NOT NULL DEFAULT '🔧',
  description text,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_from numeric(10,2) NOT NULL DEFAULT 0,
  popular boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services public read" ON public.services FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  avatar_url text,
  headline text,
  bio text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  city text NOT NULL DEFAULT 'São Paulo',
  neighborhood text,
  distance_km numeric(4,1) NOT NULL DEFAULT 3.0,
  radius_km int NOT NULL DEFAULT 15,
  years_experience int NOT NULL DEFAULT 1,
  price_from numeric(10,2) NOT NULL DEFAULT 80,
  rating numeric(2,1) NOT NULL DEFAULT 5.0,
  reviews_count int NOT NULL DEFAULT 0,
  jobs_done int NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  available_now boolean NOT NULL DEFAULT true,
  approved boolean NOT NULL DEFAULT true,
  work_photos text[] NOT NULL DEFAULT '{}',
  availability text NOT NULL DEFAULT 'Seg a Sáb, 8h às 18h',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.providers TO anon, authenticated;
GRANT INSERT, UPDATE ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers public read" ON public.providers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "provider self insert" ON public.providers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "provider self update" ON public.providers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.provider_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  price_from numeric(10,2) NOT NULL DEFAULT 80,
  UNIQUE (provider_id, service_id)
);
GRANT SELECT ON public.provider_services TO anon, authenticated;
GRANT ALL ON public.provider_services TO service_role;
ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_services public read" ON public.provider_services FOR SELECT TO anon, authenticated USING (true);

-- REQUESTS
CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  need text,
  description text NOT NULL DEFAULT '',
  photos text[] NOT NULL DEFAULT '{}',
  when_option text NOT NULL DEFAULT 'now',
  scheduled_at timestamptz,
  address text NOT NULL DEFAULT '',
  status public.request_status NOT NULL DEFAULT 'sent',
  price_estimate numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client reads own requests" ON public.service_requests FOR SELECT TO authenticated
  USING (auth.uid() = client_id
     OR public.has_role(auth.uid(),'admin')
     OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()));
CREATE POLICY "client creates requests" ON public.service_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "client or provider updates" ON public.service_requests FOR UPDATE TO authenticated
  USING (auth.uid() = client_id OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()))
  WITH CHECK (auth.uid() = client_id OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()));
CREATE POLICY "client deletes own requests" ON public.service_requests FOR DELETE TO authenticated USING (auth.uid() = client_id);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL,
  client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT 'Cliente FixNow',
  rating int NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  punctuality int NOT NULL DEFAULT 5 CHECK (punctuality BETWEEN 1 AND 5),
  quality int NOT NULL DEFAULT 5 CHECK (quality BETWEEN 1 AND 5),
  service int NOT NULL DEFAULT 5 CHECK (service BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "client writes review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "client updates own review" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- SEED CATEGORIES
INSERT INTO public.categories (slug, name, emoji, icon, description, sort_order) VALUES
 ('reparos','Reparos','🔧','wrench','Pequenos reparos e marido de aluguel',1),
 ('eletrica','Elétrica','⚡','zap','Instalações e reparos elétricos',2),
 ('hidraulica','Hidráulica','💧','droplets','Encanamento e vazamentos',3),
 ('ar-condicionado','Ar-condicionado','❄️','snowflake','Instalação e manutenção',4),
 ('montagem','Montagem','🪑','hammer','Montagem de móveis',5),
 ('instalacoes','Instalações','📺','tv','TV, suportes e prateleiras',6),
 ('limpeza','Limpeza','🧹','sparkles','Limpeza residencial e comercial',7),
 ('jardinagem','Jardinagem','🌱','leaf','Jardins, poda e paisagismo',8),
 ('tecnologia','Tecnologia','💻','laptop','Informática e redes',9),
 ('chaveiro','Chaveiro','🔑','key','Chaves e fechaduras 24h',10),
 ('pintura','Pintura','🎨','paintbrush','Pintura e acabamento',11),
 ('outros','Outros','🏠','house','Outros serviços residenciais',12);

-- SEED SERVICES
INSERT INTO public.services (category_id, slug, name, description, price_from, popular)
SELECT c.id, v.slug, v.name, v.description, v.price_from, v.popular FROM (VALUES
 ('reparos','pequenos-reparos','Pequenos reparos','Consertos rápidos em casa',70,true),
 ('reparos','marido-de-aluguel','Marido de aluguel','Serviços gerais por hora',90,true),
 ('eletrica','instalacao-tomadas','Instalação de tomadas','Novos pontos de energia',80,false),
 ('eletrica','instalacao-ventilador','Instalação de ventilador de teto','Fixação e ligação elétrica',120,true),
 ('eletrica','instalacao-chuveiro','Instalação de chuveiro','Troca e instalação',90,true),
 ('eletrica','reparo-eletrico','Reparo elétrico','Curto-circuito e disjuntores',100,false),
 ('hidraulica','vazamento','Conserto de vazamento','Detecção e reparo',110,true),
 ('hidraulica','desentupimento','Desentupimento','Pias, ralos e vasos',130,false),
 ('hidraulica','troca-torneira','Troca de torneira','Instalação de torneiras e registros',80,false),
 ('ar-condicionado','instalacao-ar','Instalação de ar-condicionado','Split e janela',350,true),
 ('ar-condicionado','limpeza-ar','Limpeza de ar-condicionado','Higienização completa',150,true),
 ('ar-condicionado','manutencao-ar','Manutenção de ar-condicionado','Carga de gás e reparos',180,false),
 ('montagem','montagem-moveis','Montagem de móveis','Guarda-roupas, camas e mesas',120,true),
 ('montagem','desmontagem-moveis','Desmontagem de móveis','Para mudanças',100,false),
 ('instalacoes','instalacao-tv','Instalação de TV','TV na parede com suporte',150,true),
 ('instalacoes','instalacao-suporte','Instalação de suporte','Suportes e prateleiras',90,false),
 ('limpeza','limpeza-residencial','Limpeza residencial','Diária ou faxina completa',160,true),
 ('limpeza','limpeza-pos-obra','Limpeza pós-obra','Remoção de resíduos finos',280,false),
 ('jardinagem','poda-jardim','Poda e jardinagem','Grama, poda e manutenção',120,false),
 ('jardinagem','dedetizacao','Dedetização','Controle de pragas',200,false),
 ('tecnologia','manutencao-computador','Manutenção de computador','Formatação e limpeza',120,true),
 ('tecnologia','instalacao-rede','Instalação de rede Wi-Fi','Roteadores e cabeamento',140,false),
 ('chaveiro','abertura-porta','Abertura de porta','Atendimento 24h',120,true),
 ('pintura','pintura-parede','Pintura de parede','Interna e externa',200,true)
) AS v(cat,slug,name,description,price_from,popular)
JOIN public.categories c ON c.slug = v.cat;

-- SEED PROVIDERS
INSERT INTO public.providers (name, avatar_url, headline, bio, category_id, city, neighborhood, distance_km, years_experience, price_from, rating, reviews_count, jobs_done, verified, available_now, availability)
SELECT v.name, v.avatar, v.headline, v.bio, c.id, 'São Paulo', v.hood, v.dist, v.exp, v.price, v.rating, v.rc, v.jobs, v.verified, v.avail, v.hours
FROM (VALUES
 ('João Eletricista (demo)','https://i.pravatar.cc/300?img=12','Eletricista residencial','Atendo instalações e reparos elétricos residenciais com garantia de 90 dias.','eletrica','Pinheiros',2.4,12,80,4.9,128,540,true,true,'Seg a Sáb, 7h às 19h'),
 ('Marcos Encanador (demo)','https://i.pravatar.cc/300?img=33','Encanador 24h','Especialista em vazamentos e desentupimentos, atendimento emergencial.','hidraulica','Tatuapé',3.8,9,110,4.7,86,310,true,true,'Todos os dias, 24h'),
 ('Ana Clima Frio (demo)','https://i.pravatar.cc/300?img=45','Técnica de ar-condicionado','Instalação e higienização de split. Certificada pelos principais fabricantes.','ar-condicionado','Moema',5.1,7,180,4.8,64,220,true,false,'Seg a Sex, 8h às 18h'),
 ('Carlos Monta Tudo (demo)','https://i.pravatar.cc/300?img=15','Montador de móveis','Montagem e desmontagem de móveis planejados e de loja.','montagem','Santana',4.2,6,120,4.6,142,610,false,true,'Seg a Sáb, 8h às 20h'),
 ('Pedro Instalações (demo)','https://i.pravatar.cc/300?img=51','Instalador de TV e suportes','Instalo TVs, suportes e home theaters com organização de cabos.','instalacoes','Vila Mariana',1.9,8,150,5.0,73,290,true,true,'Seg a Dom, 9h às 21h'),
 ('Luiza Limpeza (demo)','https://i.pravatar.cc/300?img=47','Diarista profissional','Faxina completa, pós-obra e organização residencial.','limpeza','Ipiranga',6.3,10,160,4.9,205,880,true,true,'Seg a Sáb, 7h às 17h'),
 ('Rafael Jardins (demo)','https://i.pravatar.cc/300?img=68','Jardineiro e paisagista','Manutenção de jardins, poda e projetos de paisagismo.','jardinagem',' Morumbi',8.7,15,120,4.5,41,160,false,false,'Seg a Sex, 7h às 16h'),
 ('Bruno TechFix (demo)','https://i.pravatar.cc/300?img=60','Técnico de informática','Formatação, upgrade e redes Wi-Fi para casa e escritório.','tecnologia','Perdizes',3.1,5,120,4.7,58,190,true,true,'Seg a Sáb, 9h às 19h'),
 ('Chaves & Cia (demo)','https://i.pravatar.cc/300?img=13','Chaveiro 24 horas','Abertura de portas, troca de segredo e fechaduras digitais.','chaveiro','Centro',7.5,20,120,4.4,97,720,true,true,'24 horas, todos os dias'),
 ('Sandra Pinturas (demo)','https://i.pravatar.cc/300?img=26','Pintora profissional','Pintura interna, externa, texturas e efeitos decorativos.','pintura','Lapa',5.6,11,200,4.8,63,240,true,false,'Seg a Sáb, 8h às 18h')
) AS v(name,avatar,headline,bio,cat,hood,dist,exp,price,rating,rc,jobs,verified,avail,hours)
JOIN public.categories c ON c.slug = v.cat;

-- link providers to services of their category
INSERT INTO public.provider_services (provider_id, service_id, price_from)
SELECT p.id, s.id, GREATEST(s.price_from, p.price_from)
FROM public.providers p JOIN public.services s ON s.category_id = p.category_id;

-- SEED REVIEWS
INSERT INTO public.reviews (provider_id, author_name, rating, punctuality, quality, service, comment, created_at)
SELECT p.id, v.author, v.rating, v.rating, v.rating, v.rating, v.comment, now() - (v.d || ' days')::interval
FROM public.providers p
CROSS JOIN (VALUES
 ('Fernanda M. (demo)',5,'Chegou no horário e resolveu tudo rapidinho. Recomendo!',3),
 ('Ricardo S. (demo)',5,'Profissional atencioso, preço justo e serviço impecável.',9),
 ('Camila T. (demo)',4,'Bom serviço, só atrasou um pouco por causa do trânsito.',21)
) AS v(author,rating,comment,d);
