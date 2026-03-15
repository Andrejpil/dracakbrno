import { useGame } from '@/contexts/GameContext';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useUserRole } from '@/hooks/useUserRole';

export default function StatsPage() {
  const { heroes, monsters, monsterKills, updateKills, updateHeroes } = useGame();
  const { canEdit: canEditPage } = useUserRole();
  const editable = canEditPage('stats');

  const totalKills = Object.values(monsterKills).reduce((a, b) => a + b, 0);

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display text-primary mb-6">Statistika</h2>

      <div className="mb-6">
        <p className="text-lg font-semibold text-foreground">Celkový počet zabitých bestií: <span className="text-primary">{totalKills}</span></p>
      </div>

      <h3 className="font-display text-lg text-foreground mb-3">Hrdinové</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {heroes.map(h => (
          <div key={h.id} className="bg-card rounded-lg p-4 border border-border">
            <h4 className="font-display text-foreground mb-2">{h.name}</h4>
            <div className="flex items-center gap-3 text-sm">
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
                }} />
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-display text-lg text-foreground mb-3">Zabitá monstra</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.entries(monsterKills).map(([name, count]) => {
          const monsterData = monsters.find(m => m.name === name);
          return (
          <div key={name} className="bg-card rounded-lg p-4 border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-[150px] w-[150px] rounded-md">
                {monsterData?.image_url ? <AvatarImage src={monsterData.image_url} alt={name} className="object-cover" /> : null}
                <AvatarFallback className="rounded-md text-sm">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
              <span className="font-semibold text-foreground">{name}</span>
              <span className="text-muted-foreground text-sm ml-2">– Zabito:</span>
              <Input type="number" className="inline-block w-16 h-7 text-xs ml-2" value={count}
                onChange={e => {
                  const val = parseInt(e.target.value) || 0;
                  updateKills({ ...monsterKills, [name]: val });
                }} />
              </div>
            </div>
            <button onClick={() => {
              const k = { ...monsterKills };
              delete k[name];
              updateKills(k);
            }} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
