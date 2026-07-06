import { useState } from 'react';
import { ChevronLeft, ChevronRight, Settings, Plus, Trash2 } from 'lucide-react';
import { useCalendar } from '@/contexts/CalendarContext';
import { useUserRole } from '@/hooks/useUserRole';
import { formatGameDate, isDateInRange, MONTH_NAMES } from '@/lib/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

export default function CalendarWidget() {
  const { calendar, specialDays, shift, update, addSpecialDay, deleteSpecialDay } = useCalendar();
  const { isEditor } = useUserRole();
  const [editorOpen, setEditorOpen] = useState(false);

  if (!calendar) {
    return (
      <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3 mb-4 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  const activeSpecials = specialDays.filter(sd =>
    isDateInRange(calendar.current_day, calendar.current_month, calendar.current_year,
      sd.start_day, sd.start_month, sd.end_day, sd.end_month, sd.recurring ? null : sd.year)
  );

  return (
    <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Kalendář</span>
        {isEditor && (
          <button onClick={() => setEditorOpen(true)} className="text-muted-foreground hover:text-primary">
            <Settings size={12} />
          </button>
        )}
      </div>
      <div className="text-xs text-sidebar-accent-foreground font-semibold leading-tight mb-2">
        {formatGameDate(calendar.current_day, calendar.current_month, calendar.current_year, calendar.era_name)}
      </div>
      {isEditor && (
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="flex-1 flex items-center justify-center py-1 rounded bg-sidebar-accent hover:bg-sidebar-accent/80">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => shift(1)} className="flex-1 flex items-center justify-center py-1 rounded bg-sidebar-accent hover:bg-sidebar-accent/80">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      {activeSpecials.length > 0 && (
        <div className="mt-2 space-y-1">
          {activeSpecials.map(sd => (
            <div key={sd.id} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: sd.color + '30', color: sd.color }}>
              ★ {sd.name}
            </div>
          ))}
        </div>
      )}

      {isEditor && (
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nastavení kalendáře</DialogTitle></DialogHeader>
            <CalendarEditor
              calendar={calendar}
              specialDays={specialDays}
              onUpdate={update}
              onAdd={addSpecialDay}
              onDelete={deleteSpecialDay}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CalendarEditor({ calendar, specialDays, onUpdate, onAdd, onDelete }: any) {
  const [year, setYear] = useState(calendar.current_year);
  const [month, setMonth] = useState(calendar.current_month);
  const [day, setDay] = useState(calendar.current_day);
  const [era, setEra] = useState(calendar.era_name);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#d97706');
  const [sm, setSm] = useState(1); const [sd, setSd] = useState(1);
  const [em, setEm] = useState(1); const [ed, setEd] = useState(1);
  const [recurring, setRecurring] = useState(true);
  const [specYear, setSpecYear] = useState(calendar.current_year);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Aktuální datum</h3>
        <div className="grid grid-cols-4 gap-2">
          <div><Label className="text-xs">Den</Label><Input type="number" min={1} max={31} value={day} onChange={e => setDay(+e.target.value)} /></div>
          <div><Label className="text-xs">Měsíc</Label><Input type="number" min={1} max={12} value={month} onChange={e => setMonth(+e.target.value)} /></div>
          <div><Label className="text-xs">Rok</Label><Input type="number" value={year} onChange={e => setYear(+e.target.value)} /></div>
          <div className="col-span-4"><Label className="text-xs">Éra</Label><Input value={era} onChange={e => setEra(e.target.value)} /></div>
        </div>
        <Button onClick={() => onUpdate({ current_day: day, current_month: month, current_year: year, era_name: era })}>Uložit datum</Button>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="font-semibold text-sm">Přidat speciální den</h3>
        <Input placeholder="Název (např. Slavnost hodů)" value={newName} onChange={e => setNewName(e.target.value)} />
        <Textarea placeholder="Popis" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
        <div className="flex gap-2 items-center">
          <Label className="text-xs">Barva</Label>
          <Input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-16 h-8" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Od (den/měsíc)</Label>
            <div className="flex gap-1">
              <Input type="number" min={1} max={31} value={sd} onChange={e => setSd(+e.target.value)} />
              <Input type="number" min={1} max={12} value={sm} onChange={e => setSm(+e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Do (den/měsíc)</Label>
            <div className="flex gap-1">
              <Input type="number" min={1} max={31} value={ed} onChange={e => setEd(+e.target.value)} />
              <Input type="number" min={1} max={12} value={em} onChange={e => setEm(+e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="recurring" checked={recurring} onCheckedChange={c => setRecurring(!!c)} />
          <Label htmlFor="recurring" className="text-xs">Opakuje se každý rok</Label>
        </div>
        {!recurring && (
          <div><Label className="text-xs">Rok</Label><Input type="number" value={specYear} onChange={e => setSpecYear(+e.target.value)} /></div>
        )}
        <Button onClick={async () => {
          if (!newName) return;
          await onAdd({
            name: newName, description: newDesc || null, color: newColor,
            start_month: sm, start_day: sd, end_month: em, end_day: ed,
            recurring, year: recurring ? null : specYear,
          });
          setNewName(''); setNewDesc('');
        }}><Plus size={14} className="mr-1" />Přidat</Button>
      </div>

      <div className="space-y-2 border-t pt-4">
        <h3 className="font-semibold text-sm">Speciální dny ({specialDays.length})</h3>
        {specialDays.map((sd: any) => (
          <div key={sd.id} className="flex items-center justify-between p-2 rounded bg-muted">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: sd.color }} />
              <div className="text-sm">
                <div className="font-medium">{sd.name}</div>
                <div className="text-xs text-muted-foreground">
                  {sd.start_day}.{sd.start_month}. – {sd.end_day}.{sd.end_month}. {sd.recurring ? '(každoročně)' : `(${sd.year})`}
                </div>
              </div>
            </div>
            <button onClick={() => onDelete(sd.id)} className="text-destructive hover:opacity-70"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
