import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Minus, Trash2, Edit2, Settings, Eye, EyeOff, MapPin, Star, Route, ChevronLeft, ChevronRight, Image, Upload, Check, Users, Cloud, Move, RotateCcw } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface MapImage {
  id: string;
  name: string;
  image_url: string;
  is_active: boolean;
  fog_enabled: boolean;
  default_reveal_radius: number;
}

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
  map_id: string | null;
}

interface MapSettings {
  pixels_per_km: number;
  speed_walk: number;
  speed_horse: number;
  speed_broom: number;
  map_id?: string;
}

interface SpecialPoint {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  visible_to_viewers: boolean;
  map_id: string | null;
}

interface MapToken {
  id: string;
  map_id: string;
  owner_user_id: string | null;
  created_by: string;
  name: string;
  color: string;
  icon: string;
  x: number;
  y: number;
  reveal_radius: number;
  light_source: string;
  notes: string;
}

interface FogReveal {
  id: string;
  map_id: string;
  x: number;
  y: number;
  radius: number;
}

interface MapBeast {
  id: string;
  map_id: string;
  monster_id: string | null;
  battle_id: string | null;
  short_code: string;
  name: string;
  level: number;
  hp: number;
  current_hp: number;
  color: string;
  x: number;
  y: number;
  reveal_radius: number;
  revealed: boolean;
  stealth_mode: 'none' | 'manual' | 'auto';
  notes: string;
}

const DEFAULT_SETTINGS: MapSettings = {
  pixels_per_km: 10,
  speed_walk: 5,
  speed_horse: 15,
  speed_broom: 40,
};

const ROUTE_COLORS = ['#ff0000', '#00cc44', '#3388ff', '#ff8800', '#cc00ff', '#ffdd00', '#00cccc', '#ff4488'];
const TOKEN_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const LIGHT_SOURCES: Record<string, { label: string; radius: number; emoji: string }> = {
  default: { label: 'Bez světla (denní)', radius: 80, emoji: '☀️' },
  darkvision: { label: 'Vidění ve tmě (trpaslík)', radius: 60, emoji: '👁️' },
  torch: { label: 'Pochodeň', radius: 100, emoji: '🔥' },
  lantern: { label: 'Lucerna', radius: 140, emoji: '🏮' },
  light_spell: { label: 'Kouzlo Světlo', radius: 180, emoji: '✨' },
  daylight: { label: 'Denní světlo (kouzlo)', radius: 300, emoji: '🌞' },
};

export default function MapPage() {
  const { user } = useAuth();
  const { canEdit: canEditPage, isAdmin, isEditor } = useUserRole();
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
  const [mapsDialogOpen, setMapsDialogOpen] = useState(false);
  const [tokensDialogOpen, setTokensDialogOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [editPointLabel, setEditPointLabel] = useState<{ routeId: string; pointId: string; label: string; description: string; point_type: string } | null>(null);

  // Maps state
  const [maps, setMaps] = useState<MapImage[]>([]);
  const [activeMapUrl, setActiveMapUrl] = useState<string>('');
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const mapFileRef = useRef<HTMLInputElement>(null);
  const [allMapSettings, setAllMapSettings] = useState<Record<string, MapSettings>>({});

  // Special points state
  const [specialPoints, setSpecialPoints] = useState<SpecialPoint[]>([]);
  const [showSpecialPoints, setShowSpecialPoints] = useState(true);
  const [addingSpecialPoint, setAddingSpecialPoint] = useState(false);
  const [editSpecialPoint, setEditSpecialPoint] = useState<SpecialPoint | null>(null);
  const [viewSpecialPoint, setViewSpecialPoint] = useState<SpecialPoint | null>(null);

  // Tokens state
  const [tokens, setTokens] = useState<MapToken[]>([]);
  const [addingToken, setAddingToken] = useState(false);
  const [editToken, setEditToken] = useState<MapToken | null>(null);
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: string; email: string }[]>([]);

  // Fog of war
  const [fogReveals, setFogReveals] = useState<FogReveal[]>([]);
  const [showFog, setShowFog] = useState(true);

  // Beasts state
  const [beasts, setBeasts] = useState<MapBeast[]>([]);
  const [beastsDialogOpen, setBeastsDialogOpen] = useState(false);
  const [addingBeast, setAddingBeast] = useState(false);
  const [editBeast, setEditBeast] = useState<MapBeast | null>(null);
  const [draggingBeast, setDraggingBeast] = useState<string | null>(null);
  const beastPressRef = useRef<{ id: string; timer: number } | null>(null);
  const [monstersList, setMonstersList] = useState<{ id: string; name: string; con: number; xp_reward: number; is_unique: boolean; image_url: string }[]>([]);
  // Add-beast form
  const [beastForm, setBeastForm] = useState<{ monster_id: string; level_min: number; level_max: number; stealth_mode: 'none'|'manual'|'auto'; reveal_radius: number; pendingPos: { x: number; y: number } | null }>({ monster_id: '', level_min: 1, level_max: 1, stealth_mode: 'none', reveal_radius: 80, pendingPos: null });

  // Hovered point for tooltip
  const [hoveredPoint, setHoveredPoint] = useState<{ routeId: string; pointId: string; clientX: number; clientY: number } | null>(null);

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
  const lastFogPosRef = useRef<{ x: number; y: number } | null>(null);
  // Throttle realtime position writes during drag (ms)
  const lastPosWriteRef = useRef<Record<string, number>>({});
  function throttleWrite(key: string, ms: number = 80): boolean {
    const now = Date.now();
    const last = lastPosWriteRef.current[key] || 0;
    if (now - last < ms) return false;
    lastPosWriteRef.current[key] = now;
    return true;
  }

  // Temp settings form
  const [tempSettings, setTempSettings] = useState<MapSettings>(DEFAULT_SETTINGS);

  // Load data
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('map-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_tokens' }, payload => {
        if (payload.eventType === 'INSERT') {
          const r: any = payload.new;
          setTokens(prev => prev.some(t => t.id === r.id) ? prev : [...prev, mapTokenFromRow(r)]);
        } else if (payload.eventType === 'UPDATE') {
          const r: any = payload.new;
          setTokens(prev => prev.map(t => t.id === r.id ? mapTokenFromRow(r) : t));
        } else if (payload.eventType === 'DELETE') {
          const r: any = payload.old;
          setTokens(prev => prev.filter(t => t.id !== r.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_fog_reveals' }, payload => {
        if (payload.eventType === 'INSERT') {
          const r: any = payload.new;
          setFogReveals(prev => prev.some(f => f.id === r.id) ? prev : [...prev, { id: r.id, map_id: r.map_id, x: r.x, y: r.y, radius: r.radius }]);
        } else if (payload.eventType === 'DELETE') {
          const r: any = payload.old;
          setFogReveals(prev => prev.filter(f => f.id !== r.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_map_points' }, payload => {
        if (payload.eventType === 'INSERT') {
          const r: any = payload.new;
          setSpecialPoints(prev => prev.some(s => s.id === r.id) ? prev : [...prev, spFromRow(r)]);
        } else if (payload.eventType === 'UPDATE') {
          const r: any = payload.new;
          setSpecialPoints(prev => prev.map(s => s.id === r.id ? spFromRow(r) : s));
        } else if (payload.eventType === 'DELETE') {
          const r: any = payload.old;
          setSpecialPoints(prev => prev.filter(s => s.id !== r.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_routes' }, () => {
        loadRoutes();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_points' }, payload => {
        if (payload.eventType === 'UPDATE') {
          const r: any = payload.new;
          setRoutes(prev => prev.map(rt => rt.id === r.route_id ? {
            ...rt,
            points: rt.points.map(p => p.id === r.id ? { ...p, x: r.x, y: r.y, label: r.label, description: r.description || '', point_type: r.point_type || 'generic', sort_order: r.sort_order } : p)
          } : rt));
        } else {
          loadRoutes();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_beasts' }, payload => {
        if (payload.eventType === 'INSERT') {
          const r: any = payload.new;
          setBeasts(prev => prev.some(b => b.id === r.id) ? prev : [...prev, beastFromRow(r)]);
        } else if (payload.eventType === 'UPDATE') {
          const r: any = payload.new;
          setBeasts(prev => prev.map(b => b.id === r.id ? beastFromRow(r) : b));
        } else if (payload.eventType === 'DELETE') {
          const r: any = payload.old;
          setBeasts(prev => prev.filter(b => b.id !== r.id));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battle_monsters' }, payload => {
        const r: any = payload.new;
        // Sync HP from battle to map beast
        setBeasts(prev => prev.map(b => b.battle_id === r.battle_id ? { ...b, current_hp: r.current_hp, hp: r.hp } : b));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maps' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const r: any = payload.new;
          const mapped: MapImage = {
            id: r.id, name: r.name, image_url: r.image_url, is_active: r.is_active,
            fog_enabled: r.fog_enabled ?? false, default_reveal_radius: r.default_reveal_radius ?? 60,
          };
          setMaps(prev => {
            const exists = prev.some(m => m.id === r.id);
            const next = exists ? prev.map(m => m.id === r.id ? mapped : m) : [...prev, mapped];
            // Pokud změna označila tuto mapu jako aktivní, přepni
            if (r.is_active) {
              setActiveMapId(r.id);
              setActiveMapUrl(r.image_url);
            } else if (activeMapId === r.id && !r.is_active) {
              // pokud byla deaktivována, najdi novou aktivní
              const newActive = next.find(m => m.is_active);
              if (newActive) { setActiveMapId(newActive.id); setActiveMapUrl(newActive.image_url); }
            } else if (activeMapId === r.id) {
              // aktualizuj URL pokud se změnil obrázek
              setActiveMapUrl(r.image_url);
            }
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          const r: any = payload.old;
          setMaps(prev => prev.filter(m => m.id !== r.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_settings' }, payload => {
        const r: any = payload.new || payload.old;
        if (!r) return;
        const key = r.map_id || '__global__';
        if (payload.eventType === 'DELETE') {
          setAllMapSettings(prev => { const n = { ...prev }; delete n[key]; return n; });
        } else {
          const s: MapSettings = { pixels_per_km: r.pixels_per_km, speed_walk: r.speed_walk, speed_horse: r.speed_horse, speed_broom: r.speed_broom, map_id: r.map_id };
          setAllMapSettings(prev => ({ ...prev, [key]: s }));
          if (key === activeMapId) setSettings(s);
        }
      })
      .subscribe((status) => {
        console.log('[MapPage] realtime status:', status);
      });
    return () => { supabase.removeChannel(channel); };
  }, [user, activeMapId]);

  function beastFromRow(r: any): MapBeast {
    return {
      id: r.id, map_id: r.map_id, monster_id: r.monster_id, battle_id: r.battle_id,
      short_code: r.short_code || '??', name: r.name || 'Bestie', level: r.level || 1,
      hp: r.hp || 10, current_hp: r.current_hp ?? r.hp ?? 10, color: r.color || '#dc2626',
      x: r.x, y: r.y, reveal_radius: r.reveal_radius ?? 80,
      revealed: !!r.revealed, stealth_mode: (r.stealth_mode || 'none') as 'none'|'manual'|'auto',
      notes: r.notes || '',
    };
  }

  function mapTokenFromRow(r: any): MapToken {
    return {
      id: r.id, map_id: r.map_id, owner_user_id: r.owner_user_id, created_by: r.created_by,
      name: r.name, color: r.color, icon: r.icon, x: r.x, y: r.y,
      reveal_radius: r.reveal_radius, light_source: r.light_source, notes: r.notes || '',
    };
  }
  function spFromRow(r: any): SpecialPoint {
    return {
      id: r.id, name: r.name, description: r.description, x: r.x, y: r.y,
      visible_to_viewers: r.visible_to_viewers, map_id: r.map_id ?? null,
    };
  }

  async function loadRoutes() {
    const [rRes, pRes] = await Promise.all([
      supabase.from('map_routes').select('*').order('created_at'),
      supabase.from('map_points').select('*').order('sort_order'),
    ]);
    const pointsByRoute: Record<string, MapPoint[]> = {};
    (pRes.data || []).forEach((p: any) => {
      if (!pointsByRoute[p.route_id]) pointsByRoute[p.route_id] = [];
      pointsByRoute[p.route_id].push({ id: p.id, route_id: p.route_id, label: p.label, description: p.description || '', point_type: p.point_type || 'generic', x: p.x, y: p.y, sort_order: p.sort_order });
    });
    setRoutes(prev => {
      const visMap = new Map(prev.map(r => [r.id, r.visible]));
      return (rRes.data || []).map((r: any) => ({
        id: r.id, name: r.name, color: r.color,
        map_id: r.map_id ?? null,
        points: (pointsByRoute[r.id] || []).sort((a: MapPoint, b: MapPoint) => a.sort_order - b.sort_order),
        visible: visMap.get(r.id) ?? true,
      }));
    });
  }

  async function loadData() {
    if (!user) return;
    const [rRes, pRes, sRes, spRes, mRes, tRes, fRes, profRes, bRes, mnRes] = await Promise.all([
      supabase.from('map_routes').select('*').order('created_at'),
      supabase.from('map_points').select('*').order('sort_order'),
      supabase.from('map_settings').select('*'),
      supabase.from('special_map_points').select('*').order('created_at'),
      supabase.from('maps').select('*').order('created_at'),
      supabase.from('map_tokens').select('*'),
      supabase.from('map_fog_reveals').select('*'),
      supabase.from('profiles').select('id,email'),
      supabase.from('map_beasts').select('*').order('created_at'),
      supabase.from('monsters').select('id,name,con,xp_reward,is_unique,image_url').order('name'),
    ]);
    setBeasts((bRes.data || []).map((b: any) => beastFromRow(b)));
    setMonstersList((mnRes.data || []).map((m: any) => ({ id: m.id, name: m.name, con: m.con, xp_reward: m.xp_reward, is_unique: m.is_unique, image_url: m.image_url || '' })));

    const pointsByRoute: Record<string, MapPoint[]> = {};
    (pRes.data || []).forEach((p: any) => {
      if (!pointsByRoute[p.route_id]) pointsByRoute[p.route_id] = [];
      pointsByRoute[p.route_id].push({ id: p.id, route_id: p.route_id, label: p.label, description: p.description || '', point_type: p.point_type || 'generic', x: p.x, y: p.y, sort_order: p.sort_order });
    });

    const loadedRoutes: MapRoute[] = (rRes.data || []).map((r: any) => ({
      id: r.id, name: r.name, color: r.color,
      map_id: r.map_id ?? null,
      points: (pointsByRoute[r.id] || []).sort((a: MapPoint, b: MapPoint) => a.sort_order - b.sort_order),
      visible: true,
    }));
    setRoutes(loadedRoutes);
    if (loadedRoutes.length > 0 && !activeRouteId) setActiveRouteId(loadedRoutes[0].id);

    const allSettings: Record<string, MapSettings> = {};
    (sRes.data || []).forEach((s: any) => {
      const key = s.map_id || '__global__';
      allSettings[key] = { pixels_per_km: s.pixels_per_km, speed_walk: s.speed_walk, speed_horse: s.speed_horse, speed_broom: s.speed_broom, map_id: s.map_id };
    });
    setAllMapSettings(allSettings);

    setSpecialPoints((spRes.data || []).map((sp: any) => spFromRow(sp)));
    setTokens((tRes.data || []).map((t: any) => mapTokenFromRow(t)));
    setFogReveals((fRes.data || []).map((f: any) => ({ id: f.id, map_id: f.map_id, x: f.x, y: f.y, radius: f.radius })));
    setAllUsers((profRes.data || []).map((p: any) => ({ id: p.id, email: p.email })));

    const loadedMaps: MapImage[] = (mRes.data || []).map((m: any) => ({
      id: m.id, name: m.name, image_url: m.image_url, is_active: m.is_active,
      fog_enabled: m.fog_enabled ?? false, default_reveal_radius: m.default_reveal_radius ?? 60,
    }));
    setMaps(loadedMaps);
    const activeMap = loadedMaps.find(m => m.is_active);
    if (activeMap) {
      setActiveMapUrl(activeMap.image_url);
      setActiveMapId(activeMap.id);
      if (allSettings[activeMap.id]) setSettings(allSettings[activeMap.id]);
    }
  }

  // ---- Granular permissions for map sub-features ----
  const editRoutes = isEditor || canEditPage('map_routes');
  const editSpecial = isEditor || canEditPage('map_special');
  const editTokens = isEditor || canEditPage('map_tokens');
  const editFog = isEditor || canEditPage('map_fog');
  const editBeasts = isEditor || canEditPage('map_beasts');

  // Filter special points: by map AND viewer permission
  const visibleSpecialPoints = specialPoints.filter(sp => {
    if (sp.map_id !== null && sp.map_id !== activeMapId) return false;
    if (isAdmin || isEditor) return true;
    return sp.visible_to_viewers;
  });

  // Routes filtered by active map (or global = NULL)
  const visibleRoutes = routes.filter(r => r.map_id === null || r.map_id === activeMapId);

  // Tokens for active map
  const activeMapTokens = tokens.filter(t => t.map_id === activeMapId);
  const activeMap = maps.find(m => m.id === activeMapId);
  const fogEnabled = activeMap?.fog_enabled ?? false;
  const activeFogReveals = fogReveals.filter(f => f.map_id === activeMapId);
  const activeMapBeasts = beasts.filter(b => b.map_id === activeMapId);

  // Beasts visible to current user:
  // - Admin/editor see all
  // - Players (viewers) only see beasts that are 'revealed' AND currently inside any token's vision radius
  const visibleBeastsForUser = activeMapBeasts.filter(b => {
    if (isAdmin || isEditor) return true;
    if (!b.revealed) return false;
    // Must be inside at least one player token's vision radius right now
    return activeMapTokens.some(t => {
      const d = Math.sqrt((t.x - b.x) ** 2 + (t.y - b.y) ** 2);
      return d <= t.reveal_radius;
    });
  });

  // Save settings (per-map)
  async function saveSettings() {
    if (!user || !activeMapId) return;
    await supabase.from('map_settings').upsert({
      user_id: user.id, map_id: activeMapId, ...tempSettings,
    }, { onConflict: 'user_id,map_id' });
    setSettings(tempSettings);
    setAllMapSettings(prev => ({ ...prev, [activeMapId]: tempSettings }));
    setSettingsOpen(false);
    toast({ title: 'Nastavení uloženo' });
  }

  // Map management
  async function handleMapUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingMap(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('map-images').upload(path, file);
    if (uploadError) {
      toast({ title: 'Chyba při nahrávání', description: uploadError.message, variant: 'destructive' });
      setUploadingMap(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('map-images').getPublicUrl(path);
    const imageUrl = urlData.publicUrl;
    const mapName = newMapName || file.name.replace(/\.[^.]+$/, '');
    const isFirst = maps.length === 0;
    const { data: row } = await supabase.from('maps').insert({
      user_id: user.id, name: mapName, image_url: imageUrl, is_active: isFirst,
    }).select().single();
    if (row) {
      const r: any = row;
      const newMap: MapImage = { id: r.id, name: r.name, image_url: r.image_url, is_active: r.is_active, fog_enabled: r.fog_enabled ?? false, default_reveal_radius: r.default_reveal_radius ?? 60 };
      setMaps(prev => [...prev, newMap]);
      if (isFirst) { setActiveMapUrl(imageUrl); setActiveMapId(r.id); }
      toast({ title: 'Mapa nahrána' });
    }
    setNewMapName('');
    setUploadingMap(false);
    if (mapFileRef.current) mapFileRef.current.value = '';
  }

  async function selectMap(mapId: string) {
    if (!user) return;
    await supabase.from('maps').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('maps').update({ is_active: true }).eq('id', mapId);
    setMaps(prev => prev.map(m => ({ ...m, is_active: m.id === mapId })));
    const selected = maps.find(m => m.id === mapId);
    if (selected) setActiveMapUrl(selected.image_url);
    setActiveMapId(mapId);
    const mapSettings = allMapSettings[mapId];
    setSettings(mapSettings || DEFAULT_SETTINGS);
  }

  async function deleteMap(mapId: string) {
    const map = maps.find(m => m.id === mapId);
    if (!map) return;
    await supabase.from('maps').delete().eq('id', mapId);
    setMaps(prev => prev.filter(m => m.id !== mapId));
    if (map.is_active && maps.length > 1) {
      const remaining = maps.filter(m => m.id !== mapId);
      if (remaining.length > 0) selectMap(remaining[0].id);
    }
  }

  async function renameMap(mapId: string, newName: string) {
    await supabase.from('maps').update({ name: newName }).eq('id', mapId);
    setMaps(prev => prev.map(m => m.id === mapId ? { ...m, name: newName } : m));
  }

  async function toggleMapFog(mapId: string, enabled: boolean) {
    await supabase.from('maps').update({ fog_enabled: enabled }).eq('id', mapId);
    setMaps(prev => prev.map(m => m.id === mapId ? { ...m, fog_enabled: enabled } : m));
  }

  async function setMapRevealRadius(mapId: string, radius: number) {
    await supabase.from('maps').update({ default_reveal_radius: radius }).eq('id', mapId);
    setMaps(prev => prev.map(m => m.id === mapId ? { ...m, default_reveal_radius: radius } : m));
  }

  async function clearFogForMap(mapId: string) {
    if (!confirm('Opravdu vymazat všechny odkryté oblasti? Mapa se znovu zatemní.')) return;
    await supabase.from('map_fog_reveals').delete().eq('map_id', mapId);
    setFogReveals(prev => prev.filter(f => f.map_id !== mapId));
    toast({ title: 'Mapa znovu zatemněna' });
  }

  async function addRoute() {
    if (!user) return;
    const color = ROUTE_COLORS[routes.length % ROUTE_COLORS.length];
    const { data: row } = await supabase.from('map_routes').insert({
      user_id: user.id, name: `Trasa ${routes.length + 1}`, color, map_id: activeMapId,
    } as any).select().single();
    if (row) {
      const r: any = row;
      const newRoute: MapRoute = { id: r.id, name: r.name, color: r.color, map_id: r.map_id ?? null, points: [], visible: true };
      setRoutes(prev => [...prev, newRoute]);
      setActiveRouteId(r.id);
    }
  }

  async function deleteRoute(routeId: string) {
    await supabase.from('map_routes').delete().eq('id', routeId);
    setRoutes(prev => prev.filter(r => r.id !== routeId));
    if (activeRouteId === routeId) setActiveRouteId(routes.find(r => r.id !== routeId)?.id || null);
  }

  async function renameRoute() {
    if (!renameOpen) return;
    await supabase.from('map_routes').update({ name: renameName }).eq('id', renameOpen);
    setRoutes(prev => prev.map(r => r.id === renameOpen ? { ...r, name: renameName } : r));
    setRenameOpen(null);
  }

  function clientToMap(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }

  function findPointAt(mapX: number, mapY: number): { routeId: string; pointId: string } | null {
    const hitRadius = 12 / scale;
    for (const r of visibleRoutes) {
      if (!r.visible) continue;
      for (const p of r.points) {
        const dist = Math.sqrt((p.x - mapX) ** 2 + (p.y - mapY) ** 2);
        if (dist <= hitRadius) return { routeId: r.id, pointId: p.id };
      }
    }
    return null;
  }

  function findSpecialPointAt(mapX: number, mapY: number): string | null {
    if (!showSpecialPoints) return null;
    const hitRadius = 14 / scale;
    for (const sp of visibleSpecialPoints) {
      const dist = Math.sqrt((sp.x - mapX) ** 2 + (sp.y - mapY) ** 2);
      if (dist <= hitRadius) return sp.id;
    }
    return null;
  }

  function findTokenAt(mapX: number, mapY: number): string | null {
    const hitRadius = 18 / scale;
    for (const t of activeMapTokens) {
      const dist = Math.sqrt((t.x - mapX) ** 2 + (t.y - mapY) ** 2);
      if (dist <= hitRadius) return t.id;
    }
    return null;
  }

  function canMoveToken(t: MapToken): boolean {
    if (editable) return true;
    return t.owner_user_id === user?.id;
  }

  function handleMapClick(e: React.MouseEvent) {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    const coords = clientToMap(e.clientX, e.clientY);
    if (!coords) return;

    if (!addingPoint && !addingSpecialPoint && !addingToken) {
      const spId = findSpecialPointAt(coords.x, coords.y);
      if (spId) {
        const sp = visibleSpecialPoints.find(s => s.id === spId);
        if (sp) { setViewSpecialPoint(sp); setSpecialPointsDialogOpen(true); }
        return;
      }
    }

    if (addingToken && editable && activeMapId) {
      addTokenAt(coords.x, coords.y);
      setAddingToken(false);
      return;
    }

    if (addingBeast && editBeasts && activeMapId) {
      addBeastAt(coords.x, coords.y);
      setAddingBeast(false);
      return;
    }

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

  async function addSpecialPoint(x: number, y: number) {
    if (!user) return;
    const { data: row } = await supabase.from('special_map_points').insert({
      user_id: user.id, x, y, name: 'Nový bod', description: '', visible_to_viewers: false, map_id: activeMapId,
    }).select().single();
    if (row) {
      const sp = spFromRow(row);
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
      map_id: editSpecialPoint.map_id,
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

  // Token CRUD
  async function addTokenAt(x: number, y: number) {
    if (!user || !activeMapId) return;
    const color = TOKEN_COLORS[activeMapTokens.length % TOKEN_COLORS.length];
    const radius = activeMap?.default_reveal_radius ?? 60;
    const { data: row } = await supabase.from('map_tokens').insert({
      map_id: activeMapId, created_by: user.id, owner_user_id: null,
      name: `Postava ${activeMapTokens.length + 1}`, color, icon: 'user',
      x, y, reveal_radius: radius, light_source: 'default', notes: '',
    }).select().single();
    if (row) {
      const t = mapTokenFromRow(row);
      setTokens(prev => [...prev, t]);
      setEditToken(t);
      // Reveal area at spawn
      revealFog(x, y, radius);
    }
  }

  async function saveToken() {
    if (!editToken) return;
    await supabase.from('map_tokens').update({
      name: editToken.name, color: editToken.color, icon: editToken.icon,
      reveal_radius: editToken.reveal_radius, light_source: editToken.light_source,
      notes: editToken.notes, owner_user_id: editToken.owner_user_id,
    }).eq('id', editToken.id);
    setTokens(prev => prev.map(t => t.id === editToken.id ? editToken : t));
    setEditToken(null);
    toast({ title: 'Postava uložena' });
  }

  async function deleteToken(id: string) {
    await supabase.from('map_tokens').delete().eq('id', id);
    setTokens(prev => prev.filter(t => t.id !== id));
    setEditToken(null);
  }

  async function saveTokenPosition(id: string, x: number, y: number) {
    await supabase.from('map_tokens').update({ x, y }).eq('id', id);
  }

  // ===== Beast CRUD =====
  function calcBeastHP(con: number, level: number, isUnique: boolean, multiplier: number = 1.0): number {
    // Use shared bonus table (matches gameData.getAttributeBonus)
    const conBonus = (() => {
      if (con <= 1) return -5; if (con <= 3) return -4; if (con <= 5) return -3; if (con <= 7) return -2; if (con <= 9) return -1;
      if (con <= 11) return 0; if (con <= 13) return 1; if (con <= 15) return 2; if (con <= 17) return 3; if (con <= 19) return 4;
      if (con <= 21) return 5; if (con <= 23) return 6; if (con <= 25) return 7; if (con <= 27) return 8; if (con <= 29) return 9;
      if (con <= 31) return 10; if (con <= 33) return 11; if (con <= 35) return 12; if (con <= 37) return 13; if (con <= 39) return 14;
      return 15;
    })();
    const base = Math.max(1, Math.round((conBonus + 10) * multiplier));
    if (level <= 1) return base;
    const perLevel = isUnique ? (conBonus + 10) : (conBonus + 5);
    return base + perLevel * (level - 1);
  }
  function randIn(min: number, max: number) {
    const lo = Math.min(min, max); const hi = Math.max(min, max);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }
  function calcBeastXP(baseXP: number, level: number): number {
    return Math.round(baseXP * (1 + (level - 1) * 0.1));
  }
  function makeShortCode(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  async function addBeastAt(x: number, y: number) {
    if (!user || !activeMapId) return;
    setBeastForm(f => ({ ...f, pendingPos: { x, y } }));
    setEditBeast({
      id: '', map_id: activeMapId, monster_id: null, battle_id: null,
      short_code: '??', name: 'Bestie', level: 1, hp: 10, current_hp: 10,
      color: '#dc2626', x, y, reveal_radius: 80, revealed: false, stealth_mode: 'none', notes: '',
    });
  }

  async function confirmAddBeast() {
    if (!user || !activeMapId || !beastForm.pendingPos || !beastForm.monster_id) {
      toast({ title: 'Vyber bestii ze seznamu', variant: 'destructive' });
      return;
    }
    const monster = monstersList.find(m => m.id === beastForm.monster_id);
    if (!monster) return;
    const min = Math.min(beastForm.level_min, beastForm.level_max);
    const max = Math.max(beastForm.level_min, beastForm.level_max);
    const level = min === max ? min : Math.floor(Math.random() * (max - min + 1)) + min;
    const hp = calcBeastHP(monster.con, level, monster.is_unique);
    const xpReward = calcBeastXP(monster.xp_reward, level);
    const shortCode = makeShortCode(monster.name);
    const battleId = crypto.randomUUID();

    // 1. Insert into battle_monsters (auto add to BOJ tab)
    await supabase.from('battle_monsters').insert({
      user_id: user.id, monster_id: monster.id, battle_id: battleId,
      name: monster.name, image_url: monster.image_url || '',
      level, hp, current_hp: hp, xp_reward: xpReward,
      con: monster.con,
    } as any);

    // 2. Insert into map_beasts
    const { data: row } = await supabase.from('map_beasts').insert({
      map_id: activeMapId, monster_id: monster.id, battle_id: battleId,
      created_by: user.id, short_code: shortCode, name: monster.name,
      level, hp, current_hp: hp, x: beastForm.pendingPos.x, y: beastForm.pendingPos.y,
      reveal_radius: beastForm.reveal_radius, stealth_mode: beastForm.stealth_mode,
      revealed: beastForm.stealth_mode === 'none',
      color: '#dc2626',
    }).select().single();
    if (row) {
      const b = beastFromRow(row);
      setBeasts(prev => [...prev, b]);
      toast({ title: `${monster.name} (úr.${level}) přidána na mapu i do boje` });
    }
    setEditBeast(null);
    setAddingBeast(false);
    setBeastForm({ monster_id: '', level_min: 1, level_max: 1, stealth_mode: 'none', reveal_radius: 80, pendingPos: null });
  }

  async function saveBeast() {
    if (!editBeast || !editBeast.id) return;
    const newMax = Math.max(1, editBeast.hp);
    const newCur = Math.max(0, Math.min(newMax, editBeast.current_hp));
    const updated = { ...editBeast, hp: newMax, current_hp: newCur };
    await supabase.from('map_beasts').update({
      short_code: updated.short_code, name: updated.name,
      reveal_radius: updated.reveal_radius, stealth_mode: updated.stealth_mode,
      revealed: updated.revealed, notes: updated.notes, color: updated.color,
      hp: newMax, current_hp: newCur, level: updated.level,
    }).eq('id', editBeast.id);
    // Sync to battle_monsters (BOJ tab)
    if (updated.battle_id) {
      await supabase.from('battle_monsters').update({
        name: updated.name, hp: newMax, current_hp: newCur, level: updated.level,
      }).eq('battle_id', updated.battle_id);
    }
    setBeasts(prev => prev.map(b => b.id === editBeast.id ? updated : b));
    setEditBeast(null);
    toast({ title: 'Bestie uložena' });
  }

  async function deleteBeast(id: string) {
    const b = beasts.find(x => x.id === id);
    await supabase.from('map_beasts').delete().eq('id', id);
    if (b?.battle_id) {
      await supabase.from('battle_monsters').delete().eq('battle_id', b.battle_id);
    }
    setBeasts(prev => prev.filter(x => x.id !== id));
    setEditBeast(null);
  }

  async function saveBeastPosition(id: string, x: number, y: number) {
    await supabase.from('map_beasts').update({ x, y }).eq('id', id);
  }

  async function toggleBeastReveal(id: string, revealed: boolean) {
    await supabase.from('map_beasts').update({ revealed }).eq('id', id);
    setBeasts(prev => prev.map(b => b.id === id ? { ...b, revealed } : b));
  }

  function findBeastAt(mapX: number, mapY: number): string | null {
    const hitRadius = 18 / scale;
    for (const b of visibleBeastsForUser) {
      const dist = Math.sqrt((b.x - mapX) ** 2 + (b.y - mapY) ** 2);
      if (dist <= hitRadius) return b.id;
    }
    return null;
  }
  function canMoveBeast(): boolean { return editBeasts; }

  // Auto-reveal: any 'auto'-stealth beast that comes within any token's vision range gets revealed
  useEffect(() => {
    if (!editBeasts) return; // only admin/editor pushes the reveal
    const toReveal = activeMapBeasts.filter(b => !b.revealed && b.stealth_mode === 'auto' && activeMapTokens.some(t => {
      const d = Math.sqrt((t.x - b.x) ** 2 + (t.y - b.y) ** 2);
      return d <= t.reveal_radius;
    }));
    toReveal.forEach(b => toggleBeastReveal(b.id, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMapTokens, activeMapBeasts, editBeasts]);

  // Switch active route when active map changes (pick first matching)
  useEffect(() => {
    if (!activeMapId) return;
    const current = routes.find(r => r.id === activeRouteId);
    if (!current || (current.map_id !== null && current.map_id !== activeMapId)) {
      const first = routes.find(r => r.map_id === null || r.map_id === activeMapId);
      setActiveRouteId(first?.id || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMapId, routes]);

  async function revealFog(x: number, y: number, radius: number) {
    if (!user || !activeMapId || !fogEnabled) return;
    // Throttle: don't insert if very close to last reveal
    if (lastFogPosRef.current) {
      const d = Math.sqrt((x - lastFogPosRef.current.x) ** 2 + (y - lastFogPosRef.current.y) ** 2);
      if (d < radius * 0.3) return;
    }
    lastFogPosRef.current = { x, y };
    const { data: row } = await supabase.from('map_fog_reveals').insert({
      user_id: user.id, map_id: activeMapId, x, y, radius,
    }).select().single();
    if (row) {
      const r: any = row;
      setFogReveals(prev => [...prev, { id: r.id, map_id: r.map_id, x: r.x, y: r.y, radius: r.radius }]);
    }
  }

  async function deletePoint(routeId: string, pointId: string) {
    await supabase.from('map_points').delete().eq('id', pointId);
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, points: r.points.filter(p => p.id !== pointId) } : r));
  }

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

  async function savePointPosition(routeId: string, pointId: string, x: number, y: number) {
    await supabase.from('map_points').update({ x, y }).eq('id', pointId);
  }

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

  const zoomBy = useCallback((factor: number) => {
    setScale(prev => Math.min(5, Math.max(0.05, prev * factor)));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.97 : 1.03;
    zoomBy(delta);
  }, [zoomBy]);

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const coords = clientToMap(e.clientX, e.clientY);

    // Beast: long-press to drag, click to open edit
    if (coords && editBeasts && !addingPoint && !addingSpecialPoint && !addingToken && !addingBeast) {
      const bId = findBeastAt(coords.x, coords.y);
      if (bId) {
        e.preventDefault();
        didDragRef.current = false;
        if (beastPressRef.current) clearTimeout(beastPressRef.current.timer);
        const timer = window.setTimeout(() => {
          setDraggingBeast(bId);
        }, 350);
        beastPressRef.current = { id: bId, timer };
        return;
      }
    }

    // Token drag (admin or owner)
    if (coords && !addingPoint && !addingSpecialPoint && !addingToken) {
      const tId = findTokenAt(coords.x, coords.y);
      if (tId) {
        const t = activeMapTokens.find(x => x.id === tId);
        if (t && canMoveToken(t)) {
          e.preventDefault();
          setDraggingToken(tId);
          didDragRef.current = false;
          return;
        }
      }
    }

    if (editable && coords && !addingPoint && !addingSpecialPoint && !addingToken) {
      const spId = findSpecialPointAt(coords.x, coords.y);
      if (spId) {
        e.preventDefault();
        setDraggingSpecialPoint(spId);
        didDragRef.current = false;
        return;
      }
    }

    if (editable && coords && !addingPoint && !addingSpecialPoint && !addingToken) {
      const hit = findPointAt(coords.x, coords.y);
      if (hit) {
        e.preventDefault();
        setDraggingPoint(hit);
        didDragRef.current = false;
        return;
      }
    }

    e.preventDefault();
    setIsPanning(true);
    setHoveredPoint(null);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (draggingBeast) {
      const coords = clientToMap(e.clientX, e.clientY);
      if (!coords) return;
      didDragRef.current = true;
      setBeasts(prev => prev.map(b => b.id === draggingBeast ? { ...b, x: coords.x, y: coords.y } : b));
      if (throttleWrite(`beast:${draggingBeast}`)) {
        supabase.from('map_beasts').update({ x: coords.x, y: coords.y }).eq('id', draggingBeast);
      }
      return;
    }
    if (draggingToken) {
      const coords = clientToMap(e.clientX, e.clientY);
      if (!coords) return;
      didDragRef.current = true;
      setTokens(prev => prev.map(t => t.id === draggingToken ? { ...t, x: coords.x, y: coords.y } : t));
      if (throttleWrite(`token:${draggingToken}`)) {
        supabase.from('map_tokens').update({ x: coords.x, y: coords.y }).eq('id', draggingToken);
      }
      // Reveal fog as token moves
      const tok = tokens.find(t => t.id === draggingToken);
      if (tok && fogEnabled) revealFog(coords.x, coords.y, tok.reveal_radius);
      return;
    }
    if (draggingSpecialPoint) {
      const coords = clientToMap(e.clientX, e.clientY);
      if (!coords) return;
      didDragRef.current = true;
      setSpecialPoints(prev => prev.map(sp =>
        sp.id === draggingSpecialPoint ? { ...sp, x: coords.x, y: coords.y } : sp
      ));
      if (throttleWrite(`sp:${draggingSpecialPoint}`)) {
        supabase.from('special_map_points').update({ x: coords.x, y: coords.y }).eq('id', draggingSpecialPoint);
      }
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
      if (throttleWrite(`pt:${draggingPoint.pointId}`)) {
        supabase.from('map_points').update({ x: coords.x, y: coords.y }).eq('id', draggingPoint.pointId);
      }
      return;
    }
    if (isPanning) {
      setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }

  function handleMouseUp() {
    // Beast: short click → open edit; drag end → save position
    if (beastPressRef.current) {
      clearTimeout(beastPressRef.current.timer);
      const pressedId = beastPressRef.current.id;
      beastPressRef.current = null;
      if (!draggingBeast && !didDragRef.current) {
        const b = beasts.find(x => x.id === pressedId);
        if (b) setEditBeast(b);
      }
    }
    if (draggingBeast) {
      const b = beasts.find(x => x.id === draggingBeast);
      if (b && didDragRef.current) saveBeastPosition(draggingBeast, b.x, b.y);
      setDraggingBeast(null);
    }
    if (draggingToken) {
      const t = tokens.find(x => x.id === draggingToken);
      if (t && didDragRef.current) saveTokenPosition(draggingToken, t.x, t.y);
      setDraggingToken(null);
      lastFogPosRef.current = null;
    }
    if (draggingSpecialPoint) {
      const sp = specialPoints.find(s => s.id === draggingSpecialPoint);
      if (sp && didDragRef.current) saveSpecialPointPosition(draggingSpecialPoint, sp.x, sp.y);
      setDraggingSpecialPoint(null);
    }
    if (draggingPoint) {
      const route = routes.find(r => r.id === draggingPoint.routeId);
      const point = route?.points.find(p => p.id === draggingPoint.pointId);
      if (point && didDragRef.current) savePointPosition(draggingPoint.routeId, draggingPoint.pointId, point.x, point.y);
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

  function getCursor(): string {
    if (draggingPoint || draggingSpecialPoint || draggingToken || draggingBeast) return 'grabbing';
    if (addingPoint || addingSpecialPoint || addingToken || addingBeast) return 'crosshair';
    if (isPanning) return 'grabbing';
    return 'grab';
  }

  const activeRoute = routes.find(r => r.id === activeRouteId);
  const activeDistKm = activeRoute ? routeDistanceKm(activeRoute) : 0;

  return (
    <div className="h-[calc(100vh-3rem)] relative">
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
            src={activeMapUrl}
            alt="Mapa"
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
            {/* Fog of war overlay */}
            {fogEnabled && showFog && (
              <>
                <defs>
                  <mask id={`fog-mask-${activeMapId}`}>
                    <rect x="0" y="0" width={naturalSize.w} height={naturalSize.h} fill="white" />
                    {activeFogReveals.map(f => (
                      <circle key={f.id} cx={f.x} cy={f.y} r={f.radius} fill="black" />
                    ))}
                    {/* Live token reveals (always visible while token exists) */}
                    {activeMapTokens.map(t => (
                      <circle key={`tok-${t.id}`} cx={t.x} cy={t.y} r={t.reveal_radius} fill="black" />
                    ))}
                  </mask>
                  <radialGradient id={`fog-fade-${activeMapId}`}>
                    <stop offset="60%" stopColor="black" stopOpacity="0" />
                    <stop offset="100%" stopColor="black" stopOpacity="0.85" />
                  </radialGradient>
                </defs>
                <rect
                  x="0" y="0" width={naturalSize.w} height={naturalSize.h}
                  fill="black" opacity={(isAdmin || isEditor) ? 0.55 : 1.0}
                  mask={`url(#fog-mask-${activeMapId})`}
                />
                {/* Soft edges only for admin/editor view */}
                {(isAdmin || isEditor) && activeMapTokens.map(t => (
                  <circle
                    key={`tok-fade-${t.id}`}
                    cx={t.x} cy={t.y} r={t.reveal_radius}
                    fill={`url(#fog-fade-${activeMapId})`}
                  />
                ))}
              </>
            )}

            {visibleRoutes.filter(r => r.visible).map(r => (
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
                  <g key={p.id} style={{ pointerEvents: 'auto', cursor: editable ? 'move' : 'pointer' }}
                    onMouseEnter={(e) => setHoveredPoint({ routeId: r.id, pointId: p.id, clientX: e.clientX, clientY: e.clientY })}
                    onMouseMove={(e) => { if (hoveredPoint?.pointId === p.id) setHoveredPoint(prev => prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null); }}
                    onMouseLeave={() => { if (hoveredPoint?.pointId === p.id) setHoveredPoint(null); }}
                  >
                    <circle cx={p.x} cy={p.y} r={6 / scale} fill={r.color} stroke="white" strokeWidth={2 / scale} />
                    <circle cx={p.x} cy={p.y} r={14 / scale} fill="transparent" />
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
                <text x={sp.x} y={sp.y} textAnchor="middle" dominantBaseline="central" fontSize={22 / scale} style={{ pointerEvents: 'none' }}>⭐</text>
                <circle cx={sp.x} cy={sp.y} r={14 / scale} fill="transparent" />
                {sp.name && (
                  <text x={sp.x + 14 / scale} y={sp.y - 14 / scale} fill="#FFD700" stroke="black" strokeWidth={3 / scale} paintOrder="stroke" fontSize={13 / scale} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                    {sp.name}
                  </text>
                )}
                {(isAdmin || isEditor) && !sp.visible_to_viewers && (
                  <text x={sp.x + 14 / scale} y={sp.y + 4 / scale} fill="#ff6666" stroke="black" strokeWidth={2 / scale} paintOrder="stroke" fontSize={10 / scale} style={{ pointerEvents: 'none' }}>🔒 skrytý</text>
                )}
              </g>
            ))}

            {/* Tokens (player characters) */}
            {activeMapTokens.map(t => {
              const canMove = canMoveToken(t);
              return (
                <g key={t.id} style={{ pointerEvents: 'auto', cursor: canMove ? 'move' : 'pointer' }}>
                  {/* Vision radius indicator (faint) */}
                  {fogEnabled && (
                    <circle cx={t.x} cy={t.y} r={t.reveal_radius} fill="none" stroke={t.color} strokeWidth={1 / scale} strokeDasharray={`${4 / scale} ${4 / scale}`} opacity={0.4} />
                  )}
                  <circle cx={t.x} cy={t.y} r={14 / scale} fill={t.color} stroke="white" strokeWidth={3 / scale} />
                  <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="central" fontSize={16 / scale} fill="white" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                    {t.name.charAt(0).toUpperCase()}
                  </text>
                  <text x={t.x + 16 / scale} y={t.y - 14 / scale} fill="white" stroke="black" strokeWidth={3 / scale} paintOrder="stroke" fontSize={12 / scale} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                    {LIGHT_SOURCES[t.light_source]?.emoji || ''} {t.name}
                  </text>
                </g>
              );
            })}

            {/* Beasts (monsters placed by GM) */}
            {visibleBeastsForUser.map(b => {
              const isHidden = !b.revealed;
              const isDead = b.current_hp <= 0;
              const size = 22 / scale;
              const fillColor = isDead ? '#9ca3af' : '#ffffff';
              const borderColor = isDead ? '#6b7280' : '#dc2626';
              const textColor = isDead ? '#4b5563' : '#000000';
              return (
                <g key={b.id} style={{ pointerEvents: 'auto', cursor: editBeasts ? 'pointer' : 'pointer' }}
                  opacity={isHidden ? 0.5 : 1}>
                  {(isAdmin || isEditor) && (
                    <circle cx={b.x} cy={b.y} r={b.reveal_radius} fill="none" stroke={borderColor} strokeWidth={1 / scale} strokeDasharray={`${3 / scale} ${5 / scale}`} opacity={0.3} />
                  )}
                  {/* Square token: white bg, red border, black text */}
                  <rect x={b.x - size} y={b.y - size} width={size * 2} height={size * 2}
                    fill={fillColor} stroke={borderColor} strokeWidth={3 / scale} rx={2 / scale} />
                  <text x={b.x} y={b.y} textAnchor="middle" dominantBaseline="central"
                    fontSize={18 / scale} fill={textColor} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                    {b.short_code}
                  </text>
                  {isDead && (
                    <line x1={b.x - size} y1={b.y - size} x2={b.x + size} y2={b.y + size}
                      stroke="#374151" strokeWidth={2 / scale} style={{ pointerEvents: 'none' }} />
                  )}
                  {(isAdmin || isEditor) && (
                    <text x={b.x + size + 4 / scale} y={b.y - size} fill="#ff8888" stroke="black" strokeWidth={3 / scale} paintOrder="stroke" fontSize={11 / scale} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                      {isHidden ? (b.stealth_mode === 'manual' ? '🫥 záloha' : b.stealth_mode === 'auto' ? '👀 čeká' : '❓ skrytá') : ''} {b.name} (úr.{b.level}){isDead ? ' ☠' : ''}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Point distance tooltip */}
        {hoveredPoint && (() => {
          const route = routes.find(r => r.id === hoveredPoint.routeId);
          if (!route) return null;
          const pointIndex = route.points.findIndex(p => p.id === hoveredPoint.pointId);
          if (pointIndex < 0) return null;
          const point = route.points[pointIndex];
          const typeIcon = { city: '🏰', village: '🏠', cave: '🕳️', forest: '🌲', camp: '⛺', ruins: '🏚️', temple: '⛪', tavern: '🍺', road: '🛤️', meadow: '🌾', landmark: '⭐', battlefield: '⚔️', dam: '🌊', ford: '🚿', mountains: '⛰️', generic: '📍' }[point.point_type] || '📍';

          let segDistKm = 0;
          if (pointIndex > 0) {
            const prev = route.points[pointIndex - 1];
            segDistKm = Math.sqrt((point.x - prev.x) ** 2 + (point.y - prev.y) ** 2) / (settings.pixels_per_km || 1);
          }
          let fromStartKm = 0;
          for (let i = 1; i <= pointIndex; i++) {
            const a = route.points[i - 1], b = route.points[i];
            fromStartKm += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) / (settings.pixels_per_km || 1);
          }

          const containerRect = containerRef.current?.getBoundingClientRect();
          const tooltipX = hoveredPoint.clientX - (containerRect?.left || 0) + 16;
          const tooltipY = hoveredPoint.clientY - (containerRect?.top || 0) - 10;

          return (
            <div
              className="absolute z-50 bg-card/95 backdrop-blur border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none"
              style={{ left: tooltipX, top: tooltipY, maxWidth: 280 }}
            >
              <div className="text-xs font-semibold text-foreground mb-1">{typeIcon} {point.label || `Bod ${pointIndex + 1}`}</div>
              {pointIndex > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground mb-0.5 font-medium">Z předchozího bodu ({segDistKm.toFixed(1)} km):</div>
                  <div className="flex gap-2 text-[10px] mb-1">
                    <span>🚶 {formatTime(segDistKm / settings.speed_walk)}</span>
                    <span>🐴 {formatTime(segDistKm / settings.speed_horse)}</span>
                    <span>🧹 {formatTime(segDistKm / settings.speed_broom)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-0.5 font-medium">Od startu ({fromStartKm.toFixed(1)} km):</div>
                  <div className="flex gap-2 text-[10px]">
                    <span>🚶 {formatTime(fromStartKm / settings.speed_walk)}</span>
                    <span>🐴 {formatTime(fromStartKm / settings.speed_horse)}</span>
                    <span>🧹 {formatTime(fromStartKm / settings.speed_broom)}</span>
                  </div>
                </>
              )}
              {pointIndex === 0 && <div className="text-[10px] text-muted-foreground">📍 Startovní bod trasy</div>}
            </div>
          );
        })()}

        {/* Floating toolbar */}
        <div className="absolute top-3 left-3 flex items-center gap-1 z-10 flex-wrap">
          <Button size="sm" variant="secondary" className="h-8 shadow-md gap-1.5 text-xs" onClick={() => setRoutesDialogOpen(true)}>
            <Route size={14} /> Trasy
          </Button>
          <Button size="sm" variant="secondary" className="h-8 shadow-md gap-1.5 text-xs" onClick={() => setSpecialPointsDialogOpen(true)}>
            <Star size={14} /> Speciální body
          </Button>
          <Button size="sm" variant="secondary" className="h-8 shadow-md gap-1.5 text-xs" onClick={() => setTokensDialogOpen(true)}>
            <Users size={14} /> Postavy ({activeMapTokens.length})
          </Button>
          {editable && (
            <Button size="sm" variant="secondary" className="h-8 shadow-md gap-1.5 text-xs" onClick={() => setMapsDialogOpen(true)}>
              <Image size={14} /> Mapy
            </Button>
          )}
          {editable && (
            <Button size="sm" variant="secondary" className="h-8 w-8 shadow-md p-0" onClick={() => { setTempSettings(settings); setSettingsOpen(true); }} title="Nastavení mapy">
              <Settings size={14} />
            </Button>
          )}
          {fogEnabled && (
            <Button size="sm" variant="secondary" className="h-8 shadow-md gap-1.5 text-xs" onClick={() => setShowFog(!showFog)} title="Zobrazit/skrýt zatmavení">
              <Cloud size={14} /> {showFog ? 'Skrýt mlhu' : 'Zobrazit mlhu'}
            </Button>
          )}
          {editable && activeRouteId && (
            <Button size="sm" variant={addingPoint ? 'default' : 'secondary'} className="h-8 shadow-md gap-1.5 text-xs" onClick={() => { setAddingPoint(!addingPoint); setAddingSpecialPoint(false); setAddingToken(false); }}>
              <MapPin size={14} /> {addingPoint ? 'Klikni na mapu...' : 'Přidat bod'}
            </Button>
          )}
          {editable && (
            <Button size="sm" variant={addingSpecialPoint ? 'default' : 'secondary'} className="h-8 shadow-md gap-1.5 text-xs" onClick={() => { setAddingSpecialPoint(!addingSpecialPoint); setAddingPoint(false); setAddingToken(false); }}>
              <Star size={14} /> {addingSpecialPoint ? 'Klikni na mapu...' : 'Nový ⭐'}
            </Button>
          )}
          {editable && activeMapId && (
            <Button size="sm" variant={addingToken ? 'default' : 'secondary'} className="h-8 shadow-md gap-1.5 text-xs" onClick={() => { setAddingToken(!addingToken); setAddingPoint(false); setAddingSpecialPoint(false); }}>
              <Users size={14} /> {addingToken ? 'Klikni na mapu...' : 'Přidat postavu'}
            </Button>
          )}
          {editBeasts && activeMapId && (
            <Button size="sm" variant={addingBeast ? 'default' : 'secondary'} className="h-8 shadow-md gap-1.5 text-xs" onClick={() => { setAddingBeast(!addingBeast); setAddingPoint(false); setAddingSpecialPoint(false); setAddingToken(false); }}>
              👹 {addingBeast ? 'Klikni na mapu...' : 'Přidat bestii'}
            </Button>
          )}
          {editBeasts && activeMapId && beasts.filter(b => b.map_id === activeMapId).length > 0 && (
            <Button size="sm" variant="secondary" className="h-8 shadow-md gap-1.5 text-xs" onClick={() => setBeastsDialogOpen(true)}>
              📋 Bestie ({activeMapBeasts.length})
            </Button>
          )}
        </div>

        {/* Active route info */}
        {routes.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-card/90 backdrop-blur border border-border rounded-md px-2 py-1.5 shadow-md max-w-[90%]">
            <div className="flex items-center gap-2 text-xs">
              <button className="p-0.5 rounded hover:bg-secondary transition-colors" onClick={() => {
                const idx = routes.findIndex(r => r.id === activeRouteId);
                const prev = idx <= 0 ? routes.length - 1 : idx - 1;
                setActiveRouteId(routes[prev].id);
              }}><ChevronLeft size={16} /></button>
              {activeRoute && (
                <>
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
                </>
              )}
              <button className="p-0.5 rounded hover:bg-secondary transition-colors" onClick={() => {
                const idx = routes.findIndex(r => r.id === activeRouteId);
                const next = idx >= routes.length - 1 ? 0 : idx + 1;
                setActiveRouteId(routes[next].id);
              }}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {/* Zoom buttons */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
          <Button size="icon" variant="secondary" className="h-9 w-9 rounded-md shadow-md" onClick={() => zoomBy(1.2)} title="Přiblížit"><Plus size={18} /></Button>
          <Button size="icon" variant="secondary" className="h-9 w-9 rounded-md shadow-md" onClick={() => zoomBy(0.8)} title="Oddálit"><Minus size={18} /></Button>
        </div>
      </div>

      {/* Routes dialog */}
      <Dialog open={routesDialogOpen} onOpenChange={setRoutesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Route size={18} /> Správa tras</DialogTitle></DialogHeader>
          <div className="flex gap-4 flex-1 min-h-0 overflow-auto">
            <div className="w-[280px] shrink-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {editable && <Button size="sm" variant="outline" onClick={addRoute} className="h-7 text-xs"><Plus size={12} className="mr-1" /> Nová trasa</Button>}
                {routes.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => {
                      const allVisible = routes.every(r => r.visible);
                      setRoutes(prev => prev.map(r => ({ ...r, visible: !allVisible })));
                    }}>
                    {routes.every(r => r.visible) ? <EyeOff size={12} className="mr-1" /> : <Eye size={12} className="mr-1" />}
                    {routes.every(r => r.visible) ? 'Skrýt vše' : 'Zobrazit vše'}
                  </Button>
                )}
              </div>
              <div className="space-y-1 max-h-[50vh] overflow-auto">
                {routes.map(r => {
                  const dist = routeDistanceKm(r);
                  return (
                    <div key={r.id}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${r.id === activeRouteId ? 'bg-secondary text-primary font-semibold' : 'hover:bg-secondary/50 text-foreground'}`}
                      onClick={() => setActiveRouteId(r.id)}>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      <span className="truncate flex-1">{r.name}</span>
                      <span className="text-muted-foreground">{dist.toFixed(1)} km</span>
                      <button onClick={(e) => { e.stopPropagation(); setRoutes(prev => prev.map(x => x.id === r.id ? { ...x, visible: !x.visible } : x)); }}>
                        {r.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      {editable && <>
                        <button onClick={(e) => { e.stopPropagation(); setRenameName(r.name); setRenameOpen(r.id); }}><Edit2 size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteRoute(r.id); }} className="text-destructive"><Trash2 size={12} /></button>
                      </>}
                    </div>
                  );
                })}
                {routes.length === 0 && <p className="text-xs text-muted-foreground">Žádné trasy</p>}
              </div>
            </div>
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
                            <button onClick={() => setEditPointLabel({ routeId: activeRoute.id, pointId: p.id, label: p.label, description: p.description, point_type: p.point_type })}><Edit2 size={10} /></button>
                            <button onClick={() => deletePoint(activeRoute.id, p.id)} className="text-destructive"><Trash2 size={10} /></button>
                          </>}
                        </div>
                      );
                    })}
                    {activeRoute.points.length === 0 && <p className="text-xs text-muted-foreground">Žádné body v trase</p>}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">Vyberte trasu ze seznamu vlevo</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Special points dialog */}
      <Dialog open={specialPointsDialogOpen} onOpenChange={setSpecialPointsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Star size={18} className="text-yellow-400" /> Speciální body — {activeMap?.name || 'aktivní mapa'}</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowSpecialPoints(!showSpecialPoints)}>
              {showSpecialPoints ? <EyeOff size={12} className="mr-1" /> : <Eye size={12} className="mr-1" />}
              {showSpecialPoints ? 'Skrýt na mapě' : 'Zobrazit na mapě'}
            </Button>
            <p className="text-[10px] text-muted-foreground">Zobrazují se body přiřazené této mapě + globální (bez přiřazení).</p>
          </div>
          <div className="flex gap-4 flex-1 min-h-0 overflow-auto">
            <div className="w-[250px] shrink-0 space-y-1 max-h-[50vh] overflow-auto">
              {visibleSpecialPoints.map(sp => (
                <div key={sp.id}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${viewSpecialPoint?.id === sp.id ? 'bg-secondary text-primary font-semibold' : 'hover:bg-secondary/50 text-foreground'}`}
                  onClick={() => setViewSpecialPoint(sp)}>
                  <span>⭐</span>
                  <span className="truncate flex-1">{sp.name || 'Bez názvu'}</span>
                  {sp.map_id === null && <span className="text-[10px] text-muted-foreground">🌐</span>}
                  {(isAdmin || isEditor) && !sp.visible_to_viewers && <span className="text-destructive text-[10px]">🔒</span>}
                  {editable && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setEditSpecialPoint(sp); }}><Edit2 size={10} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteSpecialPoint(sp.id); }} className="text-destructive"><Trash2 size={10} /></button>
                    </>
                  )}
                </div>
              ))}
              {visibleSpecialPoints.length === 0 && <p className="text-xs text-muted-foreground">Žádné speciální body</p>}
            </div>
            <div className="border-l border-border pl-4 flex-1 min-w-0">
              {viewSpecialPoint ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><span>⭐</span> {viewSpecialPoint.name || 'Bez názvu'}</h3>
                  {viewSpecialPoint.description ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{viewSpecialPoint.description}</p>
                  ) : <p className="text-sm text-muted-foreground italic">Žádný popis.</p>}
                  {(isAdmin || isEditor) && (
                    <p className="text-xs text-muted-foreground">
                      {viewSpecialPoint.visible_to_viewers ? '👁️ Viditelné pro všechny' : '🔒 Pouze admin/editor'} •
                      {viewSpecialPoint.map_id === null ? ' 🌐 Globální (všechny mapy)' : ' 📍 Pouze tato mapa'}
                    </p>
                  )}
                  {editable && (
                    <Button variant="outline" size="sm" onClick={() => { setEditSpecialPoint(viewSpecialPoint); }}>
                      <Edit2 size={14} className="mr-1" /> Upravit
                    </Button>
                  )}
                </div>
              ) : <p className="text-sm text-muted-foreground">Klikněte na bod v seznamu pro zobrazení detailu</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tokens dialog */}
      <Dialog open={tokensDialogOpen} onOpenChange={setTokensDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users size={18} /> Postavy na mapě — {activeMap?.name || 'aktivní mapa'}</DialogTitle></DialogHeader>
          <div className="space-y-2 overflow-auto flex-1">
            {!fogEnabled && (
              <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                💡 Pro funkci objevování mapy zapněte <strong>Zatmavení mapy (Fog of War)</strong> v dialogu Mapy.
              </p>
            )}
            {activeMapTokens.length === 0 && <p className="text-sm text-muted-foreground">Žádné postavy na této mapě.</p>}
            {activeMapTokens.map(t => {
              const owner = allUsers.find(u => u.id === t.owner_user_id);
              return (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded border border-border">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: t.color }}>{t.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{LIGHT_SOURCES[t.light_source]?.emoji} {t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {LIGHT_SOURCES[t.light_source]?.label} • dosvit {t.reveal_radius}px
                      {owner && ` • hráč: ${owner.email}`}
                      {!owner && ' • bez hráče'}
                    </p>
                  </div>
                  {editable && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditToken(t)}><Edit2 size={12} /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm('Smazat postavu?')) deleteToken(t.id); }}><Trash2 size={12} /></Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit token dialog */}
      <Dialog open={!!editToken} onOpenChange={() => setEditToken(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upravit postavu</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            <div>
              <label className="text-sm font-medium">Jméno</label>
              <Input value={editToken?.name || ''} onChange={e => setEditToken(prev => prev ? { ...prev, name: e.target.value } : null)} />
            </div>
            <div>
              <label className="text-sm font-medium">Barva</label>
              <div className="flex gap-1 flex-wrap mt-1">
                {TOKEN_COLORS.map(c => (
                  <button key={c} className={`w-7 h-7 rounded-full border-2 ${editToken?.color === c ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setEditToken(prev => prev ? { ...prev, color: c } : null)} />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Zdroj světla / vidění</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editToken?.light_source || 'default'}
                onChange={e => {
                  const src = e.target.value;
                  const def = LIGHT_SOURCES[src]?.radius ?? 80;
                  setEditToken(prev => prev ? { ...prev, light_source: src, reveal_radius: def } : null);
                }}>
                {Object.entries(LIGHT_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Poloměr vidění (px na mapě): {editToken?.reveal_radius}</label>
              <Slider min={20} max={500} step={10} value={[editToken?.reveal_radius || 60]} onValueChange={v => setEditToken(prev => prev ? { ...prev, reveal_radius: v[0] } : null)} />
            </div>
            <div>
              <label className="text-sm font-medium">Hráč (kdo s postavou hýbe)</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editToken?.owner_user_id || ''}
                onChange={e => setEditToken(prev => prev ? { ...prev, owner_user_id: e.target.value || null } : null)}>
                <option value="">— Bez hráče (jen admin/editor hýbe) —</option>
                {allUsers.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Poznámky</label>
              <Textarea value={editToken?.notes || ''} onChange={e => setEditToken(prev => prev ? { ...prev, notes: e.target.value } : null)} />
            </div>
          </div>
          <DialogFooter>
            {editToken && <Button variant="destructive" onClick={() => deleteToken(editToken.id)} className="mr-auto"><Trash2 size={14} className="mr-1" /> Smazat</Button>}
            <Button onClick={saveToken}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nastavení mapy{activeMapId ? ` – ${maps.find(m => m.id === activeMapId)?.name || ''}` : ''}</DialogTitle></DialogHeader>
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
          <DialogFooter><Button onClick={renameRoute}>Uložit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit point label dialog */}
      <Dialog open={!!editPointLabel} onOpenChange={() => setEditPointLabel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upravit bod</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Název</label>
              <Input value={editPointLabel?.label || ''} onChange={e => setEditPointLabel(prev => prev ? { ...prev, label: e.target.value } : null)} />
            </div>
            <div>
              <label className="text-sm font-medium">Typ lokace</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editPointLabel?.point_type || 'generic'}
                onChange={e => setEditPointLabel(prev => prev ? { ...prev, point_type: e.target.value } : null)}>
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
              <label className="text-sm font-medium">Popis místa</label>
              <textarea className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editPointLabel?.description || ''}
                onChange={e => setEditPointLabel(prev => prev ? { ...prev, description: e.target.value } : null)} />
            </div>
          </div>
          <DialogFooter><Button onClick={savePointLabel}>Uložit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit special point dialog */}
      <Dialog open={!!editSpecialPoint} onOpenChange={() => setEditSpecialPoint(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upravit speciální bod</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Název místa</label>
              <Input value={editSpecialPoint?.name || ''} onChange={e => setEditSpecialPoint(prev => prev ? { ...prev, name: e.target.value } : null)} />
            </div>
            <div>
              <label className="text-sm font-medium">Popis (co se tam nachází nebo stalo)</label>
              <Textarea className="min-h-[100px]" value={editSpecialPoint?.description || ''} onChange={e => setEditSpecialPoint(prev => prev ? { ...prev, description: e.target.value } : null)} />
            </div>
            <div>
              <label className="text-sm font-medium">Přiřadit k mapě</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editSpecialPoint?.map_id || ''}
                onChange={e => setEditSpecialPoint(prev => prev ? { ...prev, map_id: e.target.value || null } : null)}>
                <option value="">🌐 Globální (zobrazit na všech mapách)</option>
                {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">Pokud vyberete konkrétní mapu, bod se zobrazí jen na ní.</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editSpecialPoint?.visible_to_viewers ?? false} onCheckedChange={checked => setEditSpecialPoint(prev => prev ? { ...prev, visible_to_viewers: checked } : null)} />
              <label className="text-sm">Viditelné pro čtenáře (viewer)</label>
            </div>
          </div>
          <DialogFooter>
            {editSpecialPoint && <Button variant="destructive" onClick={() => deleteSpecialPoint(editSpecialPoint.id)} className="mr-auto"><Trash2 size={14} className="mr-1" /> Smazat</Button>}
            <Button onClick={saveSpecialPoint}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maps dialog */}
      <Dialog open={mapsDialogOpen} onOpenChange={setMapsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Image size={18} /> Správa map</DialogTitle></DialogHeader>
          <div className="space-y-4 overflow-auto flex-1">
            <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold">Nahrát novou mapu</h4>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Název mapy</label>
                  <Input value={newMapName} onChange={e => setNewMapName(e.target.value)} placeholder="Např. Mapa Othionu" className="h-9" />
                </div>
                <div>
                  <input ref={mapFileRef} type="file" accept="image/*" onChange={handleMapUpload} className="hidden" />
                  <Button size="sm" variant="outline" className="h-9" onClick={() => mapFileRef.current?.click()} disabled={uploadingMap}>
                    <Upload size={14} className="mr-1" />
                    {uploadingMap ? 'Nahrávám...' : 'Vybrat soubor'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Dostupné mapy ({maps.length})</h4>
              {maps.length === 0 && <p className="text-xs text-muted-foreground">Žádné mapy. Nahrajte první mapu výše.</p>}
              {maps.map(m => (
                <div key={m.id} className={`p-3 rounded-lg border space-y-2 ${m.is_active ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-center gap-3">
                    <img src={m.image_url} alt={m.name} className="w-16 h-12 object-cover rounded border border-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name || 'Bez názvu'}</p>
                      {m.is_active && <span className="text-xs text-primary font-medium flex items-center gap-1"><Check size={12} /> Aktivní</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      {!m.is_active && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => selectMap(m.id)}>Použít</Button>}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                        const newName = prompt('Nový název mapy:', m.name);
                        if (newName !== null && newName.trim()) renameMap(m.id, newName.trim());
                      }}><Edit2 size={12} /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Opravdu smazat tuto mapu?')) deleteMap(m.id); }}><Trash2 size={12} /></Button>
                    </div>
                  </div>
                  {/* Fog of war controls per map */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                    {editFog ? (
                      <Switch checked={m.fog_enabled} onCheckedChange={(v) => toggleMapFog(m.id, v)} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{m.fog_enabled ? '✅' : '❌'}</span>
                    )}
                    <label className="text-xs">🌫️ Zatmavení mapy (Fog of War)</label>
                    {m.fog_enabled && (
                      <>
                        <span className="text-[10px] text-muted-foreground ml-auto">Výchozí dosvit: {m.default_reveal_radius}px</span>
                        {editFog && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => clearFogForMap(m.id)}>
                            <RotateCcw size={11} className="mr-1" /> Reset
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  {m.fog_enabled && editFog && (
                    <div className="px-1">
                      <Slider min={20} max={300} step={10} value={[m.default_reveal_radius]} onValueChange={v => setMaps(prev => prev.map(x => x.id === m.id ? { ...x, default_reveal_radius: v[0] } : x))} onValueCommit={v => setMapRevealRadius(m.id, v[0])} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Beast: choose monster + level when adding new */}
      <Dialog open={!!editBeast && !editBeast.id} onOpenChange={o => { if (!o) { setEditBeast(null); setBeastForm(f => ({ ...f, pendingPos: null })); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Přidat bestii na mapu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Bestie z bestiáře</Label>
              <select className="w-full border rounded px-2 py-1.5 bg-background text-sm" value={beastForm.monster_id}
                onChange={e => setBeastForm(f => ({ ...f, monster_id: e.target.value }))}>
                <option value="">— vyber —</option>
                {monstersList.map(m => <option key={m.id} value={m.id}>{m.name}{m.is_unique ? ' ★' : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Úroveň od</Label><Input type="number" min={1} value={beastForm.level_min} onChange={e => setBeastForm(f => ({ ...f, level_min: parseInt(e.target.value) || 1 }))} /></div>
              <div><Label>Úroveň do</Label><Input type="number" min={1} value={beastForm.level_max} onChange={e => setBeastForm(f => ({ ...f, level_max: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <div>
              <Label>Dosvit/zorné pole</Label>
              <Input type="number" value={beastForm.reveal_radius} onChange={e => setBeastForm(f => ({ ...f, reveal_radius: parseInt(e.target.value) || 80 }))} />
            </div>
            <div>
              <Label>Stealth režim</Label>
              <select className="w-full border rounded px-2 py-1.5 bg-background text-sm" value={beastForm.stealth_mode}
                onChange={e => setBeastForm(f => ({ ...f, stealth_mode: e.target.value as any }))}>
                <option value="none">Viditelná hned</option>
                <option value="auto">Odhalí se přiblížením postavy</option>
                <option value="manual">Záloha — odhalí jen GM ručně</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setEditBeast(null); setBeastForm(f => ({ ...f, pendingPos: null })); }}>Zrušit</Button>
              <Button onClick={confirmAddBeast}>Přidat do mapy i do BOJ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Beast list / management */}
      <Dialog open={beastsDialogOpen} onOpenChange={setBeastsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Bestie na mapě</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1">
              {activeMapBeasts.map(b => (
                <button key={b.id} className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-secondary ${editBeast?.id === b.id ? 'bg-secondary' : ''}`} onClick={() => setEditBeast(b)}>
                  <span className="font-mono mr-2">[{b.short_code}]</span>{b.name} <span className="text-xs text-muted-foreground">úr.{b.level} • HP {b.current_hp}/{b.hp}</span>
                </button>
              ))}
              {activeMapBeasts.length === 0 && <p className="text-sm text-muted-foreground">Žádné bestie na této mapě.</p>}
            </div>
            <div>
              {editBeast && editBeast.id ? (
                <div className="space-y-2">
                  <div><Label>Jméno</Label><Input value={editBeast.name} onChange={e => setEditBeast({ ...editBeast, name: e.target.value })} /></div>
                  <div><Label>Zkratka</Label><Input maxLength={4} value={editBeast.short_code} onChange={e => setEditBeast({ ...editBeast, short_code: e.target.value.toUpperCase() })} /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label>Úroveň</Label><Input type="number" min={1} value={editBeast.level} onChange={e => setEditBeast({ ...editBeast, level: parseInt(e.target.value) || 1 })} /></div>
                    <div><Label>HP max</Label><Input type="number" min={1} value={editBeast.hp} onChange={e => setEditBeast({ ...editBeast, hp: parseInt(e.target.value) || 1 })} /></div>
                    <div><Label>HP nyní</Label><Input type="number" value={editBeast.current_hp} onChange={e => setEditBeast({ ...editBeast, current_hp: parseInt(e.target.value) || 0 })} /></div>
                  </div>
                  <div><Label>Dosvit</Label><Input type="number" value={editBeast.reveal_radius} onChange={e => setEditBeast({ ...editBeast, reveal_radius: parseInt(e.target.value) || 80 })} /></div>
                  <div>
                    <Label>Stealth</Label>
                    <select className="w-full border rounded px-2 py-1.5 bg-background text-sm" value={editBeast.stealth_mode}
                      onChange={e => setEditBeast({ ...editBeast, stealth_mode: e.target.value as any })}>
                      <option value="none">Viditelná</option>
                      <option value="auto">Auto-odhalení</option>
                      <option value="manual">Záloha</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={editBeast.revealed} onChange={e => setEditBeast({ ...editBeast, revealed: e.target.checked })} />
                    <Label className="!mt-0">Odhalená pro hráče</Label>
                  </div>
                  <div><Label>Poznámky</Label><Textarea value={editBeast.notes} onChange={e => setEditBeast({ ...editBeast, notes: e.target.value })} /></div>
                  <div className="flex justify-between pt-2">
                    <Button variant="destructive" size="sm" onClick={() => deleteBeast(editBeast.id)}>Smazat</Button>
                    <Button size="sm" onClick={saveBeast}>Uložit</Button>
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">Vyber bestii v seznamu.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick edit dialog when clicking beast token on map */}
      <Dialog open={!!editBeast && !!editBeast.id && !beastsDialogOpen} onOpenChange={o => { if (!o) setEditBeast(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bestie: {editBeast?.name}</DialogTitle></DialogHeader>
          {editBeast && editBeast.id && (
            <div className="space-y-2">
              <div><Label>Jméno</Label><Input value={editBeast.name} onChange={e => setEditBeast({ ...editBeast, name: e.target.value })} /></div>
              <div><Label>Zkratka</Label><Input maxLength={4} value={editBeast.short_code} onChange={e => setEditBeast({ ...editBeast, short_code: e.target.value.toUpperCase() })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Úroveň</Label><Input type="number" min={1} value={editBeast.level} onChange={e => setEditBeast({ ...editBeast, level: parseInt(e.target.value) || 1 })} /></div>
                <div><Label>HP max</Label><Input type="number" min={1} value={editBeast.hp} onChange={e => setEditBeast({ ...editBeast, hp: parseInt(e.target.value) || 1 })} /></div>
                <div><Label>HP nyní</Label><Input type="number" value={editBeast.current_hp} onChange={e => setEditBeast({ ...editBeast, current_hp: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div><Label>Dosvit</Label><Input type="number" value={editBeast.reveal_radius} onChange={e => setEditBeast({ ...editBeast, reveal_radius: parseInt(e.target.value) || 80 })} /></div>
              <div>
                <Label>Stealth</Label>
                <select className="w-full border rounded px-2 py-1.5 bg-background text-sm" value={editBeast.stealth_mode}
                  onChange={e => setEditBeast({ ...editBeast, stealth_mode: e.target.value as any })}>
                  <option value="none">Viditelná</option>
                  <option value="auto">Auto-odhalení</option>
                  <option value="manual">Záloha</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="rev-quick" checked={editBeast.revealed} onChange={e => setEditBeast({ ...editBeast, revealed: e.target.checked })} />
                <Label htmlFor="rev-quick" className="!mt-0">Odhalená pro hráče</Label>
              </div>
              <div><Label>Poznámky</Label><Textarea value={editBeast.notes} onChange={e => setEditBeast({ ...editBeast, notes: e.target.value })} /></div>
              <div className="flex justify-between pt-2">
                <Button variant="destructive" size="sm" onClick={() => deleteBeast(editBeast.id)}>Smazat</Button>
                <Button size="sm" onClick={saveBeast}>Uložit</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
