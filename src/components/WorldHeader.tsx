import { Globe, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorld } from '@/contexts/WorldContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';

export default function WorldHeader() {
  const { activeWorld, isActiveOwner, worlds } = useWorld();
  const { isEditor, isAdmin } = useUserRole();

  if (!activeWorld) return null;

  const role = isActiveOwner
    ? 'Vlastník'
    : isAdmin
    ? 'Admin'
    : isEditor
    ? 'Editor'
    : 'Prohlížející';

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Globe size={16} className="text-primary shrink-0" />
        <span className="font-display text-sm truncate">{activeWorld.name}</span>
        <Badge variant="secondary" className="text-[10px] shrink-0">{role}</Badge>
      </div>
      {worlds.length > 1 ? (
        <Link to="/svety" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 shrink-0">
          Přepnout svět <ChevronRight size={12} />
        </Link>
      ) : (
        <Link to="/svety" className="text-xs text-muted-foreground hover:text-primary shrink-0">
          Spravovat
        </Link>
      )}
    </div>
  );
}
