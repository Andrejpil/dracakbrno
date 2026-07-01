import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useCalendar } from '@/contexts/CalendarContext';
import { formatGameDate, MONTH_NAMES } from '@/lib/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Trash2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface Entry {
  id: string;
  user_id: string;
  author_name: string | null;
  entry_year: number;
  entry_month: number;
  entry_day: number;
  content: string;
  visibility: 'all' | 'staff_only';
  created_at: string;
}

export default function ChroniclePage() {
  const { user } = useAuth();
  const { isEditor } = useUserRole();
  const { calendar } = useCalendar();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'staff_only'>('all');
  const [entryDate, setEntryDate] = useState<{ d: number; m: number; y: number } | null>(null);
  const [authorName, setAuthorName] = useState('');

  // summarizer range
  const [fromD, setFromD] = useState(1); const [fromM, setFromM] = useState(1); const [fromY, setFromY] = useState(657);
  const [toD, setToD] = useState(31); const [toM, setToM] = useState(12); const [toY, setToY] = useState(657);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    if (calendar && !entryDate) {
      setEntryDate({ d: calendar.current_day, m: calendar.current_month, y: calendar.current_year });
      setFromY(calendar.current_year); setToY(calendar.current_year);
    }
  }, [calendar]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('chronicle_entries' as any)
      .select('*')
      .order('entry_year', { ascending: false })
      .order('entry_month', { ascending: false })
      .order('entry_day', { ascending: false })
      .order('created_at', { ascending: false });
    setEntries((data as any) || []);
  }

  async function addEntry() {
    if (!user || !content.trim() || !entryDate) return;
    const { error } = await supabase.from('chronicle_entries' as any).insert({
      user_id: user.id,
      author_name: authorName || user.email?.split('@')[0] || 'Neznámý',
      entry_year: entryDate.y, entry_month: entryDate.m, entry_day: entryDate.d,
      content: content.trim(),
      visibility: isEditor ? visibility : 'all',
    });
    if (error) { toast.error('Nepodařilo se uložit: ' + error.message); return; }
    setContent('');
    toast.success('Zápisek uložen');
    load();
  }

  async function deleteEntry(id: string) {
    await supabase.from('chronicle_entries' as any).delete().eq('id', id);
    load();
  }

  async function summarize() {
    setSummarizing(true); setSummary(null);
    const filtered = entries.filter(e => {
      const cur = e.entry_year * 10000 + e.entry_month * 100 + e.entry_day;
      const f = fromY * 10000 + fromM * 100 + fromD;
      const t = toY * 10000 + toM * 100 + toD;
      return cur >= f && cur <= t;
    }).slice().reverse();

    const { data, error } = await supabase.functions.invoke('chronicle-summarize', {
      body: {
        entries: filtered,
        from: `${fromD}.${fromM}.${fromY}`,
        to: `${toD}.${toM}.${toY}`,
        era: calendar?.era_name || '',
      },
    });
    setSummarizing(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    setSummary((data as any)?.summary || 'Bez odpovědi.');
  }

  const grouped = useMemo(() => {
    const g = new Map<string, Entry[]>();
    entries.forEach(e => {
      const k = `${e.entry_year}-${e.entry_month}-${e.entry_day}`;
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(e);
    });
    return Array.from(g.entries());
  }, [entries]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-display text-primary">Kronika</h1>

      <Card className="p-4 space-y-3">
        <h2 className="font-display text-lg">Nový zápisek</h2>
        <div className="grid grid-cols-4 gap-2">
          <div><Label className="text-xs">Den</Label><Input type="number" min={1} max={31} value={entryDate?.d ?? 1} onChange={e => setEntryDate(p => p ? { ...p, d: +e.target.value } : p)} /></div>
          <div><Label className="text-xs">Měsíc</Label><Input type="number" min={1} max={12} value={entryDate?.m ?? 1} onChange={e => setEntryDate(p => p ? { ...p, m: +e.target.value } : p)} /></div>
          <div><Label className="text-xs">Rok</Label><Input type="number" value={entryDate?.y ?? 657} onChange={e => setEntryDate(p => p ? { ...p, y: +e.target.value } : p)} /></div>
          <div><Label className="text-xs">Autor</Label><Input placeholder="jméno postavy" value={authorName} onChange={e => setAuthorName(e.target.value)} /></div>
        </div>
        <Textarea rows={4} placeholder="Co se dnes odehrálo…" value={content} onChange={e => setContent(e.target.value)} />
        {isEditor && (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Viditelnost:</Label>
            <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všichni hráči</SelectItem>
                <SelectItem value="staff_only">Jen admin/editor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button onClick={addEntry} disabled={!content.trim()}>Uložit zápisek</Button>
      </Card>

      <Card className="p-4 space-y-3 border-primary/40">
        <h2 className="font-display text-lg flex items-center gap-2"><Sparkles size={18} className="text-primary" />AI shrnutí období</h2>
        <div className="grid grid-cols-6 gap-2 items-end">
          <div className="col-span-3"><Label className="text-xs">Od</Label>
            <div className="flex gap-1">
              <Input type="number" value={fromD} onChange={e => setFromD(+e.target.value)} />
              <Input type="number" value={fromM} onChange={e => setFromM(+e.target.value)} />
              <Input type="number" value={fromY} onChange={e => setFromY(+e.target.value)} />
            </div>
          </div>
          <div className="col-span-3"><Label className="text-xs">Do</Label>
            <div className="flex gap-1">
              <Input type="number" value={toD} onChange={e => setToD(+e.target.value)} />
              <Input type="number" value={toM} onChange={e => setToM(+e.target.value)} />
              <Input type="number" value={toY} onChange={e => setToY(+e.target.value)} />
            </div>
          </div>
        </div>
        <Button onClick={summarize} disabled={summarizing}>
          {summarizing ? 'Píši kroniku…' : 'Shrnout období'}
        </Button>
        {summary && (
          <div className="p-3 bg-muted rounded whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
        )}
      </Card>

      <div className="space-y-4">
        <h2 className="font-display text-xl">Zápisky ({entries.length})</h2>
        {grouped.map(([key, group]) => {
          const [y, m, d] = key.split('-').map(Number);
          return (
            <Card key={key} className="p-4">
              <div className="font-display text-primary mb-2">
                {formatGameDate(d, m, y, calendar?.era_name || '')}
              </div>
              <div className="space-y-3">
                {group.map(e => (
                  <div key={e.id} className="border-l-2 border-primary/40 pl-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="flex items-center gap-2">
                        <strong className="text-foreground">{e.author_name}</strong>
                        {e.visibility === 'staff_only' && (
                          <span className="flex items-center gap-1 text-accent"><EyeOff size={11} />staff</span>
                        )}
                      </span>
                      {(user?.id === e.user_id || isEditor) && (
                        <button onClick={() => deleteEntry(e.id)} className="text-destructive hover:opacity-70"><Trash2 size={12} /></button>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{e.content}</div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
        {entries.length === 0 && <p className="text-muted-foreground text-sm">Zatím žádné zápisky.</p>}
      </div>
    </div>
  );
}
