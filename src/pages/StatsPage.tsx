import { useGame } from '@/contexts/GameContext';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useUserRole } from '@/hooks/useUserRole';

export default function StatsPage() {
  const { heroes, monsters, monsterKills, updateKills, updateHeroes } = useGame();
  const { canEdit: canEditPage } = useUserRole();
  const editable = canEditPage('stats');

  const killEntries = Object.entries(monsterKills)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalKills = Object.values(monsterKills).reduce((a, b) => a + b, 0);

  const heroRanking = [...heroes].sort((a, b) => b.kills - a.kills).filter(h => h.kills > 0);
  const damageRanking = [...heroes].sort((a, b) => b.totalDamage - a.totalDamage).filter(h => h.totalDamage > 0);

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display text-primary mb-2">Statistika & Přehled zabití</h2>
      <p className="text-muted-foreground mb-6">Celkový počet zabitých bestií: <span className="text-primary font-bold">{totalKills}</span></p>

      {/* Hrdinové - editovatelné kills/damage */}
      <h3 className="font-display text-lg text-foreground mb-3">Hrdinové</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {heroes.map(h => (
          <div key={h.id} className="bg-card rounded-lg p-4 border border-border">
            <h4 className="font-display text-foreground mb-2">{h.name}</h4>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="text-muted-foreground">Killů:</span>
              {editable ? <Input type="number" className="w-20 h-7 text-xs" value={h.kills}
                onChange={e => {
                  const val = parseInt(e.target.value) || 0;
                  updateHeroes(heroes.map(x => x.id === h.id ? { ...x, kills: val } : x));
                }} /> : <span className="text-foreground">{h.kills}</span>}
              <span className="text-muted-foreground">Poškození:</span>
              {editable ? <Input type="number" className="w-20 h-7 text-xs" value={h.totalDamage}
                onChange={e => {
                  const val = parseInt(e.target.value) || 0;
                  updateHeroes(heroes.map(x => x.id === h.id ? { ...x, totalDamage: val } : x));
                }} /> : <span className="text-foreground">{h.totalDamage}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Žebříčky hrdinů */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {heroRanking.length > 0 && (
          <Card className="p-4">
            <h3 className="font-display text-foreground mb-3">🏆 Nejvíce zabití</h3>
            <div className="space-y-2">
              {heroRanking.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary w-6">{i + 1}.</span>
                  <span className="text-foreground font-semibold flex-1">{h.name}</span>
                  <span className="text-sm text-muted-foreground">{h.kills} zabití</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {damageRanking.length > 0 && (
          <Card className="p-4">
            <h3 className="font-display text-foreground mb-3">⚔️ Nejvíce poškození</h3>
            <div className="space-y-2">
              {damageRanking.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary w-6">{i + 1}.</span>
                  <span className="text-foreground font-semibold flex-1">{h.name}</span>
                  <span className="text-sm text-muted-foreground">{h.totalDamage} HP</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Editace zabitých bestií */}
      <h3 className="font-display text-lg text-foreground mb-3">Zabitá monstra</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {Object.entries(monsterKills).map(([name, count]) => {
          const monsterData = monsters.find(m => m.name === name);
          return (
          <div key={name} className="bg-card rounded-lg p-4 border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16 rounded-md">
                {monsterData?.image_url ? <AvatarImage src={monsterData.image_url} alt={name} className="object-cover" /> : null}
                <AvatarFallback className="rounded-md text-sm">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <span className="font-semibold text-foreground">{name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-muted-foreground text-sm">Zabito:</span>
                  {editable ? <Input type="number" className="inline-block w-16 h-7 text-xs" value={count}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      updateKills({ ...monsterKills, [name]: val });
                    }} /> : <span className="text-foreground">{count}</span>}
                </div>
              </div>
            </div>
            {editable && <button onClick={() => {
              const k = { ...monsterKills };
              delete k[name];
              updateKills(k);
            }} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>}
          </div>
          );
        })}
      </div>

      {/* Galerie zabitých - na konci */}
      {killEntries.length > 0 && (
        <div>
          <h3 className="font-display text-lg text-foreground mb-3">Galerie zabitých</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {killEntries.map(([name, count]) => {
              const m = monsters.find(x => x.name === name);
              return (
                <Card key={name} className="p-3 flex flex-col items-center text-center">
                  <Avatar className="h-[100px] w-[100px] rounded-md mb-2">
                    {m?.image_url ? <AvatarImage src={m.image_url} alt={name} className="object-cover" /> : null}
                    <AvatarFallback className="rounded-md">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-semibold text-foreground truncate w-full">{name}</p>
                  <p className="text-xs text-primary font-bold">×{count}</p>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
