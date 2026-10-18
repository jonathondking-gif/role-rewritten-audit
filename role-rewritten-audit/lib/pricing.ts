export interface Tier {
  id: string;
  name: string;
  priceCents: number;
  blurb: string;
}

export const TIERS: Tier[] = [
  {
    id: "resume",
    name: "Resume Rebuild",
    priceCents: 17900,
    blurb: "Full professional rewrite, ATS-optimized, delivered within 24 hours on business days.",
  },
  {
    id: "resume_linkedin",
    name: "Resume + LinkedIn",
    priceCents: 27900,
    blurb: "Everything in Resume Rebuild, plus a rewritten LinkedIn profile. Most popular.",
  },
  {
    id: "executive",
    name: "Executive Package",
    priceCents: 49900,
    blurb: "For directors and VPs: everything plus cover letter and a 30-min strategy call.",
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
