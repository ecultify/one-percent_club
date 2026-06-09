import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
function mask(v?: string) {
  if (!v) return null;
  if (v.length <= 8) return `len${v.length}`;
  return `${v.slice(0, 6)}…${v.slice(-6)} (len${v.length})`;
}
export async function GET() {
  return NextResponse.json({
    partykitHost: mask(process.env.NEXT_PUBLIC_PARTYKIT_HOST),
    hostKeySet: Boolean(process.env.NEXT_PUBLIC_HOST_KEY),
    databaseUrlSet: Boolean(process.env.DATABASE_URL),
  });
}
