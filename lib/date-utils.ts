/**
 * Pure timezone and date formatting helpers for WalRecall.
 * Operates without third-party libraries and avoids server/client timezone drift.
 */

/**
 * Formats a Date object or unix timestamp (ms) into a standard HTML5 datetime-local string
 * (`YYYY-MM-DDTHH:mm`) using the client's local time components.
 *
 * Avoids `.toISOString().slice(0, 16)` which outputs UTC time and causes datetime-local
 * inputs to display the wrong local hour/day.
 */
export function toDatetimeLocalValue(dateOrMs: Date | number = Date.now()): string {
  const d = typeof dateOrMs === "number" ? new Date(dateOrMs) : dateOrMs;
  if (isNaN(d.getTime())) {
    return "";
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Returns the default settlement deadline value (24 hours in the future) formatted
 * as a local datetime-local string.
 */
export function getDefaultDeadlineLocalValue(): string {
  return toDatetimeLocalValue(Date.now() + 24 * 3600 * 1000);
}

/**
 * Returns the minimum selectable deadline value (current time + 5 minutes buffer)
 * formatted as a local datetime-local string for HTML5 input `min` validation attribute.
 */
export function getMinDeadlineLocalValue(): string {
  return toDatetimeLocalValue(Date.now() + 5 * 60 * 1000);
}

/**
 * Formats a record's date for cards, tables, and detail views using the device's local timezone.
 * Falls back to `fallbackDateStr` or "Recent" if timestamp is absent or invalid.
 */
export function formatLocalDateLabel(
  timestamp?: number | null,
  fallbackDateStr?: string | null
): string {
  if (typeof timestamp === "number" && !isNaN(timestamp) && timestamp > 0) {
    try {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
      }
    } catch {
      // Fallback below
    }
  }

  return fallbackDateStr || "Recent";
}
