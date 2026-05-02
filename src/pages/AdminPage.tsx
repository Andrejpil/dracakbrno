import { useState, useEffect } from 'react';
import { useUserRole, AppRole, Permission } from '@/hooks/useUserRole';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ROLE_LABELS: Record<AppRole, string> = {
  viewer: '1 – Prohlížení',
  editor: '2 – Editor',
  admin: '3 – Admin',
};

const PAGE_LABELS: Record<string, string> = {
  heroes: 'Hrdinové',
  bestiary: 'Bestiář',
  battle: 'Boj',
  xp: 'Zkušenosti',
  stats: 'Statistika',
  npc: 'NPC',
  export: 'Export / Import',
  map: 'Mapa – přístup',
  map_routes: '  ↳ Trasy',
  map_special: '  ↳ Speciální body',
  map_tokens: '  ↳ Postavy hráčů',
  map_fog: '  ↳ Mlha (Fog of War)',
  map_beasts: '  ↳ Bestie na mapě',
};

const PAGES = ['heroes', 'bestiary', 'battle', 'xp', 'stats', 'npc', 'export', 'map', 'map_routes', 'map_special', 'map_tokens', 'map_fog', 'map_beasts'];

export default function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, getAllUsers, setUserRole, deleteUser, getPermissions, updatePermission } = useUserRole();
  const [users, setUsers] = useState<{ id: string; email: string; role: AppRole }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerPerms, setViewerPerms] = useState<Permission[]>([]);
  const [editorPerms, setEditorPerms] = useState<Permission[]>([]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadPermissions();
    }
  }, [isAdmin]);

  async function loadUsers() {
    setLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  }

  async function loadPermissions() {
    const [v, e] = await Promise.all([
      getPermissions('viewer'),
      getPermissions('editor'),
    ]);
    setViewerPerms(v);
    setEditorPerms(e);
  }

  async function handlePermChange(role: AppRole, page: string, field: 'can_view' | 'can_edit', value: boolean) {
    const perms = role === 'viewer' ? viewerPerms : editorPerms;
    const setPerms = role === 'viewer' ? setViewerPerms : setEditorPerms;
    const perm = perms.find(p => p.page === page);
    const newView = field === 'can_view' ? value : (perm?.can_view ?? false);
    const newEdit = field === 'can_edit' ? value : (perm?.can_edit ?? false);
    // If can_edit is true, can_view must also be true
    const finalView = newEdit ? true : newView;

    await updatePermission(role, page, finalView, newEdit);
    setPerms(prev => prev.map(p =>
      p.page === page ? { ...p, can_view: finalView, can_edit: newEdit } : p
    ));
  }

  async function handleDeleteUser(userId: string) {
    try {
      await deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: 'Uživatel smazán' });
    } catch {
      toast({ title: 'Chyba při mazání uživatele', variant: 'destructive' });
    }
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
      <h2 className="text-2xl font-display text-primary mb-6">Správa</h2>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Uživatelé</TabsTrigger>
          <TabsTrigger value="permissions">Oprávnění</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
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
                    onValueChange={async (v: string) => {
                      await setUserRole(u.id, v as AppRole);
                      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: v as AppRole } : x));
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
                  {u.id !== user?.id && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                          <Trash2 size={16} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Smazat uživatele?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Opravdu chcete smazat uživatele <strong>{u.email}</strong>? Tato akce je nevratná a smaže všechna jeho data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Zrušit</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteUser(u.id)}>
                            Smazat
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(['viewer', 'editor'] as AppRole[]).map(role => {
              const perms = role === 'viewer' ? viewerPerms : editorPerms;
              return (
                <div key={role} className="bg-card rounded-lg border border-border p-4">
                  <h3 className="font-semibold text-foreground mb-4">{ROLE_LABELS[role]}</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-medium pb-1 border-b border-border">
                      <span>Stránka</span>
                      <span className="text-center">Vidí</span>
                      <span className="text-center">Edituje</span>
                    </div>
                    {PAGES.map(page => {
                      const perm = perms.find(p => p.page === page);
                      return (
                        <div key={page} className="grid grid-cols-3 gap-2 items-center">
                          <span className="text-sm text-foreground">{PAGE_LABELS[page]}</span>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={perm?.can_view ?? false}
                              onCheckedChange={(v) => handlePermChange(role, page, 'can_view', !!v)}
                            />
                          </div>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={perm?.can_edit ?? false}
                              onCheckedChange={(v) => handlePermChange(role, page, 'can_edit', !!v)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
