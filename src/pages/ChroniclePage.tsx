import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useCalendar } from '@/contexts/CalendarContext';
import { formatGameDate } from '@/lib/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Sparkles, EyeOff, Pencil, Check, X, Search, FileDown, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWorld } from '@/contexts/WorldContext';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

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
  const { activeWorldId } = useWorld();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'staff_only'>('all');
  const [entryDate, setEntryDate] = useState<{ d: number; m: number; y: number } | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [search, setSearch] = useState('');

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editVisibility, setEditVisibility] = useState<'all' | 'staff_only'>('all');
  const [editDate, setEditDate] = useState<{ d: number; m: number; y: number }>({ d: 1, m: 1, y: 657 });

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

  function startEdit(e: Entry) {
    setEditingId(e.id);
    setEditContent(e.content);
    setEditVisibility(e.visibility);
    setEditDate({ d: e.entry_day, m: e.entry_month, y: e.entry_year });
  }

  async function saveEdit(id: string) {
    const { error } = await supabase.from('chronicle_entries' as any).update({
      content: editContent.trim(),
      visibility: isEditor ? editVisibility : 'all',
      entry_day: editDate.d, entry_month: editDate.m, entry_year: editDate.y,
    }).eq('id', id);
    if (error) { toast.error('Chyba: ' + error.message); return; }
    setEditingId(null);
    toast.success('Zápisek upraven');
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

  function exportTxt() {
    if (!summary) return;
    const header = `Kronika – shrnutí ${fromD}.${fromM}.${fromY} – ${toD}.${toM}.${toY} ${calendar?.era_name || ''}\n\n`;
    const blob = new Blob([header + summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kronika_${fromY}-${fromM}-${fromD}_${toY}-${toM}-${toD}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    if (!summary) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 48;
    const maxWidth = pageWidth - margin * 2;
    doc.setFontSize(16);
    doc.text('Kronika – shrnutí období', margin, margin);
    doc.setFontSize(11);
    doc.text(`${fromD}.${fromM}.${fromY} – ${toD}.${toM}.${toY} ${calendar?.era_name || ''}`, margin, margin + 20);
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(summary, maxWidth);
    let y = margin + 50;
    const lineHeight = 15;
    const pageHeight = doc.internal.pageSize.getHeight();
    for (const line of lines) {
      if (y > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    doc.save(`kronika_${fromY}-${fromM}-${fromD}_${toY}-${toM}-${toD}.pdf`);
  }

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(e =>
      e.content.toLowerCase().includes(q) ||
      (e.author_name || '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  const grouped = useMemo(() => {
    const g = new Map<string, Entry[]>();
    filteredEntries.forEach(e => {
      const k = `${e.entry_year}-${e.entry_month}-${e.entry_day}`;
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(e);
    });
    return Array.from(g.entries());
  }, [filteredEntries]);

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
        <div className="flex gap-2 flex-wrap">
          <Button onClick={summarize} disabled={summarizing}>
            {summarizing ? 'Píši kroniku…' : 'Shrnout období'}
          </Button>
          {summary && (
            <>
              <Button variant="outline" onClick={exportTxt}><FileText size={14} className="mr-1" />Stáhnout TXT</Button>
              <Button variant="outline" onClick={exportPdf}><FileDown size={14} className="mr-1" />Stáhnout PDF</Button>
            </>
          )}
        </div>
        {summary && (
          <div className="p-3 bg-muted rounded whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
        )}
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-display text-xl">Zápisky ({filteredEntries.length}{search && ` / ${entries.length}`})</h2>
          <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7"
              placeholder="Hledat v textu nebo autorovi…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {grouped.map(([key, group]) => {
          const [y, m, d] = key.split('-').map(Number);
          return (
            <Card key={key} className="p-4">
              <div className="font-display text-primary mb-2">
                {formatGameDate(d, m, y, calendar?.era_name || '')}
              </div>
              <div className="space-y-3">
                {group.map(e => {
                  const canEdit = user?.id === e.user_id || isEditor;
                  const isEditing = editingId === e.id;
                  return (
                    <div key={e.id} className="border-l-2 border-primary/40 pl-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span className="flex items-center gap-2">
                          <strong className="text-foreground">{e.author_name}</strong>
                          {e.visibility === 'staff_only' && (
                            <span className="flex items-center gap-1 text-accent"><EyeOff size={11} />staff</span>
                          )}
                        </span>
                        {canEdit && !isEditing && (
                          <span className="flex items-center gap-2">
                            <button onClick={() => startEdit(e)} className="text-muted-foreground hover:text-primary"><Pencil size={12} /></button>
                            <button onClick={() => deleteEntry(e.id)} className="text-destructive hover:opacity-70"><Trash2 size={12} /></button>
                          </span>
                        )}
                        {isEditing && (
                          <span className="flex items-center gap-2">
                            <button onClick={() => saveEdit(e.id)} className="text-primary hover:opacity-70"><Check size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:opacity-70"><X size={14} /></button>
                          </span>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-1">
                            <Input type="number" min={1} max={31} value={editDate.d} onChange={ev => setEditDate(p => ({ ...p, d: +ev.target.value }))} />
                            <Input type="number" min={1} max={12} value={editDate.m} onChange={ev => setEditDate(p => ({ ...p, m: +ev.target.value }))} />
                            <Input type="number" value={editDate.y} onChange={ev => setEditDate(p => ({ ...p, y: +ev.target.value }))} />
                          </div>
                          <Textarea rows={4} value={editContent} onChange={ev => setEditContent(ev.target.value)} />
                          {isEditor && (
                            <Select value={editVisibility} onValueChange={(v: any) => setEditVisibility(v)}>
                              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Všichni hráči</SelectItem>
                                <SelectItem value="staff_only">Jen admin/editor</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm whitespace-pre-wrap">{e.content}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
        {filteredEntries.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {search ? 'Nic nenalezeno.' : 'Zatím žádné zápisky.'}
          </p>
        )}
      </div>
    </div>
  );
}
