interface Props {
  current: number;
  max: number;
}

export default function HPBar({ current, max }: Props) {
  const pct = max > 0 ? Math.max(0, Math.floor((current / max) * 100)) : 0;
  const color = pct <= 0 ? 'bg-hp-dead' : pct <= 15 ? 'bg-hp-warning' : 'bg-hp-healthy';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-3 bg-muted rounded-full overflow-hidden">
        <div className={`hp-bar-fill h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-medium ${pct <= 0 ? 'text-hp-dead' : pct <= 15 ? 'text-hp-warning' : 'text-foreground'}`}>
        {current}/{max}
      </span>
    </div>
  );
}
