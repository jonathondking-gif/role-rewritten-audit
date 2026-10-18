import { NextRequest, NextResponse } from "next/server";
import {
  checkReviewPassword,
  reviewCookieValue,
  REVIEW_COOKIE_NAME,
} from "@/lib/review-auth";


export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as {
    password?: string;
  };
  if (!password || !checkReviewPassword(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const token = reviewCookieValue();
  if (!token) {
    return NextResponse.json(
      { error: "REVIEW_PASSWORD is not configured on the server." },
      { status: 500 }
    );
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(REVIEW_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
