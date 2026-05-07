/** Parse comma-separated attendee names into trimmed, non-empty tags. */
export function parseAttendees(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatAttendees(tags: string[]): string {
  return tags.join(", ");
}
