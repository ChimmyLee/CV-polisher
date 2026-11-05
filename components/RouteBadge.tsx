import { ROUTE_LABELS } from '@/lib/keywords';
import type { RouteType } from '@/lib/types';

const STYLES: Record<RouteType, string> = {
  polish: 'bg-accent-soft text-accent-deep border-accent/20',
  project: 'bg-amber-soft text-amber border-amber/20',
  both: 'bg-[#eef1f8] text-[#364a7a] border-[#c9d2e8]',
};

export function RouteBadge({ route }: { route: RouteType }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold ${STYLES[route]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ROUTE_LABELS[route]}
    </span>
  );
}
