
-- Heroes table
CREATE TABLE public.heroes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  race TEXT NOT NULL,
  profession TEXT NOT NULL DEFAULT '',
  specialization TEXT NOT NULL DEFAULT '',
  experience INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  total_damage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Monsters table
CREATE TABLE public.monsters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  str INTEGER NOT NULL DEFAULT 10,
  con INTEGER NOT NULL DEFAULT 10,
  dex INTEGER NOT NULL DEFAULT 10,
  int INTEGER NOT NULL DEFAULT 10,
  cha INTEGER NOT NULL DEFAULT 10,
  hp INTEGER NOT NULL DEFAULT 10,
  mp INTEGER NOT NULL DEFAULT 0,
  attack INTEGER NOT NULL DEFAULT 0,
  defense INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  special TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Battle monsters table
CREATE TABLE public.battle_monsters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monster_id UUID REFERENCES public.monsters(id) ON DELETE SET NULL,
  battle_id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  str INTEGER NOT NULL DEFAULT 10,
  con INTEGER NOT NULL DEFAULT 10,
  dex INTEGER NOT NULL DEFAULT 10,
  int INTEGER NOT NULL DEFAULT 10,
  cha INTEGER NOT NULL DEFAULT 10,
  hp INTEGER NOT NULL DEFAULT 10,
  mp INTEGER NOT NULL DEFAULT 0,
  attack INTEGER NOT NULL DEFAULT 0,
  defense INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  special TEXT NOT NULL DEFAULT '',
  current_hp INTEGER NOT NULL DEFAULT 10,
  current_mp INTEGER NOT NULL DEFAULT 0,
  killed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Monster kills table
CREATE TABLE public.monster_kills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monster_name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, monster_name)
);

-- XP archive table
CREATE TABLE public.xp_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hero_id UUID REFERENCES public.heroes(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monsters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_monsters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monster_kills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_archive ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
CREATE POLICY "Users manage own heroes" ON public.heroes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own monsters" ON public.monsters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own battle_monsters" ON public.battle_monsters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own monster_kills" ON public.monster_kills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own xp_archive" ON public.xp_archive FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
