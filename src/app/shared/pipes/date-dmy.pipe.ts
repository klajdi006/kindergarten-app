import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a date as dd.mm.yyyy. Accepts:
 *   - ISO date string `yyyy-mm-dd` (parsed as local-time midnight)
 *   - Any other date string `new Date()` can parse
 *   - A unix timestamp (number, ms)
 *   - A Date instance
 * Empty / null / invalid input returns ''.
 */
@Pipe({ name: 'dateDmy', standalone: true })
export class DateDmyPipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';

    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'number') {
      date = new Date(value);
    } else {
      date = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(value + 'T00:00:00')
        : new Date(value);
    }

    if (Number.isNaN(date.getTime())) return '';

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }
}
