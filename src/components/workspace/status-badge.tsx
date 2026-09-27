import { CheckCircle2, CircleDashed, PencilLine, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Status = 'planning' | 'drafting' | 'approved' | 'canon_changed';
const MAP: Record<Status, { label: string; tone: 'neutral' | 'draft' | 'canon' | 'changed'; Icon: typeof CheckCircle2 }> = {
  planning: { label: 'Planning', tone: 'neutral', Icon: CircleDashed },
  drafting: { label: 'Draft', tone: 'draft', Icon: PencilLine },
  approved: { label: 'Canon', tone: 'canon', Icon: CheckCircle2 },
  canon_changed: { label: 'Canon changed', tone: 'changed', Icon: TriangleAlert },
};
export function StatusBadge({ status }: { status: Status }) {
  const { label, tone, Icon } = MAP[status];
  return <Badge tone={tone} icon={<Icon className="size-3" aria-hidden />}>{label}</Badge>;
}
