import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Minus, Trash2, Edit2, Settings, Eye, EyeOff, MapPin } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface MapPoint {
  id: string;
  route_id: string;
  label: string;
  description: string;
  point_type: string;
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
  const [addingPoint, setAddingPoint] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [editPointLabel, setEditPointLabel] = useState<{ routeId: string; pointId: string; label: string; description: string; point_type: string } | null>(null);

  // Pan & zoom state
  const [scale, setScale] = useState(0.5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });

  // Drag point state
  const [draggingPoint, setDraggingPoint] = useState<{ routeId: string; pointId: string } | null>(null);
  const didDragRef = useRef(false);

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
      pointsByRoute[p.route_id].push({ id: p.id, route_id: p.route_id, label: p.label, description: p.description || '', point_type: p.point_type || 'generic', x: p.x, y: p.y, sort_order: p.sort_order });
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

  // Convert client coordinates to map coordinates
  function clientToMap(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }

  // Find point near given map coordinates
  function findPointAt(mapX: number, mapY: number): { routeId: string; pointId: string } | null {
    const hitRadius = 12 / scale; // pixels in map space
    for (const r of routes) {
      if (!r.visible) continue;
      for (const p of r.points) {
        const dist = Math.sqrt((p.x - mapX) ** 2 + (p.y - mapY) ** 2);
        if (dist <= hitRadius) return { routeId: r.id, pointId: p.id };
      }
    }
    return null;
  }

  // Add point on map click
  function handleMapClick(e: React.MouseEvent) {
    // Don't add point if we just finished dragging
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (!addingPoint || !activeRouteId || !imgRef.current) return;
    const coords = clientToMap(e.clientX, e.clientY);
    if (!coords) return;
    addPoint(activeRouteId, coords.x, coords.y);
    setAddingPoint(false);
  }

  async function addPoint(routeId: string, x: number, y: number) {
    if (!user) return;
    const route = routes.find(r => r.id === routeId);
    const sortOrder = route ? route.points.length : 0;
    const { data: row } = await supabase.from('map_points').insert({
      user_id: user.id, route_id: routeId, x, y, sort_order: sortOrder, label: '',
    }).select().single();
    if (row) {
      const pt: MapPoint = { id: row.id, route_id: (row as any).route_id, label: '', description: '', point_type: 'generic', x: (row as any).x, y: (row as any).y, sort_order: (row as any).sort_order };
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
    await supabase.from('map_points').update({
      label: editPointLabel.label,
      description: editPointLabel.description,
      point_type: editPointLabel.point_type,
    }).eq('id', editPointLabel.pointId);
    setRoutes(prev => prev.map(r => r.id === editPointLabel.routeId
      ? { ...r, points: r.points.map(p => p.id === editPointLabel.pointId ? { ...p, label: editPointLabel.label, description: editPointLabel.description, point_type: editPointLabel.point_type } : p) }
      : r));
    setEditPointLabel(null);
  }

  // Save point position after drag
  async function savePointPosition(routeId: string, pointId: string, x: number, y: number) {
    await supabase.from('map_points').update({ x, y }).eq('id', pointId);
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

  // Zoom helper
  const zoomBy = useCallback((factor: number) => {
    setScale(prev => Math.min(5, Math.max(0.05, prev * factor)));
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.97 : 1.03;
    zoomBy(delta);
  }, [zoomBy]);

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return; // only left button

    const coords = clientToMap(e.clientX, e.clientY);

    // If editable and hovering over a point, start dragging the point
    if (editable && coords && !addingPoint) {
      const hit = findPointAt(coords.x, coords.y);
      if (hit) {
        e.preventDefault();
        setDraggingPoint(hit);
        didDragRef.current = false;
        return;
      }
    }

    // Otherwise start panning
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (draggingPoint) {
      // Move the point
      const coords = clientToMap(e.clientX, e.clientY);
      if (!coords) return;
      didDragRef.current = true;
      setRoutes(prev => prev.map(r =>
        r.id === draggingPoint.routeId
          ? { ...r, points: r.points.map(p => p.id === draggingPoint.pointId ? { ...p, x: coords.x, y: coords.y } : p) }
          : r
      ));
      return;
    }
    if (isPanning) {
      setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }

  function handleMouseUp() {
    if (draggingPoint) {
      // Save new position to DB
      const route = routes.find(r => r.id === draggingPoint.routeId);
      const point = route?.points.find(p => p.id === draggingPoint.pointId);
      if (point && didDragRef.current) {
        savePointPosition(draggingPoint.routeId, draggingPoint.pointId, point.x, point.y);
      }
      setDraggingPoint(null);
    }
    setIsPanning(false);
  }

  function handleImgLoad() {
    if (imgRef.current && containerRef.current) {
      const nw = imgRef.current.naturalWidth;
      const nh = imgRef.current.naturalHeight;
      setNaturalSize({ w: nw, h: nh });

      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const fitScale = Math.min(cw / nw, ch / nh, 1);
      setScale(fitScale);
      setOffset({
        x: (cw - nw * fitScale) / 2,
        y: (ch - nh * fitScale) / 2,
      });
    }
  }

  // Determine cursor
  function getCursor(): string {
    if (draggingPoint) return 'grabbing';
    if (addingPoint) return 'crosshair';
    if (isPanning) return 'grabbing';
    return 'grab';
  }

  const activeRoute = routes.find(r => r.id === activeRouteId);
  const activeDistKm = activeRoute ? routeDistanceKm(activeRoute) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Map area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden rounded-lg border border-border bg-card relative select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: getCursor() }}
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
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={naturalSize.w}
            height={naturalSize.h}
            style={{ overflow: 'visible' }}
          >
            {routes.filter(r => r.visible).map(r => (
              <g key={r.id}>
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
                {r.points.map((p) => (
                  <g key={p.id} style={{ pointerEvents: editable ? 'auto' : 'none', cursor: editable ? 'move' : 'default' }}>
                    <circle
                      cx={p.x} cy={p.y} r={6 / scale}
                      fill={r.color} stroke="white" strokeWidth={2 / scale}
                    />
                    {/* Larger invisible hit area for easier grabbing */}
                    <circle
                      cx={p.x} cy={p.y} r={14 / scale}
                      fill="transparent"
                    />
                    {(p.label || p.point_type !== 'generic') && (
                      <text
                        x={p.x + 10 / scale} y={p.y - 10 / scale}
                        fill="white" stroke="black" strokeWidth={3 / scale}
                        paintOrder="stroke"
                        fontSize={14 / scale}
                        fontWeight="bold"
                        style={{ pointerEvents: 'none' }}
                      >
                        {{ city: '🏰', village: '🏠', cave: '🕳️', forest: '🌲', camp: '⛺', ruins: '🏚️', temple: '⛪', tavern: '🍺', generic: '' }[p.point_type] || ''} {p.label}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>

        {/* Zoom buttons */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
          <Button
            size="icon"
            variant="secondary"
            className="h-9 w-9 rounded-md shadow-md"
            onClick={() => zoomBy(1.2)}
            title="Přiblížit"
          >
            <Plus size={18} />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-9 w-9 rounded-md shadow-md"
            onClick={() => zoomBy(0.8)}
            title="Oddálit"
          >
            <Minus size={18} />
          </Button>
        </div>
      </div>

      {/* Bottom panel */}
      <Card className="shrink-0 p-3 mt-2 overflow-auto max-h-[260px]">
        <div className="flex gap-6 flex-wrap">
          {/* Left: routes + actions */}
          <div className="flex flex-col gap-2 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-sm text-primary font-semibold">Trasy</h2>
              {editable && activeRouteId && (
                <Button
                  size="sm"
                  variant={addingPoint ? 'default' : 'outline'}
                  onClick={() => setAddingPoint(!addingPoint)}
                  className="h-7 text-xs"
                >
                  <MapPin size={12} className="mr-1" /> {addingPoint ? 'Klikni na mapu...' : 'Přidat bod'}
                </Button>
              )}
              {editable && <Button size="sm" variant="outline" onClick={addRoute} className="h-7 text-xs"><Plus size={12} className="mr-1" /> Nová trasa</Button>}
              {editable && <Button size="icon" variant="ghost" onClick={() => { setTempSettings(settings); setSettingsOpen(true); }} className="h-7 w-7">
                <Settings size={14} />
              </Button>}
            </div>
            <div className="flex flex-wrap gap-1">
              {routes.map(r => (
                <div
                  key={r.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                    r.id === activeRouteId ? 'bg-secondary text-primary font-semibold' : 'hover:bg-secondary/50 text-foreground'
                  }`}
                  onClick={() => setActiveRouteId(r.id)}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="truncate">{r.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setRoutes(prev => prev.map(x => x.id === r.id ? { ...x, visible: !x.visible } : x)); }}>
                    {r.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  {editable && <>
                    <button onClick={(e) => { e.stopPropagation(); setRenameName(r.name); setRenameOpen(r.id); }}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteRoute(r.id); }} className="text-destructive">
                      <Trash2 size={12} />
                    </button>
                  </>}
                </div>
              ))}
            </div>
          </div>

          {/* Middle: active route info */}
          {activeRoute && (
            <div className="border-l border-border pl-4 min-w-[200px]">
              <h3 className="text-xs font-semibold mb-1" style={{ color: activeRoute.color }}>
                {activeRoute.name}
              </h3>
              <div className="flex gap-4 text-xs text-muted-foreground mb-1">
                <span>Body: {activeRoute.points.length}</span>
                <span>Vzdálenost: {activeDistKm.toFixed(1)} km</span>
              </div>
              {activeDistKm > 0 && (
                <div className="flex gap-4 text-xs">
                  <span>🚶 {formatTime(activeDistKm / settings.speed_walk)}</span>
                  <span>🐴 {formatTime(activeDistKm / settings.speed_horse)}</span>
                  <span>🧹 {formatTime(activeDistKm / settings.speed_broom)}</span>
                </div>
              )}
            </div>
          )}

          {/* Right: points list */}
          {activeRoute && activeRoute.points.length > 0 && (
            <div className="border-l border-border pl-4 flex-1 min-w-[200px] overflow-auto">
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {activeRoute.points.map((p, i) => {
                  let segDist = '';
                  if (i > 0) {
                    const prev = activeRoute.points[i - 1];
                    const px = Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
                    segDist = ` (${(px / settings.pixels_per_km).toFixed(1)} km)`;
                  }
                  const typeIcon = { city: '🏰', village: '🏠', cave: '🕳️', forest: '🌲', camp: '⛺', ruins: '🏚️', temple: '⛪', tavern: '🍺', generic: '📍' }[p.point_type] || '📍';
                  return (
                    <div key={p.id} className="flex items-center gap-1 text-xs" title={p.description || undefined}>
                      <span>{typeIcon}</span>
                      <span className="truncate">{p.label || `Bod ${i + 1}`}{segDist}</span>
                      {editable && <>
                        <button onClick={() => setEditPointLabel({ routeId: activeRoute.id, pointId: p.id, label: p.label, description: p.description, point_type: p.point_type })}>
                          <Edit2 size={10} />
                        </button>
                        <button onClick={() => deletePoint(activeRoute.id, p.id)} className="text-destructive">
                          <Trash2 size={10} />
                        </button>
                      </>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

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
          <DialogHeader><DialogTitle>Upravit bod</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-foreground font-medium">Název</label>
              <Input value={editPointLabel?.label || ''} onChange={e => setEditPointLabel(prev => prev ? { ...prev, label: e.target.value } : null)} />
            </div>
            <div>
              <label className="text-sm text-foreground font-medium">Typ lokace</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editPointLabel?.point_type || 'generic'}
                onChange={e => setEditPointLabel(prev => prev ? { ...prev, point_type: e.target.value } : null)}
              >
                <option value="generic">📍 Obecný</option>
                <option value="city">🏰 Město</option>
                <option value="village">🏠 Vesnice</option>
                <option value="cave">🕳️ Jeskyně</option>
                <option value="forest">🌲 Les</option>
                <option value="camp">⛺ Tábořiště</option>
                <option value="ruins">🏚️ Ruiny</option>
                <option value="temple">⛪ Chrám</option>
                <option value="tavern">🍺 Hospoda</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-foreground font-medium">Popis místa</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editPointLabel?.description || ''}
                onChange={e => setEditPointLabel(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={savePointLabel}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
