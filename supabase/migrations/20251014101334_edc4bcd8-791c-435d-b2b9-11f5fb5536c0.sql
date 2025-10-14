-- Create enum for work order types
CREATE TYPE public.work_order_type AS ENUM ('ctp', 'digital', 'other');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'accounting', 'operator');

-- Create enum for work order status
CREATE TYPE public.work_order_status AS ENUM ('open', 'closed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create plate_formats table (inventory master list)
CREATE TABLE public.plate_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format_name TEXT NOT NULL UNIQUE,
  current_stock INTEGER DEFAULT 0 NOT NULL,
  low_stock_threshold INTEGER DEFAULT 10 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create work_orders table
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  order_type work_order_type NOT NULL,
  status work_order_status DEFAULT 'open' NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  -- Digital print specific fields
  job_name TEXT,
  run_quantity INTEGER,
  pages INTEGER,
  print_format TEXT,
  binding TEXT,
  print_spec TEXT,
  paper_gsm_text INTEGER,
  paper_gsm_cover INTEGER,
  lamination TEXT,
  sheets_used INTEGER,
  clicks_count INTEGER,
  test_clicks INTEGER,
  
  -- Trial print for CTP
  trial_print BOOLEAN DEFAULT FALSE,
  trial_sheets INTEGER,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create work_order_items table (files for CTP, services for Other)
CREATE TABLE public.work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  plate_format_id UUID REFERENCES public.plate_formats(id),
  quantity INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create inventory_history table
CREATE TABLE public.inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_format_id UUID REFERENCES public.plate_formats(id) ON DELETE CASCADE NOT NULL,
  change_amount INTEGER NOT NULL,
  reason TEXT,
  work_order_id UUID REFERENCES public.work_orders(id),
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create email_log table
CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plate_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view all roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for clients
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage clients" ON public.clients FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for plate_formats
CREATE POLICY "Authenticated users can view formats" ON public.plate_formats FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins and operators can manage formats" ON public.plate_formats FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);

-- RLS Policies for work_orders
CREATE POLICY "Authenticated users can view orders" ON public.work_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create orders" ON public.work_orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Operators and admins can update orders" ON public.work_orders FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Only admins can delete orders" ON public.work_orders FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for work_order_items
CREATE POLICY "Authenticated users can view items" ON public.work_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage items" ON public.work_order_items FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for inventory_history
CREATE POLICY "Authenticated users can view history" ON public.inventory_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "System can insert history" ON public.inventory_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for email_log
CREATE POLICY "Authenticated users can view email log" ON public.email_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "System can insert email log" ON public.email_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for audit_log
CREATE POLICY "Authenticated users can view audit log" ON public.audit_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "System can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plate_formats_updated_at BEFORE UPDATE ON public.plate_formats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger function for handling new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample plate formats
INSERT INTO public.plate_formats (format_name, current_stock, low_stock_threshold) VALUES
  ('745×605', 50, 10),
  ('1030×790', 30, 10),
  ('520×380', 100, 15),
  ('880×635', 40, 10);

-- Create function to auto-generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.work_orders;
  new_number := 'WO-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;