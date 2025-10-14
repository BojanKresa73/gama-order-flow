-- Create enum for checklist item status
CREATE TYPE public.checklist_item_status AS ENUM ('Pending', 'InProgress', 'Blocked', 'Done', 'NA');

-- FileEntry table: tracks files in work orders
CREATE TABLE public.file_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('CTP', 'Digital', 'Other')),
  plate_format_id UUID REFERENCES public.plate_formats(id),
  quantity INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ChecklistTemplate: templates per order type
CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_type TEXT NOT NULL CHECK (order_type IN ('ctp', 'digital', 'other')),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ChecklistTemplateItem: items in a template
CREATE TABLE public.checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_per_file BOOLEAN NOT NULL DEFAULT false,
  default_assignee_role TEXT CHECK (default_assignee_role IN ('admin', 'operator', 'accounting')),
  sla_hours INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- WorkOrderChecklist: checklist instance for a work order
CREATE TABLE public.work_order_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id),
  progress_pct INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(work_order_id)
);

-- WorkOrderChecklistItem: actual checklist items with status
CREATE TABLE public.work_order_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.work_order_checklists(id) ON DELETE CASCADE,
  file_entry_id UUID REFERENCES public.file_entries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status checklist_item_status NOT NULL DEFAULT 'Pending',
  is_required BOOLEAN NOT NULL DEFAULT false,
  assignee_user_id UUID REFERENCES auth.users(id),
  due_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  blocker_reason TEXT,
  comment TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ChecklistActivityLog: audit trail
CREATE TABLE public.checklist_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES public.work_order_checklist_items(id) ON DELETE CASCADE,
  old_status checklist_item_status,
  new_status checklist_item_status NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.file_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for file_entries
CREATE POLICY "Authenticated users can view file entries"
ON public.file_entries FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create file entries"
ON public.file_entries FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Operators and admins can update file entries"
ON public.file_entries FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admins can delete file entries"
ON public.file_entries FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for checklist_templates
CREATE POLICY "Authenticated users can view templates"
ON public.checklist_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage templates"
ON public.checklist_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for checklist_template_items
CREATE POLICY "Authenticated users can view template items"
ON public.checklist_template_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage template items"
ON public.checklist_template_items FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for work_order_checklists
CREATE POLICY "Authenticated users can view checklists"
ON public.work_order_checklists FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create checklists"
ON public.work_order_checklists FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Operators and admins can update checklists"
ON public.work_order_checklists FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- RLS Policies for work_order_checklist_items
CREATE POLICY "Authenticated users can view checklist items"
ON public.work_order_checklist_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create checklist items"
ON public.work_order_checklist_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their assigned items"
ON public.work_order_checklist_items FOR UPDATE
USING (
  assignee_user_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operator'::app_role)
);

-- RLS Policies for checklist_activity_log
CREATE POLICY "Authenticated users can view activity log"
ON public.checklist_activity_log FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert activity log"
ON public.checklist_activity_log FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE TRIGGER update_file_entries_updated_at
BEFORE UPDATE ON public.file_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checklist_templates_updated_at
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_order_checklists_updated_at
BEFORE UPDATE ON public.work_order_checklists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_order_checklist_items_updated_at
BEFORE UPDATE ON public.work_order_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default CTP template
INSERT INTO public.checklist_templates (order_type, name, is_default)
VALUES ('ctp', 'Standard CTP Checklist', true);

-- Get the template ID for CTP
DO $$
DECLARE
  ctp_template_id UUID;
BEGIN
  SELECT id INTO ctp_template_id FROM public.checklist_templates WHERE order_type = 'ctp' AND is_default = true;
  
  -- Insert CTP template items
  INSERT INTO public.checklist_template_items (template_id, title, is_required, is_per_file, default_assignee_role, sla_hours, display_order)
  VALUES
    (ctp_template_id, 'Preflight provera', true, true, 'operator', 2, 1),
    (ctp_template_id, 'Imposition (montaža)', true, true, 'operator', 4, 2),
    (ctp_template_id, 'CTP izlaz', true, true, 'operator', 2, 3),
    (ctp_template_id, 'Kontrola stanja ploča', true, true, 'operator', 1, 4),
    (ctp_template_id, 'Pakovanje ploča', false, false, 'operator', 1, 5);
END $$;

-- Insert default Digital template
INSERT INTO public.checklist_templates (order_type, name, is_default)
VALUES ('digital', 'Standard Digital Checklist', true);

DO $$
DECLARE
  digital_template_id UUID;
BEGIN
  SELECT id INTO digital_template_id FROM public.checklist_templates WHERE order_type = 'digital' AND is_default = true;
  
  -- Insert Digital template items
  INSERT INTO public.checklist_template_items (template_id, title, is_required, is_per_file, default_assignee_role, sla_hours, display_order)
  VALUES
    (digital_template_id, 'Preflight provera', true, true, 'operator', 2, 1),
    (digital_template_id, 'Podešavanje formata', true, false, 'operator', 1, 2),
    (digital_template_id, 'Test print evidentiran', true, false, 'operator', 1, 3),
    (digital_template_id, 'Štampa završena', true, false, 'operator', 24, 4),
    (digital_template_id, 'Klikovi izračunati', true, false, 'accounting', 2, 5),
    (digital_template_id, 'Dorada (laminacija/povez)', false, false, 'operator', 8, 6);
END $$;

-- Insert default Other template
INSERT INTO public.checklist_templates (order_type, name, is_default)
VALUES ('other', 'Standard Other Services Checklist', true);

DO $$
DECLARE
  other_template_id UUID;
BEGIN
  SELECT id INTO other_template_id FROM public.checklist_templates WHERE order_type = 'other' AND is_default = true;
  
  -- Insert Other template items
  INSERT INTO public.checklist_template_items (template_id, title, is_required, is_per_file, default_assignee_role, sla_hours, display_order)
  VALUES
    (other_template_id, 'Prijem materijala', true, false, 'operator', 1, 1),
    (other_template_id, 'Usluga izvršena', true, false, 'operator', 24, 2),
    (other_template_id, 'Kontrola kvaliteta', false, false, 'operator', 1, 3);
END $$;