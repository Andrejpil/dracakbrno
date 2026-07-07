import { NavLink, useLocation } from 'react-router-dom';
import { Sword, BookOpen, Swords, Star, BarChart3, Download, LogOut, Users, Map, UserCircle, Dices, ScrollText, Globe, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useWorld } from '@/contexts/WorldContext';
import CalendarWidget from '@/components/CalendarWidget';
import ThemeToggle from '@/components/ThemeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const allLinks = [
  { to: '/', label: 'Hrdinové', icon: Sword, page: 'heroes' },
  { to: '/bestiar', label: 'Bestiář', icon: BookOpen, page: 'bestiary' },
  { to: '/boj', label: 'Boj', icon: Swords, page: 'battle' },
  { to: '/setkani', label: 'Setkání', icon: Dices, page: 'battle' },
  { to: '/zkusenosti', label: 'Zkušenosti', icon: Star, page: 'xp' },
  { to: '/statistika', label: 'Statistika', icon: BarChart3, page: 'stats' },
  { to: '/npc', label: 'NPC', icon: UserCircle, page: 'npc' },
  { to: '/kronika', label: 'Kronika', icon: ScrollText, page: 'heroes' },
  { to: '/export', label: 'Export / Import', icon: Download, page: 'export' },
  { to: '/mapa', label: 'Mapa', icon: Map, page: 'map' },
];

export default function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin, canView } = useUserRole();
  const { worlds, activeWorldId, setActiveWorldId } = useWorld();

  const visibleLinks = allLinks.filter(l => canView(l.page));
  const withWorlds = [...visibleLinks, { to: '/svety', label: 'Světy', icon: Globe, page: 'worlds' }];
  const withSettings = [...withWorlds, { to: '/nastaveni', label: 'Nastavení', icon: Settings, page: 'settings' }];
  const finalLinks = isAdmin
    ? [...withSettings, { to: '/admin', label: 'Uživatelé', icon: Users, page: 'admin' }]
    : withSettings;

  return (
    <aside className="w-52 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col py-6 px-3 shrink-0">
      <h1 className="font-display text-lg text-primary mb-4 px-2 leading-tight">
        Dračí Doupě
      </h1>
      {worlds.length > 0 && activeWorldId && (
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">Svět</span>
          <Select value={activeWorldId} onValueChange={setActiveWorldId}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {worlds.map(w => (<SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      )}
      <CalendarWidget />
      <nav className="flex flex-col gap-1 flex-1">
        {finalLinks.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-sidebar-accent text-primary font-semibold'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-sidebar-border space-y-1">
        <ThemeToggle />
        <p className="text-xs text-muted-foreground px-2 mb-2 mt-2 truncate">{user?.email}</p>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-destructive transition-colors w-full"
        >
          <LogOut size={18} />
          Odhlásit se
        </button>
      </div>
    </aside>
  );
}
