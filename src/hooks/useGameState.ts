import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import {
  Hero, Monster, BattleMonster, XPRecord, Race,
  createHero, createMonster, calculateHP, calculateXP, getHeroLevel, randInRange,
} from '@/lib/gameData';

export function useGameState() {
  const { user } = useAuth();
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [battleMonsters, setBattleMonsters] = useState<BattleMonster[]>([]);
  const [monsterKills, setMonsterKills] = useState<Record<string, number>>({});
  const [xpArchive, setXPArchive] = useState<Record<string, XPRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const heroLevelsRef = useRef<Record<string, number>>({});
  const [levelUpQueue, setLevelUpQueue] = useState<{ heroName: string; level: number }[]>([]);

  // Load all data from Supabase on user change
  useEffect(() => {
    if (!user) {
      setHeroes([]); setMonsters([]); setBattleMonsters([]);
      setMonsterKills({}); setXPArchive({}); setLoading(false);
      return;
    }
    loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    const [hRes, mRes, bmRes, mkRes, xpRes] = await Promise.all([
      supabase.from('heroes').select('*').order('created_at'),
      supabase.from('monsters').select('*').order('created_at'),
      supabase.from('battle_monsters').select('*').order('created_at'),
      supabase.from('monster_kills').select('*'),
      supabase.from('xp_archive').select('*').order('created_at'),
    ]);

    const loadedHeroes = (hRes.data || []).map((h: any) => ({
      id: h.id, name: h.name, race: h.race as Race, profession: h.profession,
      specialization: h.specialization, experience: h.experience,
      kills: h.kills, totalDamage: h.total_damage,
      good_trait: h.good_trait ?? null, bad_trait: h.bad_trait ?? null,
    }));
    // Store initial levels (no notification on load)
    const levels: Record<string, number> = {};
    loadedHeroes.forEach((h: Hero) => { levels[h.id] = getHeroLevel(h.experience); });
    heroLevelsRef.current = levels;
    setHeroes(loadedHeroes);

    setMonsters((mRes.data || []).map((m: any) => ({
      id: m.id, name: m.name, str: m.str, con: m.con, dex: m.dex,
      int: m.int, cha: m.cha, hp: m.hp, mp: m.mp, attack: m.attack,
      defense: m.defense, xp_reward: m.xp_reward, special: m.special,
      is_unique: m.is_unique ?? false, image_url: m.image_url ?? '',
      str_min: m.str_min ?? m.str, str_max: m.str_max ?? m.str,
      con_min: m.con_min ?? m.con, con_max: m.con_max ?? m.con,
      dex_min: m.dex_min ?? m.dex, dex_max: m.dex_max ?? m.dex,
      int_min: m.int_min ?? m.int, int_max: m.int_max ?? m.int,
      cha_min: m.cha_min ?? m.cha, cha_max: m.cha_max ?? m.cha,
      hp_multiplier: m.hp_multiplier ?? 1.0,
    })));

    setBattleMonsters((bmRes.data || []).map((b: any) => ({
      id: b.id, battleId: b.battle_id, name: b.name,
      str: b.str, con: b.con, dex: b.dex, int: b.int, cha: b.cha,
      hp: b.hp, mp: b.mp, attack: b.attack, defense: b.defense,
      xp_reward: b.xp_reward, special: b.special,
      currentHP: b.current_hp, currentMP: b.current_mp, killedBy: b.killed_by,
      is_unique: b.is_unique ?? false, level: b.level ?? 1, image_url: (b as any).image_url ?? '',
    })));

    const kills: Record<string, number> = {};
    (mkRes.data || []).forEach((k: any) => { kills[k.monster_name] = k.count; });
    setMonsterKills(kills);

    const archive: Record<string, XPRecord[]> = {};
    (xpRes.data || []).forEach((x: any) => {
      if (!archive[x.hero_id]) archive[x.hero_id] = [];
      archive[x.hero_id].push({ amount: x.amount, note: x.note, id: x.id });
    });
    setXPArchive(archive);
    setLoading(false);
  }

  // Check for level-ups and queue dialog
  function checkLevelUps(updatedHeroes: Hero[]) {
    const newLevelUps: { heroName: string; level: number }[] = [];
    updatedHeroes.forEach(h => {
      const oldLevel = heroLevelsRef.current[h.id] || 1;
      const newLevel = getHeroLevel(h.experience);
      if (newLevel > oldLevel) {
        newLevelUps.push({ heroName: h.name, level: newLevel });
      }
      heroLevelsRef.current[h.id] = newLevel;
    });
    if (newLevelUps.length > 0) {
      setLevelUpQueue(prev => [...prev, ...newLevelUps]);
    }
  }

  const dismissLevelUp = useCallback(() => {
    setLevelUpQueue(prev => prev.slice(1));
  }, []);

  // Hero CRUD
  const addHero = useCallback(async (data: Omit<Hero, 'id' | 'kills' | 'totalDamage'>) => {
    if (!user) return;
    const { data: row, error } = await supabase.from('heroes').insert({
      user_id: user.id, name: data.name, race: data.race,
      profession: data.profession, specialization: data.specialization,
      experience: data.experience,
    }).select().single();
    if (row) setHeroes(prev => [...prev, { id: row.id, name: row.name, race: row.race as Race, profession: row.profession, specialization: row.specialization, experience: row.experience, kills: row.kills, totalDamage: row.total_damage }]);
  }, [user]);

  const editHero = useCallback(async (id: string, data: Partial<Hero>) => {
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.race !== undefined) update.race = data.race;
    if (data.profession !== undefined) update.profession = data.profession;
    if (data.specialization !== undefined) update.specialization = data.specialization;
    if (data.experience !== undefined) update.experience = data.experience;
    if (data.kills !== undefined) update.kills = data.kills;
    if (data.totalDamage !== undefined) update.total_damage = data.totalDamage;
    await supabase.from('heroes').update(update).eq('id', id);
    setHeroes(prev => prev.map(h => h.id === id ? { ...h, ...data } : h));
  }, []);

  const deleteHero = useCallback(async (id: string) => {
    await supabase.from('heroes').delete().eq('id', id);
    setHeroes(prev => prev.filter(h => h.id !== id));
    // xp_archive cascades automatically
    setXPArchive(prev => { const a = { ...prev }; delete a[id]; return a; });
  }, []);

  // Monster CRUD
  const addMonster = useCallback(async (data: Omit<Monster, 'id'>) => {
    if (!user) return;
    const { data: row } = await supabase.from('monsters').insert({
      user_id: user.id, ...data,
    }).select().single();
    if (row) setMonsters(prev => [...prev, { id: row.id, name: row.name, str: row.str, con: row.con, dex: row.dex, int: row.int, cha: row.cha, hp: row.hp, mp: row.mp, attack: row.attack, defense: row.defense, xp_reward: row.xp_reward, special: row.special, is_unique: (row as any).is_unique ?? false, image_url: (row as any).image_url ?? '' }]);
  }, [user]);

  const editMonster = useCallback(async (id: string, data: Partial<Monster>) => {
    await supabase.from('monsters').update(data).eq('id', id);
    setMonsters(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
  }, []);

  const deleteMonster = useCallback(async (id: string) => {
    await supabase.from('monsters').delete().eq('id', id);
    setMonsters(prev => prev.filter(m => m.id !== id));
  }, []);

  // Battle
  const addToBattle = useCallback(async (monsterId: string, level: number = 1) => {
    if (!user) return;
    const m = monsters.find(x => x.id === monsterId);
    if (!m) return;
    const hp = calculateHP(m.con, level, m.is_unique);
    const battleId = crypto.randomUUID();
    const { data: row } = await supabase.from('battle_monsters').insert({
      user_id: user.id, monster_id: monsterId, battle_id: battleId,
      name: m.name, str: m.str, con: m.con, dex: m.dex, int: m.int, cha: m.cha,
      hp, mp: m.mp, attack: m.attack, defense: m.defense,
      xp_reward: m.xp_reward, special: m.special,
      current_hp: hp, current_mp: m.mp, level, image_url: m.image_url,
    } as any).select().single();
    if (row) {
      const bm: BattleMonster = {
        id: row.id, battleId: row.battle_id, name: row.name,
        str: row.str, con: row.con, dex: row.dex, int: row.int, cha: row.cha,
        hp: row.hp, mp: row.mp, attack: row.attack, defense: row.defense,
        xp_reward: row.xp_reward, special: row.special,
        currentHP: row.current_hp, currentMP: row.current_mp,
        is_unique: m.is_unique, level: (row as any).level ?? level, image_url: m.image_url,
      };
      setBattleMonsters(prev => [...prev, bm]);
    }
  }, [user, monsters]);

  const dealDamage = useCallback(async (battleId: string, heroId: string, dmg: number) => {
    const bmArr = [...battleMonsters];
    const idx = bmArr.findIndex(m => m.battleId === battleId);
    if (idx === -1 || dmg <= 0) return;
    const m = { ...bmArr[idx] };
    const oldHP = m.currentHP;
    m.currentHP = Math.max(0, m.currentHP - dmg);

    const h = [...heroes];
    const hi = h.findIndex(x => x.id === heroId);
    if (hi === -1) return;
    const actualDmg = Math.min(dmg, oldHP);
    h[hi] = { ...h[hi], totalDamage: h[hi].totalDamage + actualDmg };

    const scaledXP = calculateXP(m.xp_reward, m.level);
    let xpGain = Math.floor((actualDmg / m.hp) * scaledXP);

    if (oldHP > 0 && m.currentHP === 0) {
      m.killedBy = heroId;
      h[hi] = { ...h[hi], kills: h[hi].kills + 1 };
      const newKills = { ...monsterKills };
      newKills[m.name] = (newKills[m.name] || 0) + 1;
      setMonsterKills(newKills);
      // Kill bonus: +5% of total XP for normal, +10% for unique
      const bonusPct = m.is_unique ? 0.10 : 0.05;
      xpGain += Math.floor(scaledXP * bonusPct);
      if (user) {
        await supabase.from('monster_kills').upsert(
          { user_id: user.id, monster_name: m.name, count: newKills[m.name] },
          { onConflict: 'user_id,monster_name' }
        );
      }
    }

    h[hi] = { ...h[hi], experience: h[hi].experience + xpGain };

    bmArr[idx] = m;
    setBattleMonsters(bmArr);
    setHeroes(h);
    checkLevelUps(h);

    // Update DB
    await Promise.all([
      supabase.from('battle_monsters').update({ current_hp: m.currentHP, killed_by: m.killedBy || null }).eq('battle_id', battleId),
      supabase.from('heroes').update({ kills: h[hi].kills, total_damage: h[hi].totalDamage, experience: h[hi].experience }).eq('id', heroId),
    ]);
  }, [battleMonsters, heroes, monsterKills, user]);

  const removeFromBattle = useCallback(async (battleId: string) => {
    await supabase.from('battle_monsters').delete().eq('battle_id', battleId);
    setBattleMonsters(prev => prev.filter(m => m.battleId !== battleId));
  }, []);

  const updateBattleMP = useCallback(async (battleId: string, val: number) => {
    setBattleMonsters(prev => prev.map(m =>
      m.battleId === battleId ? { ...m, currentMP: Math.max(0, Math.min(m.mp, val)) } : m
    ));
    const m = battleMonsters.find(x => x.battleId === battleId);
    if (m) {
      const clamped = Math.max(0, Math.min(m.mp, val));
      await supabase.from('battle_monsters').update({ current_mp: clamped }).eq('battle_id', battleId);
    }
  }, [battleMonsters]);

  // XP
  const addXP = useCallback(async (heroId: string, amount: number, note: string) => {
    if (amount <= 0 || !user) return;
    const { data: row } = await supabase.from('xp_archive').insert({
      user_id: user.id, hero_id: heroId, amount, note,
    }).select().single();

    const updatedHeroes = heroes.map(h => h.id === heroId ? { ...h, experience: h.experience + amount } : h);
    setHeroes(updatedHeroes);
    checkLevelUps(updatedHeroes);
    await supabase.from('heroes').update({ experience: heroes.find(h => h.id === heroId)!.experience + amount }).eq('id', heroId);

    if (row) {
      setXPArchive(prev => ({
        ...prev,
        [heroId]: [...(prev[heroId] || []), { amount, note, id: row.id }],
      }));
    }
  }, [user, heroes]);

  const deleteXP = useCallback(async (heroId: string, idx: number) => {
    const records = xpArchive[heroId] || [];
    const removed = records[idx] as any;
    if (!removed) return;

    await supabase.from('xp_archive').delete().eq('id', removed.id);
    const newRecords = [...records];
    newRecords.splice(idx, 1);
    setXPArchive(prev => ({ ...prev, [heroId]: newRecords }));

    const hero = heroes.find(h => h.id === heroId);
    if (hero) {
      const newXP = Math.max(0, hero.experience - removed.amount);
      setHeroes(prev => prev.map(h => h.id === heroId ? { ...h, experience: newXP } : h));
      await supabase.from('heroes').update({ experience: newXP }).eq('id', heroId);
    }
  }, [heroes, xpArchive]);

  const updateXP = useCallback(async (heroId: string, idx: number, amount: number, note: string) => {
    const records = xpArchive[heroId] || [];
    const old = records[idx] as any;
    if (!old) return;

    await supabase.from('xp_archive').update({ amount, note }).eq('id', old.id);
    const newRecords = [...records];
    newRecords[idx] = { amount, note, id: old.id };
    setXPArchive(prev => ({ ...prev, [heroId]: newRecords }));

    const hero = heroes.find(h => h.id === heroId);
    if (hero) {
      const newXP = hero.experience - old.amount + amount;
      setHeroes(prev => prev.map(h => h.id === heroId ? { ...h, experience: newXP } : h));
      await supabase.from('heroes').update({ experience: newXP }).eq('id', heroId);
    }
  }, [heroes, xpArchive]);

  // Update kills directly (stats page)
  const updateKills = useCallback(async (k: Record<string, number>) => {
    if (!user) return;
    setMonsterKills(k);
    // Sync all kills
    for (const [name, count] of Object.entries(k)) {
      await supabase.from('monster_kills').upsert(
        { user_id: user.id, monster_name: name, count },
        { onConflict: 'user_id,monster_name' }
      );
    }
    // Delete removed kills
    const currentNames = Object.keys(k);
    const { data: existing } = await supabase.from('monster_kills').select('monster_name');
    if (existing) {
      for (const row of existing) {
        if (!currentNames.includes((row as any).monster_name)) {
          await supabase.from('monster_kills').delete().eq('monster_name', (row as any).monster_name).eq('user_id', user.id);
        }
      }
    }
  }, [user]);

  // Update heroes directly (stats page)
  const updateHeroes = useCallback(async (h: Hero[]) => {
    setHeroes(h);
    for (const hero of h) {
      await supabase.from('heroes').update({
        kills: hero.kills, total_damage: hero.totalDamage, experience: hero.experience,
      }).eq('id', hero.id);
    }
  }, []);

  const setAllData = useCallback(async (h: Hero[], m: Monster[], bm: BattleMonster[]) => {
    // For import: clear and re-insert
    if (!user) return;
    // Clear existing
    await Promise.all([
      supabase.from('battle_monsters').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('xp_archive').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('heroes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('monsters').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ]);

    // Insert heroes
    for (const hero of h) {
      await supabase.from('heroes').insert({
        user_id: user.id, name: hero.name, race: hero.race,
        profession: hero.profession, specialization: hero.specialization,
        experience: hero.experience, kills: hero.kills, total_damage: hero.totalDamage,
      });
    }
    // Insert monsters
    for (const mon of m) {
      await supabase.from('monsters').insert({
        user_id: user.id, name: mon.name, str: mon.str, con: mon.con, dex: mon.dex,
        int: mon.int, cha: mon.cha, hp: mon.hp, mp: mon.mp, attack: mon.attack,
        defense: mon.defense, xp_reward: mon.xp_reward, special: mon.special,
      });
    }

    await loadAll();
  }, [user]);

  return {
    heroes, monsters, battleMonsters, monsterKills, xpArchive, loading,
    levelUpQueue, dismissLevelUp,
    addHero, editHero, deleteHero,
    addMonster, editMonster, deleteMonster,
    addToBattle, dealDamage, removeFromBattle, updateBattleMP,
    addXP, deleteXP, updateXP,
    updateKills, updateHeroes,
    setAllData,
  };
}
