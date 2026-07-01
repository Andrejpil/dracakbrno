
-- === Game calendar (singleton) ===
CREATE TABLE public.game_calendar (
  id boolean PRIMARY KEY DEFAULT true,
  current_year integer NOT NULL DEFAULT 657,
  current_month integer NOT NULL DEFAULT 5,
  current_day integer NOT NULL DEFAULT 17,
  era_name text NOT NULL DEFAULT 'Freyovi vlády',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = true),
  CONSTRAINT valid_month CHECK (current_month BETWEEN 1 AND 12),
  CONSTRAINT valid_day CHECK (current_day BETWEEN 1 AND 31)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_calendar TO authenticated;
GRANT ALL ON public.game_calendar TO service_role;
ALTER TABLE public.game_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read calendar" ON public.game_calendar FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors write calendar" ON public.game_calendar FOR ALL TO authenticated
  USING (public.can_write_data(auth.uid())) WITH CHECK (public.can_write_data(auth.uid()));

INSERT INTO public.game_calendar (id) VALUES (true) ON CONFLICT DO NOTHING;

-- === Special days ===
CREATE TABLE public.calendar_special_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#d97706',
  start_month integer NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  start_day integer NOT NULL CHECK (start_day BETWEEN 1 AND 31),
  end_month integer NOT NULL CHECK (end_month BETWEEN 1 AND 12),
  end_day integer NOT NULL CHECK (end_day BETWEEN 1 AND 31),
  recurring boolean NOT NULL DEFAULT true,
  year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_special_days TO authenticated;
GRANT ALL ON public.calendar_special_days TO service_role;
ALTER TABLE public.calendar_special_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read special days" ON public.calendar_special_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors write special days" ON public.calendar_special_days FOR ALL TO authenticated
  USING (public.can_write_data(auth.uid())) WITH CHECK (public.can_write_data(auth.uid()));

-- === Chronicle entries ===
CREATE TYPE public.chronicle_visibility AS ENUM ('all', 'staff_only');

CREATE TABLE public.chronicle_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  entry_year integer NOT NULL,
  entry_month integer NOT NULL CHECK (entry_month BETWEEN 1 AND 12),
  entry_day integer NOT NULL CHECK (entry_day BETWEEN 1 AND 31),
  content text NOT NULL,
  visibility public.chronicle_visibility NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chronicle_entries TO authenticated;
GRANT ALL ON public.chronicle_entries TO service_role;
ALTER TABLE public.chronicle_entries ENABLE ROW LEVEL SECURITY;

-- Everyone sees public entries; staff sees staff_only too; owner sees own
CREATE POLICY "read chronicle" ON public.chronicle_entries FOR SELECT TO authenticated
  USING (
    visibility = 'all'
    OR user_id = auth.uid()
    OR public.can_write_data(auth.uid())
  );
CREATE POLICY "insert own chronicle" ON public.chronicle_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own chronicle" ON public.chronicle_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete own chronicle" ON public.chronicle_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX chronicle_date_idx ON public.chronicle_entries (entry_year, entry_month, entry_day);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER chronicle_touch BEFORE UPDATE ON public.chronicle_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER calendar_touch BEFORE UPDATE ON public.game_calendar
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
