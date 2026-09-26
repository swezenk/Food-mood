"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getState, useAppState } from "@/lib/store";
import {
  appendMessage,
  buildContext,
  endConversation,
  flagSafety,
  getConversation,
  recordDecision,
  startConversation,
  streamChat,
  updateConversation,
} from "@/lib/actions";
import SupportResources from "@/components/SupportResources";
import type { ConversationMode, SafetyLevel } from "@/lib/types";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  );
}

function Chat() {
  const params = useSearchParams();
  const router = useRouter();
  const state = useAppState();
  const [id, setId] = useState<string | null>(params.get("id"));
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const started = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const convo = id ? state.conversations.find((c) => c.id === id) : undefined;
  const busy = streaming !== null;

  const send = useCallback(async (convoId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    appendMessage(convoId, { role: "user", text: trimmed, at: new Date().toISOString() });
    // Continuing a past conversation re-opens it so it gets re-extracted.
    updateConversation(convoId, (c) => ({ ...c, endedAt: undefined }));

    const current = getConversation(convoId)!;
    const controller = new AbortController();
    abortRef.current = controller;
    let reply = "";
    setStreaming("");
    try {
      await streamChat(
        {
          mode: current.mode,
          messages: current.messages.map(({ role, text }) => ({ role, text })),
          context: buildContext(getState()),
          decision: current.decision,
        },
        (e) => {
          if (e.type === "text") {
            reply += e.text;
            setStreaming(reply);
          } else if (e.type === "decision") {
            recordDecision(convoId, {
              kind: e.kind,
              summary: e.summary,
              followUpMinutes: e.followUpMinutes,
              at: new Date().toISOString(),
            });
          } else if (e.type === "safety") {
            flagSafety(convoId, e.level);
          } else if (e.type === "error") {
            setError(e.message);
          }
        },
        controller.signal,
      );
    } catch {
      if (!controller.signal.aborted) setError("Connection lost. Try sending that again.");
    } finally {
      if (reply.trim()) appendMessage(convoId, { role: "assistant", text: reply.trim(), at: new Date().toISOString() });
      setStreaming(null);
      abortRef.current = null;
    }
  }, []);

  // Start (or resume) the conversation once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (id && getConversation(id)) return;
    const mode: ConversationMode = params.get("mode") === "talk" ? "talk" : "craving";
    const c = startConversation(mode, params.get("source") ?? "home");
    setId(c.id);
    router.replace(`/chat?id=${c.id}`);
    const q = params.get("q");
    if (q) void send(c.id, q);
  }, [id, params, router, send]);

  // End the conversation (and extract) when leaving the screen.
  useEffect(() => {
    if (!id) return;
    const onHide = () => void endConversation(id);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      abortRef.current?.abort();
      void endConversation(id);
    };
  }, [id]);

  // Tick so the in-chat check-in appears when the follow-up comes due.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [convo?.messages.length, streaming]);

  if (!convo) return <div className="chat" />;

  const safety: SafetyLevel = convo.safetyFlag ?? "none";
  const decision = convo.decision;
  const followUpDue =
    decision &&
    decision.kind !== "undecided" &&
    decision.followUpMinutes > 0 &&
    !convo.followUp &&
    now >= new Date(decision.at).getTime() + decision.followUpMinutes * 60_000;

  return (
    <div className="chat">
      <header className="chat-header">
        <Link href="/" className="btn ghost" style={{ paddingLeft: 0 }}>
          ← Home
        </Link>
        <strong>{convo.mode === "craving" ? "Craving check-in" : "Talk to Forrix"}</strong>
        <button
          className="btn ghost"
          style={{ paddingRight: 0 }}
          onClick={() => {
            void endConversation(convo.id);
            router.push("/");
          }}
        >
          Done
        </button>
      </header>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {safety !== "none" && <SupportResources level={safety} />}
        {convo.messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {streaming !== null &&
          (streaming ? (
            <div className="bubble assistant">{streaming}</div>
          ) : (
            <div className="typing">Forrix is thinking…</div>
          ))}
        {decision && decision.kind !== "undecided" && (
          <div className="decision-pill">
            Decision: {decision.summary}
            {decision.followUpMinutes > 0 && !convo.followUp ? ` · check-in in ${decision.followUpMinutes} min` : ""}
          </div>
        )}
        {followUpDue && (
          <div className="card">
            <p>
              <strong>How did it go?</strong>
            </p>
            <Link href={`/checkin/${convo.id}`} className="btn primary">
              Tell Forrix
            </Link>
          </div>
        )}
        {error && (
          <div className="card warn">
            <p className="small">{error}</p>
          </div>
        )}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          const text = input;
          setInput("");
          void send(convo.id, text);
        }}
      >
        <textarea
          rows={1}
          value={input}
          placeholder="Type how you're feeling…"
          aria-label="Message"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          autoFocus
        />
        <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
