import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Credentials resolve from the environment (ANTHROPIC_API_KEY etc).
export const client = new Anthropic();

export const MODEL = process.env.FORRIX_MODEL || "claude-opus-5";

// Server-side fallback: if the primary model declines a request, the API
// re-runs it on Anthropic's recommended fallback model within the same call.
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: "Forrix isn't configured with a valid API key." }, { status: 500 });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "Forrix is busy right now. Try again in a moment." }, { status: 429 });
  }
  if (error instanceof Anthropic.APIError) {
    console.error("Anthropic API error", error.status, error.message);
    return Response.json({ error: "Something went wrong reaching Forrix." }, { status: 502 });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
