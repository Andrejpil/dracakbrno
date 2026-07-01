import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-primary transition-colors w-full"
      title={theme === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      {theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
    </button>
  );
}
