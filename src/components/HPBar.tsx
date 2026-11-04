import { hpStatus } from '@/lib/battle';

interface Props {
  current: number;
  max: number;
}

export default function HPBar({ current, max }: Props) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.floor((current / max) * 100))) : 0;
  const status = hpStatus(current, max);
  const color = `bg-hp-${status}`;
  return (
    <div className="flex items-center gap-2 min-w-0 w-full">
      <div className="flex-1 min-w-0 max-w-32 h-3 bg-muted rounded-full overflow-hidden">
        <div className={`hp-bar-fill h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${status === 'dead' ? 'text-hp-dead' : status === 'critical' ? 'text-hp-critical' : 'text-foreground'}`}>
        {current}/{max}
      </span>
    </div>
  );
}
