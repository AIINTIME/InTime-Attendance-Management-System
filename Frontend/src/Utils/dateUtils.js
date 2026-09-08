export function formatDate(dateInput, options = {}) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function formatTime(dateInput) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function formatMinutesAsHours(minutes) {
  if (minutes === null || minutes === undefined) return "-";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

/**
 * Builds a full Sun-Sat calendar grid for the given month, including the
 * leading/trailing days of adjacent months needed to fill whole weeks.
 * Returns an array of { day, inCurrentMonth, isToday } cells.
 */
export function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const isSameDay = (y, m, d) =>
    today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  const cells = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inCurrentMonth: false, isToday: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, inCurrentMonth: true, isToday: isSameDay(year, month, day) });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay++, inCurrentMonth: false, isToday: false });
  }

  return cells;
}

export function todayWorkingDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
