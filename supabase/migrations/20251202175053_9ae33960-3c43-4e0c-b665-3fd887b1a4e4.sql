-- Create enum for user roles (security best practice: separate roles table)
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');

-- Create enum for order status
CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'ready', 'delivered', 'cancelled');

-- Create enum for order type
CREATE TYPE public.order_type AS ENUM ('local', 'retirada', 'entrega');

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table (security: roles in separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'customer',
  UNIQUE (user_id, role)
);

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  allow_extras BOOLEAN DEFAULT false,
  allow_quantity BOOLEAN DEFAULT true,
  allow_tapioca_molhada BOOLEAN DEFAULT false,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extras table
CREATE TABLE public.extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- Lunch menu table (weekday 0=domingo, 6=sábado)
CREATE TABLE public.lunch_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday INT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  meat_name TEXT NOT NULL,
  meat_price NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- Delivery zones table
CREATE TABLE public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bairro TEXT NOT NULL,
  dist_km NUMERIC(5,2),
  taxa NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  order_type order_type NOT NULL DEFAULT 'local',
  address TEXT,
  cep TEXT,
  reference TEXT,
  scheduled_for TIMESTAMPTZ,
  delivery_tax NUMERIC(10,2) DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1,
  extras JSONB DEFAULT '[]'::jsonb,
  tapioca_molhada BOOLEAN DEFAULT false,
  price NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- AI sessions table
CREATE TABLE public.ai_sessions (
  session_id TEXT PRIMARY KEY,
  phone TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  cart JSONB DEFAULT '[]'::jsonb,
  last_intent TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages log table
CREATE TABLE public.messages_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  phone TEXT,
  inbound_text TEXT,
  outbound_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lunch_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Public read policies for menu data (categories, items, extras, lunch_menu, delivery_zones)
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Anyone can view items" ON public.items FOR SELECT USING (true);
CREATE POLICY "Anyone can view extras" ON public.extras FOR SELECT USING (true);
CREATE POLICY "Anyone can view lunch menu" ON public.lunch_menu FOR SELECT USING (true);
CREATE POLICY "Anyone can view delivery zones" ON public.delivery_zones FOR SELECT USING (true);

-- Admin policies for menu management
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage items" ON public.items FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage extras" ON public.extras FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage lunch menu" ON public.lunch_menu FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage delivery zones" ON public.delivery_zones FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Orders policies
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins and staff can view all orders" ON public.orders FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
);
CREATE POLICY "Admins and staff can update orders" ON public.orders FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
);

-- Order items policies
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins and staff can view order items" ON public.order_items FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
);

-- AI sessions policies (service role only for now)
CREATE POLICY "Service can manage ai sessions" ON public.ai_sessions FOR ALL USING (true);
CREATE POLICY "Service can manage messages log" ON public.messages_log FOR ALL USING (true);

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone)
  VALUES (new.id, new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'phone');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'customer');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Pre-populate categories
INSERT INTO public.categories (name) VALUES
  ('Tapiocas'),
  ('Cuscuz'),
  ('Lanches'),
  ('Bebidas'),
  ('Caldos e Panelada'),
  ('Almoço'),
  ('Porções');

-- Pre-populate lunch menu (weekdays 1-5: Monday-Friday)
INSERT INTO public.lunch_menu (weekday, meat_name, meat_price) VALUES
  (1, 'Frango Grelhado', 18.00),
  (2, 'Carne de Sol', 22.00),
  (3, 'Bife Acebolado', 20.00),
  (4, 'Frango à Milanesa', 19.00),
  (5, 'Peixe Frito', 24.00);