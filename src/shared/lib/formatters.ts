export function formatRate(value = 0) {
  const units = ["B/s", "KiB/s", "MiB/s", "GiB/s"];
  let amount = Math.max(0, value);
  let unit = 0;

  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }

  const precision = unit === 0 || amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(precision)} ${units[unit]}`;
}

export function formatMebibytes(value?: number) {
  if (value === undefined) return "—";

  return `${(value / 1024 / 1024).toFixed(value >= 1024 * 1024 ? 1 : 0)} MiB`;
}
