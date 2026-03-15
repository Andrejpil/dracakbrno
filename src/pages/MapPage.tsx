import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, Settings, Eye, EyeOff, MapPin } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface MapPoint {
  id: string;
  route_id: string;
  label: string;
  x: number;
  y: number;
  sort_order: number;
}

interface MapRoute {
  id: string;
  name: string;
  color: string;
  points: MapPoint[];
  visible: boolean;
}

interface MapSettings {
  pixels_per_km: number;
  speed_walk: number;
  speed_horse: number;
  speed_broom: number;
}

const DEFAULT_SETTINGS: MapSettings = {
  pixels_per_km: 10,
  speed_walk: 5,
  speed_horse: 15,
  speed_broom: 40,
};

const ROUTE_COLORS = ['#ff0000', '#00cc44', '#3388ff', '#ff8800', '#cc00ff', '#ffdd00', '#00cccc', '#ff4488'];

export default function MapPage() {
  const { user } = useAuth();
  const { canEdit: canEditPage } = useUserRole();
  const editable = canEditPage('map');
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [editPointLabel, setEditPointLabel] = useState<{ routeId: string; pointId: string; label: string } | null>(null);

  // Pan & zoom state
  const [scale, setScale] = useState(0.5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });

  // Temp settings form
  const [tempSettings, setTempSettings] = useState<MapSettings>(DEFAULT_SETTINGS);

  // Load data
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    const [rRes, pRes, sRes] = await Promise.all([
      supabase.from('map_routes').select('*').order('created_at'),
      supabase.from('map_points').select('*').order('sort_order'),
      supabase.from('map_settings').select('*').eq('user_id', user!.id).maybeSingle(),
    ]);

    const pointsByRoute: Record<string, MapPoint[]> = {};
    (pRes.data || []).forEach((p: any) => {
      if (!pointsByRoute[p.route_id]) pointsByRoute[p.route_id] = [];
      pointsByRoute[p.route_id].push({ id: p.id, route_id: p.route_id, label: p.label, x: p.x, y: p.y, sort_order: p.sort_order });
    });

    const loadedRoutes: MapRoute[] = (rRes.data || []).map((r: any) => ({
      id: r.id, name: r.name, color: r.color,
      points: (pointsByRoute[r.id] || []).sort((a: MapPoint, b: MapPoint) => a.sort_order - b.sort_order),
      visible: true,
    }));
    setRoutes(loadedRoutes);
    if (loadedRoutes.length > 0 && !activeRouteId) setActiveRouteId(loadedRoutes[0].id);

    if (sRes.data) {
      const s = sRes.data as any;
      setSettings({ pixels_per_km: s.pixels_per_km, speed_walk: s.speed_walk, speed_horse: s.speed_horse, speed_broom: s.speed_broom });
    }
  }

  // Save settings
  async function saveSettings() {
    if (!user) return;
    await supabase.from('map_settings').upsert({
      user_id: user.id, ...tempSettings,
    }, { onConflict: 'user_id' });
    setSettings(tempSettings);
    setSettingsOpen(false);
    toast({ title: 'Nastavení uloženo' });
  }

  // Add route
  async function addRoute() {
    if (!user) return;
    const color = ROUTE_COLORS[routes.length % ROUTE_COLORS.length];
    const { data: row } = await supabase.from('map_routes').insert({
      user_id: user.id, name: `Trasa ${routes.length + 1}`, color,
    }).select().single();
    if (row) {
      const newRoute: MapRoute = { id: row.id, name: (row as any).name, color: (row as any).color, points: [], visible: true };
      setRoutes(prev => [...prev, newRoute]);
      setActiveRouteId(row.id);
    }
  }

  // Delete route
  async function deleteRoute(routeId: string) {
    await supabase.from('map_routes').delete().eq('id', routeId);
    setRoutes(prev => prev.filter(r => r.id !== routeId));
    if (activeRouteId === routeId) setActiveRouteId(routes.find(r => r.id !== routeId)?.id || null);
  }

  // Rename route
  async function renameRoute() {
    if (!renameOpen) return;
    await supabase.from('map_routes').update({ name: renameName }).eq('id', renameOpen);
    setRoutes(prev => prev.map(r => r.id === renameOpen ? { ...r, name: renameName } : r));
    setRenameOpen(null);
  }

  // Add point on map click
  function handleMapClick(e: React.MouseEvent) {
    if (!activeRouteId || !imgRef.current || isPanning) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    addPoint(activeRouteId, x, y);
  }

  async function addPoint(routeId: string, x: number, y: number) {
    if (!user) return;
    const route = routes.find(r => r.id === routeId);
    const sortOrder = route ? route.points.length : 0;
    const { data: row } = await supabase.from('map_points').insert({
      user_id: user.id, route_id: routeId, x, y, sort_order: sortOrder, label: '',
    }).select().single();
    if (row) {
      const pt: MapPoint = { id: row.id, route_id: (row as any).route_id, label: '', x: (row as any).x, y: (row as any).y, sort_order: (row as any).sort_order };
      setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, points: [...r.points, pt] } : r));
    }
  }

  // Delete point
  async function deletePoint(routeId: string, pointId: string) {
    await supabase.from('map_points').delete().eq('id', pointId);
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, points: r.points.filter(p => p.id !== pointId) } : r));
  }

  // Update point label
  async function savePointLabel() {
    if (!editPointLabel) return;
    await supabase.from('map_points').update({ label: editPointLabel.label }).eq('id', editPointLabel.pointId);
    setRoutes(prev => prev.map(r => r.id === editPointLabel.routeId
      ? { ...r, points: r.points.map(p => p.id === editPointLabel.pointId ? { ...p, label: editPointLabel.label } : p) }
      : r));
    setEditPointLabel(null);
  }

  // Distance calculation
  function routeDistanceKm(route: MapRoute): number {
    let totalPx = 0;
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i];
      totalPx += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }
    return settings.pixels_per_km > 0 ? totalPx / settings.pixels_per_km : 0;
  }

  function formatTime(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h >= 24) {
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return `${d}d ${rh}h ${m}m`;
    }
    return `${h}h ${m}m`;
  }

  // Pan & zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(5, Math.max(0.1, prev * delta)));
  }, []);

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }

  function handleMouseUp() {
    setIsPanning(false);
  }

  function handleImgLoad() {
    if (imgRef.current) {
      setNaturalSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  }

  const activeRoute = routes.find(r => r.id === activeRouteId);
  const activeDistKm = activeRoute ? routeDistanceKm(activeRoute) : 0;

  return (
    <div className="flex gap-4 h-[calc(100vh-3rem)]">
      {/* Sidebar panel */}
      <Card className="w-72 shrink-0 p-4 flex flex-col gap-3 overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-primary">Mapa</h2>
          {editable && <Button size="icon" variant="ghost" onClick={() => { setTempSettings(settings); setSettingsOpen(true); }}>
            <Settings size={18} />
          </Button>}
        </div>

        {/* Routes list */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Trasy</span>
          {editable && <Button size="sm" variant="outline" onClick={addRoute}><Plus size={14} className="mr-1" /> Nová</Button>}
        </div>

        <div className="flex flex-col gap-1">
          {routes.map(r => (
            <div
              key={r.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                r.id === activeRouteId ? 'bg-secondary text-primary font-semibold' : 'hover:bg-secondary/50 text-foreground'
              }`}
              onClick={() => setActiveRouteId(r.id)}
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
              <span className="truncate flex-1">{r.name}</span>
              <button onClick={(e) => { e.stopPropagation(); setRoutes(prev => prev.map(x => x.id === r.id ? { ...x, visible: !x.visible } : x)); }}>
                {r.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              {editable && <>
                <button onClick={(e) => { e.stopPropagation(); setRenameName(r.name); setRenameOpen(r.id); }}>
                  <Edit2 size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteRoute(r.id); }} className="text-destructive">
                  <Trash2 size={14} />
                </button>
              </>}
            </div>
          ))}
        </div>

        {/* Active route info */}
        {activeRoute && (
          <div className="border-t border-border pt-3 mt-2">
            <h3 className="text-sm font-semibold text-foreground mb-2" style={{ color: activeRoute.color }}>
              {activeRoute.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-1">Body: {activeRoute.points.length}</p>
            <p className="text-xs text-muted-foreground mb-3">Vzdálenost: {activeDistKm.toFixed(1)} km</p>

            {activeDistKm > 0 && (
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between"><span>🚶 Pěšky ({settings.speed_walk} km/h)</span><span>{formatTime(activeDistKm / settings.speed_walk)}</span></div>
                <div className="flex justify-between"><span>🐴 Na koni ({settings.speed_horse} km/h)</span><span>{formatTime(activeDistKm / settings.speed_horse)}</span></div>
                <div className="flex justify-between"><span>🧹 Na koštěti ({settings.speed_broom} km/h)</span><span>{formatTime(activeDistKm / settings.speed_broom)}</span></div>
              </div>
            )}

            {/* Points list */}
            <div className="mt-3 flex flex-col gap-1">
              {activeRoute.points.map((p, i) => {
                let segDist = '';
                if (i > 0) {
                  const prev = activeRoute.points[i - 1];
                  const px = Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
                  segDist = ` (${(px / settings.pixels_per_km).toFixed(1)} km)`;
                }
                return (
                  <div key={p.id} className="flex items-center gap-1 text-xs">
                    <MapPin size={12} style={{ color: activeRoute.color }} />
                    <span className="flex-1 truncate">{p.label || `Bod ${i + 1}`}{segDist}</span>
                    {editable && <>
                      <button onClick={() => setEditPointLabel({ routeId: activeRoute.id, pointId: p.id, label: p.label })}>
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => deletePoint(activeRoute.id, p.id)} className="text-destructive">
                        <Trash2 size={12} />
                      </button>
                    </>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-auto">
          Kliknutím na mapu přidáte bod. Alt+táhnutí = posun. Kolečko = zoom.
        </p>
      </Card>

      {/* Map area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden rounded-lg border border-border bg-card relative select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
      >
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
          <img
            ref={imgRef}
            src="/images/map-othion.jpg"
            alt="Mapa Othion"
            onLoad={handleImgLoad}
            onClick={handleMapClick}
            className="block max-w-none"
            draggable={false}
          />

          {/* SVG overlay for lines and points */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={naturalSize.w}
            height={naturalSize.h}
            style={{ overflow: 'visible' }}
          >
            {routes.filter(r => r.visible).map(r => (
              <g key={r.id}>
                {/* Lines */}
                {r.points.length > 1 && (
                  <polyline
                    points={r.points.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={r.color}
                    strokeWidth={3 / scale}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.8}
                  />
                )}
                {/* Points */}
                {r.points.map((p, i) => (
                  <g key={p.id}>
                    <circle
                      cx={p.x} cy={p.y} r={6 / scale}
                      fill={r.color} stroke="white" strokeWidth={2 / scale}
                    />
                    {p.label && (
                      <text
                        x={p.x + 10 / scale} y={p.y - 10 / scale}
                        fill="white" stroke="black" strokeWidth={3 / scale}
                        paintOrder="stroke"
                        fontSize={14 / scale}
                        fontWeight="bold"
                      >
                        {p.label}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nastavení mapy</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-foreground">Pixelů na 1 km</label>
              <Input type="number" value={tempSettings.pixels_per_km} onChange={e => setTempSettings(s => ({ ...s, pixels_per_km: +e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-foreground">Rychlost pěšky (km/h)</label>
              <Input type="number" value={tempSettings.speed_walk} onChange={e => setTempSettings(s => ({ ...s, speed_walk: +e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-foreground">Rychlost na koni (km/h)</label>
              <Input type="number" value={tempSettings.speed_horse} onChange={e => setTempSettings(s => ({ ...s, speed_horse: +e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-foreground">Rychlost na koštěti (km/h)</label>
              <Input type="number" value={tempSettings.speed_broom} onChange={e => setTempSettings(s => ({ ...s, speed_broom: +e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveSettings}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename route dialog */}
      <Dialog open={!!renameOpen} onOpenChange={() => setRenameOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Přejmenovat trasu</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={e => setRenameName(e.target.value)} />
          <DialogFooter>
            <Button onClick={renameRoute}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit point label dialog */}
      <Dialog open={!!editPointLabel} onOpenChange={() => setEditPointLabel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pojmenovat bod</DialogTitle></DialogHeader>
          <Input value={editPointLabel?.label || ''} onChange={e => setEditPointLabel(prev => prev ? { ...prev, label: e.target.value } : null)} />
          <DialogFooter>
            <Button onClick={savePointLabel}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
