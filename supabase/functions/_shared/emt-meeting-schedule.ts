const DAY_MS = 86_400_000;
export const EMT_MEETING_CADENCE_DAYS = 7;

export function isWeeklyMeetingDate(value: string, anchorIso: string) {
  const date = new Date(`${value}T00:00:00Z`).getTime();
  const anchor = new Date(`${anchorIso}T00:00:00Z`).getTime();
  if (Number.isNaN(date) || Number.isNaN(anchor)) return false;
  return (date - anchor) % (EMT_MEETING_CADENCE_DAYS * DAY_MS) === 0;
}
