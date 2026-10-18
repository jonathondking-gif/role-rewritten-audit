export interface Tier {
  id: string;
  name: string;
  priceCents: number;
  blurb: string;
}

export const TIERS: Tier[] = [
  {
    id: "resume",
    name: "Resume",
    priceCents: 17900,
    blurb: "Full rewrite, your choice of 18 designs, plain version for online applications, unlimited revisions for 14 days.",
  },
  {
    id: "resume_linkedin",
    name: "Resume and LinkedIn",
    priceCents: 27900,
    blurb: "Everything in Resume, plus LinkedIn headline, About section, experience entries, and recruiter outreach email templates. Most popular.",
  },
  {
    id: "executive",
    name: "Executive",
    priceCents: 49900,
    blurb: "Everything above, plus a cover letter, a 30-minute strategy call, and a second version for another target role.",
  },
  {
    id: "tailoring",
    name: "Job Tailoring",
    priceCents: 4900,
    blurb: "Your resume tuned to one specific job posting.",
  },
];

export function getTier(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
