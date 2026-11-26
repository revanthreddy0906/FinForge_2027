import "server-only";
import { headers } from "next/headers";

/** Caller IP as reported by the hosting proxy (Vercel sets x-forwarded-for / x-real-ip). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const candidates = [h.get("x-forwarded-for")?.split(",")[0], h.get("x-real-ip")];
  return candidates.map((c) => c?.trim()).find((c) => c) ?? "unknown";
}
