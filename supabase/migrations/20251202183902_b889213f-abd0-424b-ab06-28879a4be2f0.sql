-- Add missing columns to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_molhado_by_default boolean DEFAULT false;

-- Create global_extras table for system-wide extras
CREATE TABLE IF NOT EXISTS public.global_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  applies_to_category text, -- optional: restrict to category name
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on global_extras
ALTER TABLE public.global_extras ENABLE ROW LEVEL SECURITY;

-- Policies for global_extras
CREATE POLICY "Anyone can view global extras" ON public.global_extras
FOR SELECT USING (true);

CREATE POLICY "Admins can manage global extras" ON public.global_extras
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create stock_items table
CREATE TABLE IF NOT EXISTS public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.items(id) ON DELETE CASCADE,
  unit text,
  min_stock numeric DEFAULT 0,
  quantity numeric DEFAULT 0,
  last_counted_at timestamptz,
  responsible text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on stock_items
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- Policies for stock_items
CREATE POLICY "Staff can view stock" ON public.stock_items
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins can manage stock" ON public.stock_items
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add extras_fee column to orders if not exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS extras_fee numeric(10,2) DEFAULT 0;

-- Create function to get delivery tax by bairro
CREATE OR REPLACE FUNCTION public.get_taxa_by_bairro(bairro_in text)
RETURNS TABLE(taxa numeric, dist_km numeric) AS $$
  SELECT dz.taxa, dz.dist_km 
  FROM public.delivery_zones dz 
  WHERE lower(dz.bairro) = lower(bairro_in) 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Create function to get lunch menu for today
CREATE OR REPLACE FUNCTION public.get_lunch_menu_for_today()
RETURNS TABLE(meat_name text, meat_price numeric) AS $$
  SELECT lm.meat_name, lm.meat_price 
  FROM public.lunch_menu lm 
  WHERE lm.weekday = EXTRACT(dow FROM now())::int;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Create function to mark pending orders as in_preparation after 10 minutes
CREATE OR REPLACE FUNCTION public.mark_pending_orders_in_preparation()
RETURNS void AS $$
BEGIN
  UPDATE public.orders 
  SET status = 'preparing' 
  WHERE status = 'pending' 
  AND created_at <= now() - interval '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to check if order can be cancelled (within 10 min window)
CREATE OR REPLACE FUNCTION public.can_cancel_order(order_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND o.status = 'pending'
    AND o.created_at > now() - interval '10 minutes'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Insert global extras
INSERT INTO public.global_extras (code, name, price, applies_to_category) VALUES
  ('OVO', 'Ovo', 2.00, 'Lanches'),
  ('CARNE_ALMOCO', 'Carne extra no almoço', 6.00, 'Almoço')
ON CONFLICT (code) DO UPDATE SET price = EXCLUDED.price, name = EXCLUDED.name;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_status ON public.orders(created_at, status);