import { useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { exportCSV, Hero, Monster, BattleMonster } from '@/lib/gameData';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';

export default function ExportPage() {
  const { heroes, monsters, battleMonsters, setAllData } = useGame();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const csv = exportCSV(heroes, monsters, battleMonsters);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'draci-doupe-data.csv';
    a.click();
  };

  const handleImport = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const newHeroes: Hero[] = [];
      const newMonsters: Monster[] = [];
      const newBattle: BattleMonster[] = [];

      lines.slice(1).forEach(line => {
        const c = line.split(',');
        if (c[0] === 'hero') {
          newHeroes.push({ id: crypto.randomUUID(), name: c[1], race: c[2] as any, profession: c[3], specialization: c[4], experience: parseInt(c[5]) || 0, kills: parseInt(c[19]) || 0, totalDamage: parseInt(c[20]) || 0 });
        } else if (c[0] === 'monster') {
          newMonsters.push({ id: crypto.randomUUID(), name: c[1], str: parseInt(c[7]) || 0, con: parseInt(c[8]) || 0, dex: parseInt(c[9]) || 0, int: parseInt(c[10]) || 0, cha: parseInt(c[11]) || 0, hp: parseInt(c[12]) || 0, mp: parseInt(c[13]) || 0, attack: parseInt(c[14]) || 0, defense: parseInt(c[15]) || 0, xp_reward: parseInt(c[16]) || 0, special: c[17] || '' });
        } else if (c[0] === 'battleMonster') {
          newBattle.push({ id: crypto.randomUUID(), battleId: crypto.randomUUID(), name: c[1], str: parseInt(c[7]) || 0, con: parseInt(c[8]) || 0, dex: parseInt(c[9]) || 0, int: parseInt(c[10]) || 0, cha: parseInt(c[11]) || 0, hp: parseInt(c[12]) || 0, mp: parseInt(c[13]) || 0, attack: parseInt(c[14]) || 0, defense: parseInt(c[15]) || 0, xp_reward: parseInt(c[16]) || 0, special: c[17] || '', currentHP: parseInt(c[18]) || 0, currentMP: parseInt(c[19]) || 0 });
        }
      });

      setAllData(newHeroes, newMonsters, newBattle);
      alert('Data importována!');
    };
    reader.readAsText(file);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display text-primary mb-6">Export / Import</h2>
      <div className="space-y-6 max-w-md">
        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="font-display text-foreground mb-3">Export do CSV</h3>
          <p className="text-sm text-muted-foreground mb-4">Stáhne všechna data (hrdinové, bestiář, boj) jako CSV soubor.</p>
          <Button onClick={handleExport}><Download size={16} className="mr-2" /> Exportovat</Button>
        </div>
        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="font-display text-foreground mb-3">Import z CSV</h3>
          <p className="text-sm text-muted-foreground mb-4">Nahraje data z CSV souboru. Stávající data budou přepsána!</p>
          <input ref={fileRef} type="file" accept=".csv" className="block text-sm text-muted-foreground mb-3 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground hover:file:bg-primary/90" />
          <Button variant="secondary" onClick={handleImport}><Upload size={16} className="mr-2" /> Importovat</Button>
        </div>
      </div>
    </div>
  );
}
