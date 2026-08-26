import "server-only";

import { Resend } from "resend";
import { formatDate } from "@/lib/domain/format-date";
import { isLocalDatabase } from "@/lib/server/env-guard";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function buildReplyTo(from: string, intersectionId: number): string {
  const [local, domain] = from.split("@");
  return `${local}+${intersectionId}@${domain}`;
}

export async function sendIntersectionEmail({
  id,
  dateA,
  dateB,
}: {
  id: number;
  dateA: Date;
  dateB: Date;
}): Promise<void> {
  // The crossing is in the local trace, but the credentials and the recipient are the real ones,
  // so a send from here is a genuine notification about invented data. Braces to the cron's belt:
  // this also covers a script, and a cron deliberately unlocked with WEATHER_CRON=1.
  if (isLocalDatabase()) {
    console.log(`[Email] Local database — not sending for Intersection #${id}.`);
    return;
  }

  const from = process.env.EMAIL_FROM!;
  const to = process.env.NOTIFICATION_EMAIL!;
  // BASE_URL is an origin, no path — tolerate a trailing slash.
  const baseUrl = (process.env.BASE_URL ?? "").replace(/\/+$/, "");
  const formattedA = formatDate(dateA);
  const formattedB = formatDate(dateB);

  const body = [
    "The wind trace crossed itself.",
    "",
    `${formattedA} and ${formattedB} now share a point.`,
    "",
    "---",
    `Intersection ID: ${id}`,
    `Respond: ${baseUrl}/admin/intersections/${id}`,
  ];

  const { error } = await getResend().emails.send({
    from,
    to,
    replyTo: buildReplyTo(from, id),
    subject: `Intersection — ${formattedA} × ${formattedB}`,
    text: body.join("\n"),
  });
  if (error) throw error;
}
