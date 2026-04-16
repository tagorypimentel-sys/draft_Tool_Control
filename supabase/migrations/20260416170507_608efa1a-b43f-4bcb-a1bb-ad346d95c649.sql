
-- Enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operador');
CREATE TYPE public.ferramenta_status AS ENUM ('disponivel', 'emprestada', 'manutencao', 'baixada');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + grant first user as admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operador');
  END IF;
  RETURN NEW;
END;
$$;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users see own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Categorias
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categorias visíveis autenticados" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerenciam categorias" ON public.categorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Locais
CREATE TABLE public.locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Locais visíveis autenticados" ON public.locais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerenciam locais" ON public.locais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Colaboradores
CREATE TABLE public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  setor TEXT,
  contato TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Colaboradores visíveis autenticados" ON public.colaboradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados gerenciam colaboradores" ON public.colaboradores FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE TRIGGER trg_colab_updated BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ferramentas
CREATE TABLE public.ferramentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  local_id UUID REFERENCES public.locais(id) ON DELETE SET NULL,
  status ferramenta_status NOT NULL DEFAULT 'disponivel',
  foto_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ferramentas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ferramentas visíveis autenticados" ON public.ferramentas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados gerenciam ferramentas" ON public.ferramentas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ferr_updated BEFORE UPDATE ON public.ferramentas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Empréstimos
CREATE TABLE public.emprestimos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id UUID NOT NULL REFERENCES public.ferramentas(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_retirada TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_prevista TIMESTAMPTZ,
  data_devolucao TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.emprestimos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empréstimos visíveis autenticados" ON public.emprestimos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados gerenciam empréstimos" ON public.emprestimos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Manutenções
CREATE TABLE public.manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id UUID NOT NULL REFERENCES public.ferramentas(id) ON DELETE CASCADE,
  descricao TEXT,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_fim TIMESTAMPTZ,
  custo NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manutenções visíveis autenticados" ON public.manutencoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados gerenciam manutenções" ON public.manutencoes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
