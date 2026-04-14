import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Minus, Trash2, Edit2, Settings, Eye, EyeOff, MapPin, Star, Route, Map } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

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

interface SpecialPoint {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  visible_to_viewers: boolean;
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
  const { canEdit: canEditPage, isAdmin, isEditor, role } = useUserRole();
  const editable = canEditPage('map');
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [addingPoint, setAddingPoint] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [routesDialogOpen, setRoutesDialogOpen] = useState(false);
  const [specialPointsDialogOpen, setSpecialPointsDialogOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [editPointLabel, setEditPointLabel] = useState<{ routeId: string; pointId: string; label: string; description: string; point_type: string } | null>(null);

  // Special points state
  const [specialPoints, setSpecialPoints] = useState<SpecialPoint[]>([]);
  const [showSpecialPoints, setShowSpecialPoints] = useState(true);
  const [addingSpecialPoint, setAddingSpecialPoint] = useState(false);
  const [editSpecialPoint, setEditSpecialPoint] = useState<SpecialPoint | null>(null);
  const [viewSpecialPoint, setViewSpecialPoint] = useState<SpecialPoint | null>(null);

  // Pan & zoom state
  const [scale, setScale] = useState(0.5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });

  // Drag point state
  const [draggingPoint, setDraggingPoint] = useState<{ routeId: string; pointId: string } | null>(null);
  const [draggingSpecialPoint, setDraggingSpecialPoint] = useState<string | null>(null);
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
    const [rRes, pRes, sRes, spRes] = await Promise.all([
      supabase.from('map_routes').select('*').order('created_at'),
      supabase.from('map_points').select('*').order('sort_order'),
      supabase.from('map_settings').select('*').eq('user_id', user!.id).maybeSingle(),
      supabase.from('special_map_points').select('*').order('created_at'),
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

    // Load special points
    const allSp: SpecialPoint[] = (spRes.data || []).map((sp: any) => ({
      id: sp.id, name: sp.name, description: sp.description, x: sp.x, y: sp.y, visible_to_viewers: sp.visible_to_viewers,
    }));
    setSpecialPoints(allSp);
  }

  // Filter special points based on role
  const visibleSpecialPoints = specialPoints.filter(sp => {
    if (isAdmin || isEditor) return true;
    return sp.visible_to_viewers;
  });

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
    const hitRadius = 12 / scale;
    for (const r of routes) {
      if (!r.visible) continue;
      for (const p of r.points) {
        const dist = Math.sqrt((p.x - mapX) ** 2 + (p.y - mapY) ** 2);
        if (dist <= hitRadius) return { routeId: r.id, pointId: p.id };
      }
    }
    return null;
  }

  // Find special point near coordinates
  function findSpecialPointAt(mapX: number, mapY: number): string | null {
    if (!showSpecialPoints) return null;
    const hitRadius = 14 / scale;
    for (const sp of visibleSpecialPoints) {
      const dist = Math.sqrt((sp.x - mapX) ** 2 + (sp.y - mapY) ** 2);
      if (dist <= hitRadius) return sp.id;
    }
    return null;
  }

  // Add point on map click
  function handleMapClick(e: React.MouseEvent) {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    const coords = clientToMap(e.clientX, e.clientY);
    if (!coords) return;

    // Check if clicking on a special point to view it
    if (!addingPoint && !addingSpecialPoint) {
      const spId = findSpecialPointAt(coords.x, coords.y);
      if (spId) {
        const sp = visibleSpecialPoints.find(s => s.id === spId);
        if (sp) {
          setViewSpecialPoint(sp);
          setSpecialPointsDialogOpen(true);
        }
        return;
      }
    }

    // Adding special point
    if (addingSpecialPoint && editable) {
      addSpecialPoint(coords.x, coords.y);
      setAddingSpecialPoint(false);
      return;
    }

    if (!addingPoint || !activeRouteId || !imgRef.current) return;
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

  // Special points CRUD
  async function addSpecialPoint(x: number, y: number) {
    if (!user) return;
    const { data: row } = await supabase.from('special_map_points').insert({
      user_id: user.id, x, y, name: 'Nový bod', description: '', visible_to_viewers: false,
    }).select().single();
    if (row) {
      const sp: SpecialPoint = { id: row.id, name: (row as any).name, description: (row as any).description, x: (row as any).x, y: (row as any).y, visible_to_viewers: (row as any).visible_to_viewers };
      setSpecialPoints(prev => [...prev, sp]);
      setEditSpecialPoint(sp);
    }
  }

  async function saveSpecialPoint() {
    if (!editSpecialPoint) return;
    await supabase.from('special_map_points').update({
      name: editSpecialPoint.name,
      description: editSpecialPoint.description,
      visible_to_viewers: editSpecialPoint.visible_to_viewers,
    }).eq('id', editSpecialPoint.id);
    setSpecialPoints(prev => prev.map(sp => sp.id === editSpecialPoint.id ? editSpecialPoint : sp));
    setEditSpecialPoint(null);
    toast({ title: 'Speciální bod uložen' });
  }

  async function deleteSpecialPoint(id: string) {
    await supabase.from('special_map_points').delete().eq('id', id);
    setSpecialPoints(prev => prev.filter(sp => sp.id !== id));
    setEditSpecialPoint(null);
    setViewSpecialPoint(null);
  }

  async function saveSpecialPointPosition(id: string, x: number, y: number) {
    await supabase.from('special_map_points').update({ x, y }).eq('id', id);
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
    if (e.button !== 0) return;

    const coords = clientToMap(e.clientX, e.clientY);

    // If editable and hovering over a special point, start dragging
    if (editable && coords && !addingPoint && !addingSpecialPoint) {
      const spId = findSpecialPointAt(coords.x, coords.y);
      if (spId) {
        e.preventDefault();
        setDraggingSpecialPoint(spId);
        didDragRef.current = false;
        return;
      }
    }

    // If editable and hovering over a route point, start dragging
    if (editable && coords && !addingPoint && !addingSpecialPoint) {
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
    if (draggingSpecialPoint) {
      const coords = clientToMap(e.clientX, e.clientY);
      if (!coords) return;
      didDragRef.current = true;
      setSpecialPoints(prev => prev.map(sp =>
        sp.id === draggingSpecialPoint ? { ...sp, x: coords.x, y: coords.y } : sp
      ));
      return;
    }
    if (draggingPoint) {
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
    if (draggingSpecialPoint) {
      const sp = specialPoints.find(s => s.id === draggingSpecialPoint);
      if (sp && didDragRef.current) {
        saveSpecialPointPosition(draggingSpecialPoint, sp.x, sp.y);
      }
      setDraggingSpecialPoint(null);
    }
    if (draggingPoint) {
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
    if (draggingPoint || draggingSpecialPoint) return 'grabbing';
    if (addingPoint || addingSpecialPoint) return 'crosshair';
    if (isPanning) return 'grabbing';
    return 'grab';
  }

  const activeRoute = routes.find(r => r.id === activeRouteId);
  const activeDistKm = activeRoute ? routeDistanceKm(activeRoute) : 0;

  return (
    <div className="h-[calc(100vh-3rem)] relative">
      {/* Map area */}
      <div
        ref={containerRef}
        className="h-full overflow-hidden rounded-lg border border-border bg-card relative select-none"
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
                        {{ city: '🏰', village: '🏠', cave: '🕳️', forest: '🌲', camp: '⛺', ruins: '🏚️', temple: '⛪', tavern: '🍺', road: '🛤️', meadow: '🌾', landmark: '⭐', battlefield: '⚔️', dam: '🌊', ford: '🚿', mountains: '⛰️', generic: '' }[p.point_type] || ''} {p.label}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            ))}

            {/* Special points */}
            {showSpecialPoints && visibleSpecialPoints.map(sp => (
              <g key={sp.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                {/* Star shape */}
                <text
                  x={sp.x} y={sp.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={22 / scale}
                  style={{ pointerEvents: 'none' }}
                >
                  ⭐
                </text>
                {/* Invisible hit area */}
                <circle
                  cx={sp.x} cy={sp.y} r={14 / scale}
                  fill="transparent"
                />
                {sp.name && (
                  <text
                    x={sp.x + 14 / scale} y={sp.y - 14 / scale}
                    fill="#FFD700" stroke="black" strokeWidth={3 / scale}
                    paintOrder="stroke"
                    fontSize={13 / scale}
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {sp.name}
                  </text>
                )}
                {/* Visibility indicator for admins/editors */}
                {(isAdmin || isEditor) && !sp.visible_to_viewers && (
                  <text
                    x={sp.x + 14 / scale} y={sp.y + 4 / scale}
                    fill="#ff6666" stroke="black" strokeWidth={2 / scale}
                    paintOrder="stroke"
                    fontSize={10 / scale}
                    style={{ pointerEvents: 'none' }}
                  >
                    🔒 skrytý
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        {/* Floating toolbar - top left */}
        <div className="absolute top-3 left-3 flex items-center gap-1 z-10 flex-wrap">
          <Button size="sm" variant="secondary" className="h-8 shadow-md gap-1.5 text-xs" onClick={() => setRoutesDialogOpen(true)}>
            <Route size={14} /> Trasy
          </Button>
          <Button size="sm" variant="secondary" className="h-8 shadow-md gap-1.5 text-xs" onClick={() => setSpecialPointsDialogOpen(true)}>
            <Star size={14} /> Speciální body
          </Button>
          {editable && (
            <Button size="sm" variant="secondary" className="h-8 w-8 shadow-md p-0" onClick={() => { setTempSettings(settings); setSettingsOpen(true); }} title="Nastavení mapy">
              <Settings size={14} />
            </Button>
          )}
          {editable && activeRouteId && (
            <Button size="sm" variant={addingPoint ? 'default' : 'secondary'} className="h-8 shadow-md gap-1.5 text-xs" onClick={() => { setAddingPoint(!addingPoint); setAddingSpecialPoint(false); }}>
              <MapPin size={14} /> {addingPoint ? 'Klikni na mapu...' : 'Přidat bod'}
            </Button>
          )}
          {editable && (
            <Button size="sm" variant={addingSpecialPoint ? 'default' : 'secondary'} className="h-8 shadow-md gap-1.5 text-xs" onClick={() => { setAddingSpecialPoint(!addingSpecialPoint); setAddingPoint(false); }}>
              <Star size={14} /> {addingSpecialPoint ? 'Klikni na mapu...' : 'Nový ⭐'}
            </Button>
          )}
        </div>

        {/* Active route info - bottom center */}
        {activeRoute && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5 shadow-md max-w-[90%]">
            <div className="flex items-center gap-3 text-xs flex-wrap justify-center">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeRoute.color }} />
              <span className="font-semibold text-foreground">{activeRoute.name}</span>
              <span className="text-muted-foreground">Body: {activeRoute.points.length}</span>
              <span className="text-muted-foreground">{activeDistKm.toFixed(1)} km</span>
              {activeDistKm > 0 && (
                <>
                  <span>🚶 {formatTime(activeDistKm / settings.speed_walk)}</span>
                  <span>🐴 {formatTime(activeDistKm / settings.speed_horse)}</span>
                  <span>🧹 {formatTime(activeDistKm / settings.speed_broom)}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Zoom buttons */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
          <Button size="icon" variant="secondary" className="h-9 w-9 rounded-md shadow-md" onClick={() => zoomBy(1.2)} title="Přiblížit">
            <Plus size={18} />
          </Button>
          <Button size="icon" variant="secondary" className="h-9 w-9 rounded-md shadow-md" onClick={() => zoomBy(0.8)} title="Oddálit">
            <Minus size={18} />
          </Button>
        </div>
      </div>

      {/* Routes dialog */}
      <Dialog open={routesDialogOpen} onOpenChange={setRoutesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route size={18} /> Správa tras
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 flex-1 min-h-0 overflow-auto">
            {/* Left: route list */}
            <div className="w-[280px] shrink-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {editable && <Button size="sm" variant="outline" onClick={addRoute} className="h-7 text-xs"><Plus size={12} className="mr-1" /> Nová trasa</Button>}
                {routes.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      const allVisible = routes.every(r => r.visible);
                      setRoutes(prev => prev.map(r => ({ ...r, visible: !allVisible })));
                    }}
                  >
                    {routes.every(r => r.visible) ? <EyeOff size={12} className="mr-1" /> : <Eye size={12} className="mr-1" />}
                    {routes.every(r => r.visible) ? 'Skrýt vše' : 'Zobrazit vše'}
                  </Button>
                )}
              </div>
              <div className="space-y-1 max-h-[50vh] overflow-auto">
                {routes.map(r => {
                  const dist = routeDistanceKm(r);
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                        r.id === activeRouteId ? 'bg-secondary text-primary font-semibold' : 'hover:bg-secondary/50 text-foreground'
                      }`}
                      onClick={() => setActiveRouteId(r.id)}
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      <span className="truncate flex-1">{r.name}</span>
                      <span className="text-muted-foreground">{dist.toFixed(1)} km</span>
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
                  );
                })}
                {routes.length === 0 && <p className="text-xs text-muted-foreground">Žádné trasy</p>}
              </div>
            </div>

            {/* Right: active route details */}
            <div className="border-l border-border pl-4 flex-1 min-w-0 overflow-auto">
              {activeRoute ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: activeRoute.color }}>{activeRoute.name}</h3>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Body: {activeRoute.points.length}</span>
                      <span>Vzdálenost: {activeDistKm.toFixed(1)} km</span>
                    </div>
                    {activeDistKm > 0 && (
                      <div className="flex gap-4 text-xs mt-1">
                        <span>🚶 {formatTime(activeDistKm / settings.speed_walk)}</span>
                        <span>🐴 {formatTime(activeDistKm / settings.speed_horse)}</span>
                        <span>🧹 {formatTime(activeDistKm / settings.speed_broom)}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {activeRoute.points.map((p, i) => {
                      let segDist = '';
                      if (i > 0) {
                        const prev = activeRoute.points[i - 1];
                        const px = Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
                        segDist = ` (${(px / settings.pixels_per_km).toFixed(1)} km)`;
                      }
                      const typeIcon = { city: '🏰', village: '🏠', cave: '🕳️', forest: '🌲', camp: '⛺', ruins: '🏚️', temple: '⛪', tavern: '🍺', road: '🛤️', meadow: '🌾', landmark: '⭐', battlefield: '⚔️', dam: '🌊', ford: '🚿', mountains: '⛰️', generic: '📍' }[p.point_type] || '📍';
                      return (
                        <div key={p.id} className="flex items-center gap-1.5 text-xs py-0.5" title={p.description || undefined}>
                          <span>{typeIcon}</span>
                          <span className="truncate flex-1">{p.label || `Bod ${i + 1}`}{segDist}</span>
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
                    {activeRoute.points.length === 0 && <p className="text-xs text-muted-foreground">Žádné body v trase</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Vyberte trasu ze seznamu vlevo</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Special points dialog */}
      <Dialog open={specialPointsDialogOpen} onOpenChange={setSpecialPointsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star size={18} className="text-yellow-400" /> Speciální body
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setShowSpecialPoints(!showSpecialPoints)}
            >
              {showSpecialPoints ? <EyeOff size={12} className="mr-1" /> : <Eye size={12} className="mr-1" />}
              {showSpecialPoints ? 'Skrýt na mapě' : 'Zobrazit na mapě'}
            </Button>
          </div>
          <div className="flex gap-4 flex-1 min-h-0 overflow-auto">
            {/* Left: list */}
            <div className="w-[250px] shrink-0 space-y-1 max-h-[50vh] overflow-auto">
              {visibleSpecialPoints.map(sp => (
                <div
                  key={sp.id}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                    viewSpecialPoint?.id === sp.id ? 'bg-secondary text-primary font-semibold' : 'hover:bg-secondary/50 text-foreground'
                  }`}
                  onClick={() => setViewSpecialPoint(sp)}
                >
                  <span>⭐</span>
                  <span className="truncate flex-1">{sp.name || 'Bez názvu'}</span>
                  {(isAdmin || isEditor) && !sp.visible_to_viewers && <span className="text-destructive text-[10px]">🔒</span>}
                  {editable && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setEditSpecialPoint(sp); }}>
                        <Edit2 size={10} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteSpecialPoint(sp.id); }} className="text-destructive">
                        <Trash2 size={10} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {visibleSpecialPoints.length === 0 && <p className="text-xs text-muted-foreground">Žádné speciální body</p>}
            </div>
            {/* Right: detail */}
            <div className="border-l border-border pl-4 flex-1 min-w-0">
              {viewSpecialPoint ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span>⭐</span> {viewSpecialPoint.name || 'Bez názvu'}
                  </h3>
                  {viewSpecialPoint.description ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{viewSpecialPoint.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Žádný popis.</p>
                  )}
                  {(isAdmin || isEditor) && (
                    <p className="text-xs text-muted-foreground">
                      {viewSpecialPoint.visible_to_viewers ? '👁️ Viditelné pro všechny' : '🔒 Pouze admin/editor'}
                    </p>
                  )}
                  {editable && (
                    <Button variant="outline" size="sm" onClick={() => { setEditSpecialPoint(viewSpecialPoint); }}>
                      <Edit2 size={14} className="mr-1" /> Upravit
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Klikněte na bod v seznamu pro zobrazení detailu</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                <option value="road">🛤️ Cesta</option>
                <option value="meadow">🌾 Louka</option>
                <option value="landmark">⭐ Významné místo</option>
                <option value="battlefield">⚔️ Bojiště</option>
                <option value="dam">🌊 Jez</option>
                <option value="ford">🚿 Brod</option>
                <option value="mountains">⛰️ Hory</option>
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



      {/* Edit special point dialog */}
      <Dialog open={!!editSpecialPoint} onOpenChange={() => setEditSpecialPoint(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit speciální bod</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-foreground font-medium">Název místa</label>
              <Input
                value={editSpecialPoint?.name || ''}
                onChange={e => setEditSpecialPoint(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div>
              <label className="text-sm text-foreground font-medium">Popis (co se tam nachází nebo stalo)</label>
              <Textarea
                className="min-h-[100px]"
                value={editSpecialPoint?.description || ''}
                onChange={e => setEditSpecialPoint(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editSpecialPoint?.visible_to_viewers ?? false}
                onCheckedChange={checked => setEditSpecialPoint(prev => prev ? { ...prev, visible_to_viewers: checked } : null)}
              />
              <label className="text-sm text-foreground">Viditelné pro čtenáře (viewer)</label>
            </div>
            <p className="text-xs text-muted-foreground">
              Admin a editor vidí tento bod vždy. Čtenář ho uvidí pouze pokud je viditelnost zapnutá.
            </p>
          </div>
          <DialogFooter>
            {editSpecialPoint && (
              <Button variant="destructive" onClick={() => deleteSpecialPoint(editSpecialPoint.id)} className="mr-auto">
                <Trash2 size={14} className="mr-1" /> Smazat
              </Button>
            )}
            <Button onClick={saveSpecialPoint}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
