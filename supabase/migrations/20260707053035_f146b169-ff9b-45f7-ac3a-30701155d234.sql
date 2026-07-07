
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark',
  chronicle_order text NOT NULL DEFAULT 'newest_first',
  chronicle_open_page text NOT NULL DEFAULT 'first',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user_settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_settings_updated BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.world_nicknames (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, world_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_nicknames TO authenticated;
GRANT ALL ON public.world_nicknames TO service_role;
ALTER TABLE public.world_nicknames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own world_nicknames" ON public.world_nicknames FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_world_nicknames_updated BEFORE UPDATE ON public.world_nicknames FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
