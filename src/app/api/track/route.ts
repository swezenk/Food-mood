import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// V1 instrumentation sink: appends events to data/events.jsonl. Replace with a
// real analytics pipeline before running with more than a handful of testers.
const LOG = path.join(process.cwd(), "data", "events.jsonl");

export async function POST(req: Request) {
  let event: { name?: unknown; at?: unknown; installId?: unknown; props?: unknown };
  try {
    event = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof event.name !== "string" || typeof event.at !== "string") {
    return new Response(null, { status: 400 });
  }
  const line = JSON.stringify({
    name: event.name.slice(0, 64),
    at: event.at,
    installId: typeof event.installId === "string" ? event.installId.slice(0, 64) : null,
    props: event.props && typeof event.props === "object" ? event.props : undefined,
  });
  try {
    await mkdir(path.dirname(LOG), { recursive: true });
    await appendFile(LOG, line + "\n");
  } catch (error) {
    console.error("track: failed to write event", error);
  }
  return new Response(null, { status: 204 });
}
