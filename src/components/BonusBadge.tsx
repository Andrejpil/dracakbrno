import { getAttributeBonus, formatBonus } from '@/lib/gameData';

interface Props {
  label: string;
  value: number;
}

export default function BonusBadge({ label, value }: Props) {
  const bonus = getAttributeBonus(value);
  const colorClass = bonus > 0 ? 'text-bonus-positive' : bonus < 0 ? 'text-bonus-negative' : 'text-bonus-neutral';
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
      <span className={`text-xs font-bold ${colorClass}`}>({formatBonus(bonus)})</span>
    </span>
  );
}
