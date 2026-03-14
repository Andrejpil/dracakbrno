import { useState, useEffect } from 'react';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';

const ROLE_LABELS: Record<AppRole, string> = {
  viewer: '1 – Prohlížení',
  editor: '2 – Editor',
  admin: '3 – Admin',
};

export default function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, getAllUsers, setUserRole } = useUserRole();
  const [users, setUsers] = useState<{ id: string; email: string; role: AppRole }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  async function loadUsers() {
    setLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  }

  if (!isAdmin) {
    return (
      <div className="animate-fade-in">
        <h2 className="text-2xl font-display text-primary mb-6">Správa uživatelů</h2>
        <p className="text-muted-foreground">Nemáte oprávnění pro přístup k této stránce.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display text-primary mb-6">Správa uživatelů</h2>
      {loading ? (
        <p className="text-muted-foreground">Načítání...</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-card rounded-lg p-4 border border-border flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-foreground font-semibold truncate">{u.email}</p>
                {u.id === user?.id && <span className="text-xs text-primary">(Vy)</span>}
              </div>
              <Select
                value={u.role}
                onValueChange={async (v: AppRole) => {
                  await setUserRole(u.id, v);
                  setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: v } : x));
                }}
                disabled={u.id === user?.id}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">{ROLE_LABELS.viewer}</SelectItem>
                  <SelectItem value="editor">{ROLE_LABELS.editor}</SelectItem>
                  <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
