import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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

function buildReplyTo(from: string, intersectionId: number): string {
  const [local, domain] = from.split("@");
  return `${local}+${intersectionId}@${domain}`;
}

export async function sendIntersectionEmail({
  id,
  dateA,
  dateB,
  text,
}: {
  id: number;
  dateA: Date;
  dateB: Date;
  text?: string;
}): Promise<void> {
  const from = process.env.EMAIL_FROM!;
  const to = process.env.NOTIFICATION_EMAIL!;
  const formattedA = formatDate(dateA);
  const formattedB = formatDate(dateB);

  const body = [
    "The wind trace crossed itself.",
    ...(text ? ["", text] : []),
    "",
    `${formattedA} and ${formattedB} now share a point.`,
    "",
    "---",
    `Intersection ID: ${id}`,
    `Respond: ${process.env.BASE_URL}/admin/intersections/${id}`,
  ];

  await getResend().emails.send({
    from,
    to,
    replyTo: buildReplyTo(from, id),
    subject: `Intersection — ${formattedA} × ${formattedB}`,
    text: body.join("\n"),
  });
}
