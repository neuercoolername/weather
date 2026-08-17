// One date format for the whole project — notification emails and admin UI alike,
// so a crossing reads identically wherever you meet it. Fixed to Europe/Berlin
// rather than the viewer's locale: the trace is anchored to one place.
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  }).format(date);
}
