import { NavLink, useLocation } from 'react-router-dom';
import { Sword, BookOpen, Swords, Star, BarChart3, Download, LogOut, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

const links = [
  { to: '/', label: 'Hrdinové', icon: Sword },
  { to: '/bestiar', label: 'Bestiář', icon: BookOpen },
  { to: '/boj', label: 'Boj', icon: Swords },
  { to: '/zkusenosti', label: 'Zkušenosti', icon: Star },
  { to: '/statistika', label: 'Statistika', icon: BarChart3 },
  { to: '/export', label: 'Export / Import', icon: Download },
];

export default function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const allLinks = isAdmin ? [...links, { to: '/admin', label: 'Uživatelé', icon: Users }] : links;
  return (
    <aside className="w-48 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col py-6 px-3 shrink-0">
      <h1 className="font-display text-lg text-primary mb-8 px-2 leading-tight">
        Dračí Doupě
      </h1>
      <nav className="flex flex-col gap-1 flex-1">
        {allLinks.map(({ to, label, icon: Icon }) => {
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
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground px-2 mb-2 truncate">{user?.email}</p>
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
