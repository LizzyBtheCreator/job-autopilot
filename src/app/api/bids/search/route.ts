import { currentUserEmail, unauthorized } from "@/lib/auth";
import { runBidSearch } from "@/lib/bids";

export const maxDuration = 120;

export async function POST() {
  if (!(await currentUserEmail())) return unauthorized();
  try {
    const runId = await runBidSearch();
    return Response.json({ runId });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
