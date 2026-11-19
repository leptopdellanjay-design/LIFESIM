export const monthNames = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export function getMonthName(month: number): string {
  return monthNames[month - 1] ?? 'Januari';
}

export function getBirthdayMonth(birthDate: string): number {
  const month = Number(birthDate.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : 1;
}

export function getNextCalendarDate(
  year: number,
  month: number,
): { year: number; month: number } {
  return month >= 12
    ? { year: year + 1, month: 1 }
    : { year, month: Math.max(1, month) + 1 };
}
