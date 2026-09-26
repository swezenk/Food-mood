import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { client, MODEL, FALLBACK, apiErrorResponse } from "@/lib/server/anthropic";
import { INSIGHTS_SYSTEM } from "@/lib/server/prompts";
import type { InsightsRequest, InsightsResponse } from "@/lib/api-types";

export const runtime = "nodejs";

const InsightsSchema = z.object({ observations: z.array(z.string()) });

export async function POST(req: Request) {
  let body: InsightsRequest;
  try {
    body = (await req.json()) as InsightsRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body?.checkIns) || body.checkIns.length === 0) {
    return Response.json({ observations: [] } satisfies InsightsResponse);
  }

  const input = [
    `Supportive mode: ${body.safetyMode ? "ON" : "off"}`,
    "",
    "Check-ins (most recent first):",
    ...body.checkIns.map((c) => `- ${c}`),
    "",
    "Strategies tried (times tried / times it helped):",
    ...(body.strategies.length ? body.strategies.map((s) => `- ${s.strategy}: ${s.tried} / ${s.helped}`) : ["(none with follow-ups yet)"]),
    "",
    "What Forrix has learned about them:",
    ...(body.memories.length ? body.memories.map((m) => `- ${m}`) : ["(nothing yet)"]),
  ].join("\n");

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(InsightsSchema) },
      system: INSIGHTS_SYSTEM,
      messages: [{ role: "user", content: input }],
      ...FALLBACK,
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ observations: [] } satisfies InsightsResponse);
    }
    return Response.json({ observations: response.parsed_output.observations.slice(0, 3) } satisfies InsightsResponse);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
