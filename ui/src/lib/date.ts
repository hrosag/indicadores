export const shiftMonth = (ym: string, delta: number) => {
  if (!ym) return "";
  const [yearPart, monthPart] = ym.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) return "";
  const monthIndex = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = monthIndex % 12;
  const adjustedMonth = nextMonth < 0 ? nextMonth + 12 : nextMonth;
  const adjustedYear = nextMonth < 0 ? nextYear - 1 : nextYear;
  const monthValue = String(adjustedMonth + 1).padStart(2, "0");
  return `${adjustedYear}-${monthValue}`;
};
