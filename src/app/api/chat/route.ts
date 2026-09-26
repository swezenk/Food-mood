import type Anthropic from "@anthropic-ai/sdk";
import { client, MODEL, FALLBACK, apiErrorResponse } from "@/lib/server/anthropic";
import { COACH_SYSTEM, COACH_TOOLS, coachContextBlock } from "@/lib/server/prompts";
import { screenText } from "@/lib/safety";
import type { ChatRequest, ChatStreamEvent } from "@/lib/api-types";
import type { DecisionKind } from "@/lib/types";

export const runtime = "nodejs";

const MAX_TOOL_ROUNDS = 3;
const MAX_HISTORY = 60;

const OPENER_CUE: Record<ChatRequest["mode"], string> = {
  craving: "(Tapped “I'm having a craving”)",
  talk: "(Tapped “Talk to Forrix”)",
};

function toApiMessages(req: ChatRequest): Anthropic.Beta.BetaMessageParam[] {
  const history = req.messages.slice(-MAX_HISTORY).filter((m) => m.text.trim());
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  // The opener is shown client-side without a model call, so the API history
  // starts with an assistant turn. Anchor it with a cue for the button tapped.
  if (history[0]?.role === "assistant") out.push({ role: "user", content: OPENER_CUE[req.mode] });
  for (const m of history) out.push({ role: m.role, content: m.text });
  return out;
}

function isValidRequest(body: unknown): body is ChatRequest {
  const b = body as ChatRequest;
  return (
    !!b &&
    (b.mode === "craving" || b.mode === "talk") &&
    Array.isArray(b.messages) &&
    b.messages.length > 0 &&
    b.messages.at(-1)?.role === "user" &&
    !!b.context
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isValidRequest(body)) return Response.json({ error: "Invalid request" }, { status: 400 });

  const messages = toApiMessages(body);
  const lastUser = body.messages.at(-1)!.text;
  const screened = screenText(lastUser);

  let contextText = coachContextBlock(body.context, body);
  if (screened !== "none") {
    contextText +=
      screened === "crisis"
        ? "\n\nTheir latest message mentions self-harm or suicidal thoughts. The app is showing crisis resources now. Respond per the crisis rules."
        : "\n\nTheir latest message mentions a possible disordered-eating behavior. The app is showing support resources now. Respond per the safety rules; no weight-loss coaching.";
  }

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: contextText },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // Client went away; the abort signal stops the model call.
        }
      };

      if (screened !== "none") {
        send({ type: "safety", level: screened, reason: "Detected in message" });
      }

      try {
        let emittedText = false;
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          let separated = !emittedText;
          const s = client.beta.messages.stream(
            {
              model: MODEL,
              max_tokens: 4000,
              thinking: { type: "adaptive" },
              output_config: { effort: "medium" },
              system,
              tools: COACH_TOOLS,
              messages,
              ...FALLBACK,
            },
            { signal: req.signal },
          );
          s.on("text", (delta) => {
            if (!separated) {
              send({ type: "text", text: "\n\n" });
              separated = true;
            }
            emittedText = true;
            send({ type: "text", text: delta });
          });
          const msg = await s.finalMessage();

          if (msg.stop_reason === "refusal") {
            if (!emittedText) {
              send({
                type: "text",
                text: "I'm not able to help with that here. If you're going through something serious, please reach out to someone you trust or a professional.",
              });
            }
            break;
          }

          const toolUses = msg.content.filter(
            (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
          );
          if (msg.stop_reason !== "tool_use" || toolUses.length === 0) break;

          messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((t) => {
            const input = t.input as Record<string, unknown>;
            if (t.name === "record_decision") {
              const minutes = Math.max(0, Math.min(240, Math.round(Number(input.follow_up_minutes) || 0)));
              send({
                type: "decision",
                kind: String(input.kind) as DecisionKind,
                summary: String(input.summary ?? ""),
                followUpMinutes: minutes,
              });
              return {
                type: "tool_result",
                tool_use_id: t.id,
                content: minutes > 0 ? `Recorded. The app will check in after ${minutes} minutes.` : "Recorded.",
              };
            }
            if (t.name === "flag_safety_concern") {
              const level = input.level === "crisis" ? "crisis" : "concern";
              send({ type: "safety", level, reason: String(input.reason ?? "") });
              return {
                type: "tool_result",
                tool_use_id: t.id,
                content: "Flagged. Supportive mode is on and resources are showing in the app.",
              };
            }
            return { type: "tool_result", tool_use_id: t.id, content: "Unknown tool.", is_error: true };
          });
          messages.push({ role: "user", content: results });
        }
        send({ type: "done" });
      } catch (error) {
        if (!req.signal.aborted) {
          const res = apiErrorResponse(error);
          const { error: message } = (await res.json()) as { error: string };
          send({ type: "error", message });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a client disconnect.
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
