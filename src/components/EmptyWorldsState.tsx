import { Globe, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function EmptyWorldsState() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-5 border-primary/30">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Globe className="text-primary" size={28} />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl text-primary">Vítej v Dračím doupěti</h1>
          <p className="text-sm text-muted-foreground">
            Zatím nejsi členem žádného světa. Vytvoř si vlastní, nebo požádej správce o pozvání.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate('/svety')} className="w-full">
            <Plus size={16} className="mr-1" /> Vytvořit vlastní svět
          </Button>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Pokud tě má někdo pozvat do existujícího světa, kontaktuj jeho vlastníka a pošli mu svůj e‑mail.
          </p>
        </div>
      </Card>
    </div>
  );
}
