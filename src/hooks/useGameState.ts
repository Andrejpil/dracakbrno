import { useState, useCallback } from 'react';
import {
  Hero, Monster, BattleMonster, XPRecord,
  loadHeroes, saveHeroes, createHero,
  loadMonsters, saveMonsters, createMonster,
  loadBattleMonsters, saveBattleMonsters,
  loadMonsterKills, saveMonsterKills,
  loadXPArchive, saveXPArchive,
} from '@/lib/gameData';

export function useGameState() {
  const [heroes, setHeroes] = useState<Hero[]>(loadHeroes);
  const [monsters, setMonsters] = useState<Monster[]>(loadMonsters);
  const [battleMonsters, setBattleMonsters] = useState<BattleMonster[]>(loadBattleMonsters);
  const [monsterKills, setMonsterKills] = useState<Record<string, number>>(loadMonsterKills);
  const [xpArchive, setXPArchive] = useState<Record<string, XPRecord[]>>(loadXPArchive);

  const updateHeroes = useCallback((h: Hero[]) => { setHeroes(h); saveHeroes(h); }, []);
  const updateMonsters = useCallback((m: Monster[]) => { setMonsters(m); saveMonsters(m); }, []);
  const updateBattle = useCallback((b: BattleMonster[]) => { setBattleMonsters(b); saveBattleMonsters(b); }, []);
  const updateKills = useCallback((k: Record<string, number>) => { setMonsterKills(k); saveMonsterKills(k); }, []);
  const updateXPArchive = useCallback((x: Record<string, XPRecord[]>) => { setXPArchive(x); saveXPArchive(x); }, []);

  // Hero CRUD
  const addHero = useCallback((data: Omit<Hero, 'id' | 'kills' | 'totalDamage'>) => {
    const h = [...heroes, createHero(data)];
    updateHeroes(h);
  }, [heroes, updateHeroes]);

  const editHero = useCallback((id: string, data: Partial<Hero>) => {
    const h = heroes.map(hero => hero.id === id ? { ...hero, ...data } : hero);
    updateHeroes(h);
  }, [heroes, updateHeroes]);

  const deleteHero = useCallback((id: string) => {
    updateHeroes(heroes.filter(h => h.id !== id));
    const archive = { ...xpArchive };
    delete archive[id];
    updateXPArchive(archive);
  }, [heroes, xpArchive, updateHeroes, updateXPArchive]);

  // Monster CRUD
  const addMonster = useCallback((data: Omit<Monster, 'id'>) => {
    updateMonsters([...monsters, createMonster(data)]);
  }, [monsters, updateMonsters]);

  const editMonster = useCallback((id: string, data: Partial<Monster>) => {
    updateMonsters(monsters.map(m => m.id === id ? { ...m, ...data } : m));
  }, [monsters, updateMonsters]);

  const deleteMonster = useCallback((id: string) => {
    updateMonsters(monsters.filter(m => m.id !== id));
  }, [monsters, updateMonsters]);

  // Battle
  const addToBattle = useCallback((monsterId: string) => {
    const m = monsters.find(x => x.id === monsterId);
    if (!m) return;
    const bm: BattleMonster = { ...m, battleId: crypto.randomUUID(), currentHP: m.hp, currentMP: m.mp };
    updateBattle([...battleMonsters, bm]);
  }, [monsters, battleMonsters, updateBattle]);

  const dealDamage = useCallback((battleId: string, heroId: string, dmg: number) => {
    const bm = [...battleMonsters];
    const idx = bm.findIndex(m => m.battleId === battleId);
    if (idx === -1 || dmg <= 0) return;
    const m = { ...bm[idx] };
    const oldHP = m.currentHP;
    m.currentHP = Math.max(0, m.currentHP - dmg);
    bm[idx] = m;

    const h = [...heroes];
    const hi = h.findIndex(x => x.id === heroId);
    if (hi === -1) return;
    h[hi] = { ...h[hi], totalDamage: h[hi].totalDamage + dmg };

    if (oldHP > 0 && m.currentHP === 0) {
      m.killedBy = heroId;
      bm[idx] = m;
      h[hi] = { ...h[hi], kills: h[hi].kills + 1, totalDamage: h[hi].totalDamage + dmg };
      const kills = { ...monsterKills };
      kills[m.name] = (kills[m.name] || 0) + 1;
      updateKills(kills);
    }

    const xpGain = Math.floor((Math.min(dmg, oldHP) / m.hp) * m.xp_reward);
    h[hi] = { ...h[hi], experience: h[hi].experience + xpGain };

    updateHeroes(h);
    updateBattle(bm);
  }, [battleMonsters, heroes, monsterKills, updateBattle, updateHeroes, updateKills]);

  const removeFromBattle = useCallback((battleId: string) => {
    updateBattle(battleMonsters.filter(m => m.battleId !== battleId));
  }, [battleMonsters, updateBattle]);

  const updateBattleMP = useCallback((battleId: string, val: number) => {
    const bm = battleMonsters.map(m =>
      m.battleId === battleId ? { ...m, currentMP: Math.max(0, Math.min(m.mp, val)) } : m
    );
    updateBattle(bm);
  }, [battleMonsters, updateBattle]);

  // XP
  const addXP = useCallback((heroId: string, amount: number, note: string) => {
    if (amount <= 0) return;
    const h = heroes.map(hero => hero.id === heroId ? { ...hero, experience: hero.experience + amount } : hero);
    const archive = { ...xpArchive };
    if (!archive[heroId]) archive[heroId] = [];
    archive[heroId] = [...archive[heroId], { amount, note }];
    updateHeroes(h);
    updateXPArchive(archive);
  }, [heroes, xpArchive, updateHeroes, updateXPArchive]);

  const deleteXP = useCallback((heroId: string, idx: number) => {
    const archive = { ...xpArchive };
    const records = [...(archive[heroId] || [])];
    const removed = records[idx];
    records.splice(idx, 1);
    archive[heroId] = records;
    const h = heroes.map(hero =>
      hero.id === heroId ? { ...hero, experience: Math.max(0, hero.experience - (removed?.amount || 0)) } : hero
    );
    updateHeroes(h);
    updateXPArchive(archive);
  }, [heroes, xpArchive, updateHeroes, updateXPArchive]);

  const updateXP = useCallback((heroId: string, idx: number, amount: number, note: string) => {
    const archive = { ...xpArchive };
    const records = [...(archive[heroId] || [])];
    const old = records[idx]?.amount || 0;
    records[idx] = { amount, note };
    archive[heroId] = records;
    const h = heroes.map(hero =>
      hero.id === heroId ? { ...hero, experience: hero.experience - old + amount } : hero
    );
    updateHeroes(h);
    updateXPArchive(archive);
  }, [heroes, xpArchive, updateHeroes, updateXPArchive]);

  return {
    heroes, monsters, battleMonsters, monsterKills, xpArchive,
    addHero, editHero, deleteHero,
    addMonster, editMonster, deleteMonster,
    addToBattle, dealDamage, removeFromBattle, updateBattleMP,
    addXP, deleteXP, updateXP,
    updateKills, updateHeroes,
    setAllData: (h: Hero[], m: Monster[], bm: BattleMonster[]) => {
      updateHeroes(h); updateMonsters(m); updateBattle(bm);
    },
  };
}
