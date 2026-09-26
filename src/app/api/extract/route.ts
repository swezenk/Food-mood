import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { client, MODEL, FALLBACK, apiErrorResponse } from "@/lib/server/anthropic";
import { EXTRACT_SYSTEM } from "@/lib/server/prompts";
import type { ExtractRequest, ExtractResponse } from "@/lib/api-types";
import { OUTCOME_LABELS } from "@/lib/types";

export const runtime = "nodejs";

const ExtractSchema = z.object({
  extraction: z.object({
    craving: z.string().nullable(),
    craving_category: z.string().nullable(),
    hunger: z.enum(["low", "medium", "high"]).nullable(),
    urge_intensity: z.number().nullable(),
    trigger: z.string().nullable(),
    driver: z.enum(["physical", "emotional", "environmental", "habitual", "reward", "unknown"]),
    emotion: z.string().nullable(),
    context: z.string().nullable(),
    strategy: z.string().nullable(),
    summary: z.string(),
  }),
  memory_ops: z.array(
    z.object({
      op: z.enum(["add", "reinforce", "retire"]),
      id: z.string().nullable(),
      text: z.string(),
      kind: z.enum(["temporary", "persistent"]),
    }),
  ),
  safety: z.enum(["none", "concern", "crisis"]),
});

function renderInput(body: ExtractRequest): string {
  const parts: string[] = [`Conversation (${body.mode} mode, started ${body.localTime}):`];
  for (const m of body.messages) parts.push(`${m.role === "user" ? "Person" : "Forrix"}: ${m.text}`);
  if (body.decision) parts.push("", `Recorded decision: ${body.decision.kind} — ${body.decision.summary}`);
  if (body.followUp) {
    const f = body.followUp;
    parts.push(
      `Follow-up: ${OUTCOME_LABELS[f.outcome]}; felt ${f.satisfaction}/5 about the decision${f.note ? `; noticed: "${f.note}"` : ""}`,
    );
  }
  parts.push("", "Existing memories:");
  if (body.memories.length === 0) parts.push("(none yet)");
  for (const m of body.memories) parts.push(`- [${m.id}] (${m.kind}) ${m.text}`);
  return parts.join("\n");
}

export async function POST(req: Request) {
  let body: ExtractRequest;
  try {
    body = (await req.json()) as ExtractRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body?.messages) || !body.messages.some((m) => m.role === "user")) {
    return Response.json({ error: "Nothing to extract" }, { status: 400 });
  }

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: betaZodOutputFormat(ExtractSchema) },
      system: EXTRACT_SYSTEM,
      messages: [{ role: "user", content: renderInput(body) }],
      ...FALLBACK,
    });
    const parsed = response.parsed_output;
    if (response.stop_reason === "refusal" || !parsed) {
      return Response.json({ error: "Couldn't summarize this conversation." }, { status: 422 });
    }

    const e = parsed.extraction;
    const knownIds = new Set(body.memories.map((m) => m.id));
    const result: ExtractResponse = {
      extraction: {
        craving: e.craving,
        cravingCategory: e.craving_category,
        hunger: e.hunger,
        urgeIntensity: e.urge_intensity == null ? null : Math.max(1, Math.min(10, Math.round(e.urge_intensity))),
        trigger: e.trigger,
        driver: e.driver,
        emotion: e.emotion,
        context: e.context,
        strategy: e.strategy,
        summary: e.summary,
      },
      // Drop ops that reference memories we never sent.
      memoryOps: parsed.memory_ops
        .filter((op) => op.op === "add" || (op.id && knownIds.has(op.id)))
        .map((op) => ({ ...op, id: op.op === "add" ? null : op.id })),
      safety: parsed.safety,
    };
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
