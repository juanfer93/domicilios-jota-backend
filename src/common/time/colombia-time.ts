import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const COLOMBIA_TIME_ZONE = 'America/Bogota';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getColombiaDateKey(date: Date = new Date()): string {
  return formatInTimeZone(date, COLOMBIA_TIME_ZONE, 'yyyy-MM-dd');
}

export function getColombiaDayRange(dateKey: string): {
  start: Date;
  end: Date;
} {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new RangeError('La fecha debe usar el formato YYYY-MM-DD.');
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  const nextDateKey = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
  const start = fromZonedTime(`${dateKey}T00:00:00.000`, COLOMBIA_TIME_ZONE);
  const end = fromZonedTime(
    `${nextDateKey}T00:00:00.000`,
    COLOMBIA_TIME_ZONE,
  );

  if (getColombiaDateKey(start) !== dateKey) {
    throw new RangeError('La fecha indicada no existe.');
  }

  return { start, end };
}
