import { NextRequest, NextResponse } from "next/server";
import { PROGRAMS, account, certifications, isAddress, raw } from "@/lib/chain";

/** Search by address: route to whatever kind of account it is. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!isAddress(q)) return to(`/?error=${encodeURIComponent("Paste a Solana address: a program, certification, ruling or harness.")}`);
  const a = await account(q).catch(() => null);
  if (a?.owner === PROGRAMS.certification) return to(`/certification/${q}`);
  if (a?.owner === PROGRAMS.ruling) return to(`/ruling/${q}`);
  if (a?.owner === PROGRAMS.registry) return to(`/harness/${q}`);
  const certs = await certifications().catch(() => []);
  if (certs.some((c) => c.program === q)) return to(`/program/${q}`);
  if (a && raw(a).subarray(0, 8).toString() === "VRFYHRN1") return to(`/harness/${q}`);
  return to(`/program/${q}`);
}
