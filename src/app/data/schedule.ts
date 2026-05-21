export type WeekDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export const WEEK_DAYS: readonly WeekDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export interface OpenDayHours {
  open: true;
  from: string;
  to: string;
}

export interface ClosedDayHours {
  open: false;
}

export type DayHours = OpenDayHours | ClosedDayHours;

export type OperatingHours = Record<WeekDay, DayHours>;

export interface DaySchedule {
  attending: boolean;
  arrival: string;
  departure: string;
}

export type WeeklySchedule = Record<WeekDay, DaySchedule>;

export const DEFAULT_OPEN_HOURS: OpenDayHours = { open: true, from: '06:00', to: '18:00' };
const CLOSED: ClosedDayHours = { open: false };

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { ...DEFAULT_OPEN_HOURS },
  tuesday: { ...DEFAULT_OPEN_HOURS },
  wednesday: { ...DEFAULT_OPEN_HOURS },
  thursday: { ...DEFAULT_OPEN_HOURS },
  friday: { ...DEFAULT_OPEN_HOURS },
  saturday: { ...CLOSED },
  sunday: { ...CLOSED },
};

export function getOperatingHours(kg: { operatingHours?: OperatingHours } | null): OperatingHours {
  return kg?.operatingHours ?? DEFAULT_OPERATING_HOURS;
}

export function defaultScheduleFor(hours: OperatingHours): WeeklySchedule {
  const out = {} as WeeklySchedule;
  for (const day of WEEK_DAYS) {
    const h = hours[day];
    out[day] = h.open
      ? { attending: true, arrival: h.from, departure: h.to }
      : { attending: false, arrival: '', departure: '' };
  }
  return out;
}

export function getWeeklySchedule(
  schedule: WeeklySchedule | null | undefined,
  hours: OperatingHours,
): WeeklySchedule {
  return schedule ?? defaultScheduleFor(hours);
}

export function isTimeWithin(time: string, from: string, to: string): boolean {
  return time >= from && time <= to;
}
