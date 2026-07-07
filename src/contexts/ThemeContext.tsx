import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useUserSettings, ThemeName } from '@/hooks/useUserSettings';

const THEME_TO_CLASSES: Record<ThemeName, string[]> = {
  dark: ['dark'],
  light: ['light'],
  emerald: ['dark', 'theme-emerald'],
  royal: ['dark', 'theme-royal'],
  crimson: ['dark', 'theme-crimson'],
  parchment: ['light', 'theme-parchment'],
};

const ALL_CLASSES = ['light', 'dark', 'theme-emerald', 'theme-royal', 'theme-crimson', 'theme-parchment'];

const ThemeContext = createContext<{ theme: ThemeName; toggle: () => void; setTheme: (t: ThemeName) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useUserSettings();
  const theme = settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    ALL_CLASSES.forEach(c => root.classList.remove(c));
    THEME_TO_CLASSES[theme].forEach(c => root.classList.add(c));
    localStorage.setItem('dd-theme', theme);
  }, [theme]);

  const setTheme = (t: ThemeName) => { update({ theme: t }); };
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
