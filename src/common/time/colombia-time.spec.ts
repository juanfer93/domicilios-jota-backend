import {
  getColombiaDateKey,
  getColombiaDayRange,
} from './colombia-time';

describe('colombia-time', () => {
  it('calcula la fecha de Colombia aunque UTC ya este en el dia siguiente', () => {
    const instant = new Date('2026-06-13T02:30:00.000Z');

    expect(getColombiaDateKey(instant)).toBe('2026-06-12');
  });

  it('convierte un dia colombiano a limites UTC', () => {
    expect(getColombiaDayRange('2026-06-12')).toEqual({
      start: new Date('2026-06-12T05:00:00.000Z'),
      end: new Date('2026-06-13T05:00:00.000Z'),
    });
  });

  it('rechaza fechas inexistentes', () => {
    expect(() => getColombiaDayRange('2026-02-31')).toThrow(RangeError);
  });
});
