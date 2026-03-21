import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { calculateHP, calculateXP, getHeroLevel } from '@/lib/gameData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dices, Plus, Star, RefreshCw } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';

export default function EncounterPage() {
  const { heroes, monsters, addToBattle } = useGame();
  const { canEdit: canEditPage } = useUserRole();
  const editable = canEditPage('battle');

  const [levelMin, setLevelMin] = useState(1);
  const [levelMax, setLevelMax] = useState(5);
  const [count, setCount] = useState(1);
  const [generated, setGenerated] = useState<{
    monster: typeof monsters[0];
    level: number;
    hp: number;
    xp: number;
  }[]>([]);

  // Avg party level
  const avgLevel = heroes.length > 0
    ? Math.round(heroes.reduce((sum, h) => sum + getHeroLevel(h.experience), 0) / heroes.length)
    : 1;

  function generate() {
    if (monsters.length === 0) {
      toast({ title: 'Bestiář je prázdný', variant: 'destructive' });
      return;
    }
    const min = Math.min(levelMin, levelMax);
    const max = Math.max(levelMin, levelMax);
    const results = [];
    for (let i = 0; i < count; i++) {
      const monster = monsters[Math.floor(Math.random() * monsters.length)];
      const level = min === max ? min : Math.floor(Math.random() * (max - min + 1)) + min;
      const hp = calculateHP(monster.con, level, monster.is_unique);
      const xp = calculateXP(monster.xp_reward, level);
      results.push({ monster, level, hp, xp });
    }
    setGenerated(results);
  }

  async function addAllToBattle() {
    for (const g of generated) {
      await addToBattle(g.monster.id, g.level);
    }
    toast({ title: `${generated.length} bestií přidáno do boje` });
  }

  async function addOneToBattle(index: number) {
    const g = generated[index];
    await addToBattle(g.monster.id, g.level);
    toast({ title: `${g.monster.name} (Úr. ${g.level}) přidán do boje` });
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display text-primary mb-6">Generátor setkání</h2>

      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Úroveň od</label>
            <Input type="number" min={1} className="w-24" value={levelMin}
              onChange={e => setLevelMin(Math.max(1, +e.target.value || 1))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Úroveň do</label>
            <Input type="number" min={1} className="w-24" value={levelMax}
              onChange={e => setLevelMax(Math.max(1, +e.target.value || 1))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Počet</label>
            <Input type="number" min={1} max={10} className="w-20" value={count}
              onChange={e => setCount(Math.max(1, Math.min(10, +e.target.value || 1)))} />
          </div>
          <Button onClick={generate} disabled={monsters.length === 0}>
            <Dices size={16} className="mr-1" /> Generovat
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setLevelMin(Math.max(1, avgLevel - 2)); setLevelMax(avgLevel + 2); }}>
            Dle družiny (Úr. ~{avgLevel})
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Průměrná úroveň družiny: <span className="text-primary font-bold">{avgLevel}</span> ({heroes.length} hrdinů)
        </p>
      </Card>

      {generated.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg text-foreground">Výsledek ({generated.length})</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={generate}>
                <RefreshCw size={14} className="mr-1" /> Znovu
              </Button>
              {editable && (
                <Button size="sm" onClick={addAllToBattle}>
                  <Plus size={14} className="mr-1" /> Všechny do boje
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {generated.map((g, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-[150px] w-[150px] rounded-md shrink-0">
                    {g.monster.image_url ? (
                      <AvatarImage src={g.monster.image_url} alt={g.monster.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="rounded-md text-sm">
                      {g.monster.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-display text-foreground flex items-center gap-1">
                      {g.monster.name}
                      {g.monster.is_unique && <Star size={14} className="text-primary fill-primary" />}
                    </h4>
                    <p className="text-sm text-muted-foreground">Úroveň {g.level}</p>
                    <p className="text-sm">HP: <span className="text-foreground font-bold">{g.hp}</span></p>
                    <p className="text-sm">XP: <span className="text-primary font-bold">{g.xp}</span></p>
                    <p className="text-xs text-muted-foreground">
                      Útok: {g.monster.attack} | Obrana: {g.monster.defense}
                    </p>
                    {g.monster.special && (
                      <p className="text-xs text-muted-foreground mt-1">{g.monster.special}</p>
                    )}
                  </div>
                </div>
                {editable && (
                  <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => addOneToBattle(i)}>
                    <Plus size={14} className="mr-1" /> Do boje
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
