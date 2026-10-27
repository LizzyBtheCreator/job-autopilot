import { currentUserEmail, unauthorized } from "@/lib/auth";
import { runSearch } from "@/lib/search";

export const maxDuration = 120;

export async function POST() {
  if (!(await currentUserEmail())) return unauthorized();
  try {
    const runId = await runSearch();
    return Response.json({ runId });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
