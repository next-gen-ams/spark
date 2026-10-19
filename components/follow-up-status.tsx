import { CheckCircle2, Clock3 } from 'lucide-react';

export function FollowUpStatus({ completedAt }: { completedAt?: string }) {
  const completed = Boolean(completedAt);
  const label = completed ? 'Completed' : 'Pending';
  const Icon = completed ? CheckCircle2 : Clock3;

  return (
    <span
      className={`completion-badge${completed ? '' : ' is-pending'}`}
      aria-label={`Follow-up status: ${label}`}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
