import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sword } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password);
      if (error) setError(error);
      else setSuccess('Registrace úspěšná! Zkontrolujte e-mail pro ověření účtu.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-lg border border-border p-6 space-y-6">
        <div className="text-center">
          <Sword className="mx-auto text-primary mb-2" size={32} />
          <h1 className="font-display text-2xl text-primary">Dračí Doupě</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? 'Přihlaste se ke svému účtu' : 'Vytvořte si nový účet'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Heslo"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-bonus-positive">{success}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '...' : isLogin ? 'Přihlásit se' : 'Registrovat'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? 'Nemáte účet?' : 'Máte účet?'}{' '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
            className="text-primary hover:underline"
          >
            {isLogin ? 'Zaregistrujte se' : 'Přihlaste se'}
          </button>
        </p>
      </div>
    </div>
  );
}
