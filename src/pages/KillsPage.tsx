import { useGame } from '@/contexts/GameContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function KillsPage() {
  const { heroes, monsters, monsterKills } = useGame();

  const killEntries = Object.entries(monsterKills)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);

  const totalKills = killEntries.reduce((s, [, c]) => s + c, 0);

  const barData = killEntries.map(([name, count]) => ({ name, count }));

  const pieData = killEntries.slice(0, 8).map(([name, count]) => ({ name, value: count }));

  // Hero kill rankings
  const heroRanking = [...heroes]
    .sort((a, b) => b.kills - a.kills)
    .filter(h => h.kills > 0);

  // Hero damage rankings
  const damageRanking = [...heroes]
    .sort((a, b) => b.totalDamage - a.totalDamage)
    .filter(h => h.totalDamage > 0);

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display text-primary mb-2">Přehled zabití</h2>
      <p className="text-muted-foreground mb-6">Celkem zabitých bestií: <span className="text-primary font-bold">{totalKills}</span></p>

      {killEntries.length === 0 ? (
        <p className="text-muted-foreground">Zatím žádné zabité bestie.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Bar chart */}
          <Card className="p-4">
            <h3 className="font-display text-foreground mb-3">Zabité bestie</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 35)}>
              <BarChart data={barData} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Pie chart */}
          <Card className="p-4">
            <h3 className="font-display text-foreground mb-3">Poměr zabití</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Monster gallery */}
      {killEntries.length > 0 && (
        <div className="mb-8">
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

      {/* Hero rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </div>
  );
}
