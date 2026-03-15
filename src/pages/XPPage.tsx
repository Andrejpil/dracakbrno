import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { getHeroLevel, getXPForNextLevel } from '@/lib/gameData';
import { Trash2, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';

export default function XPPage() {
  const { heroes, xpArchive, addXP, deleteXP, updateXP } = useGame();
  const { canEdit: canEditPage } = useUserRole();
  const editable = canEditPage('xp');
  const [inputs, setInputs] = useState<Record<string, { amount: string; note: string }>>({});

  const getInput = (id: string) => inputs[id] || { amount: '', note: '' };
  const setInput = (id: string, u: Partial<{ amount: string; note: string }>) =>
    setInputs(prev => ({ ...prev, [id]: { ...getInput(id), ...u } }));

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display text-primary mb-6">Zkušenosti</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {heroes.map(h => {
          const records = xpArchive[h.id] || [];
          const inp = getInput(h.id);
          return (
            <div key={h.id} className="bg-card rounded-lg p-4 border border-border">
              <h3 className="font-display text-lg text-foreground mb-1">{h.name}</h3>
              <p className="text-sm text-muted-foreground mb-1">Úroveň: <span className="text-primary font-bold">{getHeroLevel(h.experience)}</span></p>
              <p className="text-sm text-muted-foreground mb-3">Celkové XP: <span className="text-primary font-semibold">{h.experience}</span>
                {(() => { const next = getXPForNextLevel(h.experience); return next ? <span className="text-xs"> / {next.next}</span> : null; })()}
              </p>
              {editable && <div className="flex gap-2 mb-3">
                <Input type="number" placeholder="XP" className="h-8 text-xs w-20" value={inp.amount}
                  onChange={e => setInput(h.id, { amount: e.target.value })} />
                <Input placeholder="Poznámka" className="h-8 text-xs" value={inp.note}
                  onChange={e => setInput(h.id, { note: e.target.value })} />
                <Button size="sm" className="h-8 text-xs" onClick={() => {
                  addXP(h.id, parseInt(inp.amount) || 0, inp.note);
                  setInput(h.id, { amount: '', note: '' });
                }}>+</Button>
              </div>}
              {records.length > 0 && (
                <div className="bg-muted rounded-md p-2 max-h-40 overflow-auto space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Archiv:</p>
                  {records.map((r, idx) => (
                    <XPRecordRow key={idx} heroId={h.id} idx={idx} amount={r.amount} note={r.note} onDelete={deleteXP} onUpdate={updateXP} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function XPRecordRow({ heroId, idx, amount, note, onDelete, onUpdate }: {
  heroId: string; idx: number; amount: number; note: string;
  onDelete: (id: string, idx: number) => void;
  onUpdate: (id: string, idx: number, amount: number, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState(amount);
  const [n, setN] = useState(note);

  if (!editing) {
    return (
      <div className="flex items-center justify-between text-xs gap-1">
        <span><span className="text-primary">{amount} XP</span> {note && <span className="text-muted-foreground">– {note}</span>}</span>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-primary"><Save size={12} /></button>
          <button onClick={() => onDelete(heroId, idx)} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      <Input type="number" className="h-6 text-xs w-14" value={a} onChange={e => setA(parseInt(e.target.value) || 0)} />
      <Input className="h-6 text-xs" value={n} onChange={e => setN(e.target.value)} />
      <button onClick={() => { onUpdate(heroId, idx, a, n); setEditing(false); }} className="text-primary"><Save size={12} /></button>
    </div>
  );
}
