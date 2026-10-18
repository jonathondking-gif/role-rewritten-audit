# Role Rewritten — AI Resume Audit Tool

Automated lead-magnet + order pipeline for the Role Rewritten resume writing service.
Lives at **audit.rolerewritten.com** (homepage IS the tool).

## The pipeline

1. Visitor uploads a resume (PDF/DOCX) on the homepage.
2. `POST /api/audit` parses it and runs a Claude audit (cheap/fast model) against a
   6-category rubric: structure, achievement framing, quantification, summary quality,
   ATS readiness, concision.
3. Results page shows the overall score free; an email address unlocks the full
   "coach's red pen" report — the resume re-rendered with every weak spot
   highlighted (red = critical, amber = warning), numbered to match fix notes.
4. Unlocking also fires the same visual report as an HTML email (instant).
5. Buy CTA (Resume $179 / Resume+LinkedIn $279 / Executive $499) → Stripe Checkout.
6. On `checkout.session.completed`, the webhook runs a second Claude pass (most
   capable model) that rewrites the resume with the before/after method. The draft
   is parked as **pending review — it never reaches the customer automatically.**
7. Jon signs off at `/review` (password-protected): side-by-side original vs AI
   draft, edit freely, then **Approve & Send**.

## Env vars (Vercel → Project → Settings → Environment Variables)

| Var | Required | What |
|---|---|---|
| `ANTHROPIC_API_KEY` | **yes** | Claude API key (`x-api-key` header). App reads it only from env. |
| `REVIEW_PASSWORD` | **yes** | Password for `/review`. Pick something strong. |
| `SITE_URL` | recommended | `https://audit.rolerewritten.com` — used in email links + Stripe redirects. |
| `RESEND_API_KEY` | no | Without it, emails are saved to `data/outbox.json` and logged instead of sent. |
| `EMAIL_FROM` | no | Sender, e.g. `Role Rewritten <jon@rolerewritten.com>` (must be a verified domain in Resend). |
| `STRIPE_SECRET_KEY` | no | Without it, the buy CTA shows "payments not connected" instead of breaking. |
| `STRIPE_WEBHOOK_SECRET` | no | Recommended for production signature verification. |
| `AUDIT_MODEL` | no | Default `claude-haiku-5-5`. |
| `REBUILD_MODEL` | no | Default `claude-opus-5-5`. |

## Deploy to Vercel

```bash
cd role-rewritten-audit
npx vercel          # or: push to GitHub and import in the Vercel dashboard
```

Then:
1. Add the env vars above in the Vercel dashboard.
2. Add domain `audit.rolerewritten.com` (Vercel → Project → Settings → Domains) and
   point DNS at Vercel.
3. In Stripe dashboard, create a webhook endpoint:
   `https://audit.rolerewritten.com/api/webhooks/stripe` listening for
   `checkout.session.completed`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
4. In Resend, verify `rolerewritten.com` and set `EMAIL_FROM`.

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY + REVIEW_PASSWORD
npm run dev
```

Test flow: upload a resume → check the score → unlock with an email →
`data/outbox.json` will hold the stubbed audit email → buy CTA shows the
payments-not-connected state until Stripe is wired.

To exercise the paid path locally without Stripe:
1. Log in at `/review` with `REVIEW_PASSWORD`.
2. `POST /api/rebuild` with `{ "auditId": "<id>", "email": "you@x.com", "tierId": "resume" }`
   (same auth cookie required).
3. Approve from `/review`.

## Notes / limits

- **Storage is JSON files under `data/`** (gitignored). Fine for launch; on Vercel's
  serverless runtime the filesystem is ephemeral — move to Vercel KV or Postgres
  before real volume.
- **Never commit `.env.local`** or paste the API key into code — the app reads
  `process.env` exclusively.
- The Anthropic key used for testing expires **Nov 16, 2026** — mint a fresh one
  before launch and rotate it in Vercel env vars.
- Current Claude models deprecated the `temperature` parameter; the client omits it.
