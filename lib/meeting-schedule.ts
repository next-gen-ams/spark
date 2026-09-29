export const MELBOURNE_TIME_ZONE = 'Australia/Melbourne';

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;

export type MeetingSlot = {
  iso: string;
  serial: number;
  longDate: string;
  countdownDays: number;
  isToday: boolean;
};

function melbourneDateSerial(date: Date) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
  );
}

function dateSerialFromIso(value: string) {
  return new Date(`${value}T00:00:00Z`).getTime();
}

export function meetingDateLong(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function addMeetingWeek(value: string) {
  return new Date(dateSerialFromIso(value) + WEEK_MS)
    .toISOString()
    .slice(0, 10);
}

export function buildMeetingSchedule(
  now: Date,
  anchorIso: string,
): MeetingSlot[] {
  const todaySerial = melbourneDateSerial(now);
  const anchorSerial = dateSerialFromIso(anchorIso);
  const weeksSinceAnchor = Math.max(
    0,
    Math.ceil((todaySerial - anchorSerial) / WEEK_MS),
  );
  const firstMeetingSerial = anchorSerial + weeksSinceAnchor * WEEK_MS;
  return Array.from({ length: 3 }, (_, index) => {
    const serial = firstMeetingSerial + index * WEEK_MS;
    const iso = new Date(serial).toISOString().slice(0, 10);
    const countdownDays = Math.max(
      0,
      Math.round((serial - todaySerial) / DAY_MS),
    );
    return {
      iso,
      serial,
      longDate: meetingDateLong(iso),
      countdownDays,
      isToday: serial === todaySerial,
    };
  });
}
