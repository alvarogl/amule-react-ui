export type FormattedLogLine = {
  message: string;
  tone: "default" | "warning" | "error" | "success";
};

const timestampPattern = /^[!\s]?(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}):\s*(.*)$/;

export function formatLogLine(line: string): FormattedLogLine {
  const match = line.match(timestampPattern);
  const message = match?.[2] ?? line;
  const normalized = message.toLowerCase();
  const tone = /\berror\b|failed|rejected|fatal|cannot/.test(normalized)
    ? "error"
    : /\bwarning\b|firewalled|retry/.test(normalized)
      ? "warning"
      : /connected|complete|success|finished/.test(normalized)
        ? "success"
        : "default";
  return { message, tone };
}
