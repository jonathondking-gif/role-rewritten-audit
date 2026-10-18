import { appendOutbox } from "./store";

const RESEND_URL = "https://api.resend.com/emails";
const FROM = process.env.EMAIL_FROM || "Role Rewritten <jon@rolerewritten.com>";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send via Resend when RESEND_API_KEY is set; otherwise persist to the local
 * outbox (data/outbox.json) and log — the pipeline never breaks for lack of
 * an email key.
 */
export async function sendEmail(mail: OutgoingEmail): Promise<{
  sent: boolean;
  id?: string;
  stubbed?: boolean;
}> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    appendOutbox(mail);
    console.log(
      `[email-stub] RESEND_API_KEY unset — saved to data/outbox.json (to=${mail.to}, subject="${mail.subject}")`
    );
    return { sent: false, stubbed: true };
  }
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { id?: string };
  return { sent: true, id: json.id };
}
