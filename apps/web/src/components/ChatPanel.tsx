"use client";

import type { OpenZorgRole } from "@openzorg/shared-domain";
import { ROLE_PERMISSIONS } from "@openzorg/shared-domain";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { getUserRole } from "../lib/api";

/* ── Types ── */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatContext {
  clientId?: string;
  tab?: string;
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

/* ── Context extraction ── */

function usePageContext(): ChatContext {
  const pathname = usePathname();
  const ctx: ChatContext = {};

  // Match /ecd/{clientId} or /ecd/{clientId}/{tab}
  const match = pathname.match(/^\/ecd\/([^/]+)(?:\/([^/]+))?/);
  if (match) {
    ctx.clientId = match[1];
    ctx.tab = match[2];
  }

  return ctx;
}

function contextLabel(ctx: ChatContext): string | null {
  if (!ctx.clientId) return null;
  const tab = ctx.tab
    ? ctx.tab.charAt(0).toUpperCase() + ctx.tab.slice(1)
    : "Overzicht";
  return `Client · ${tab}`;
}

/* ── Hook: check if AI chat is available ── */

export function useAiChatAvailable(): boolean {
  const [tenantEnabled, setTenantEnabled] = useState(false);

  const role = getUserRole() as OpenZorgRole;
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  const hasPermission = permissions.includes("ai-chat:read");

  useEffect(() => {
    if (!hasPermission) return;

    let cancelled = false;

    async function check() {
      try {
        const token = localStorage.getItem("openzorg_token");
        const tenantId = localStorage.getItem("openzorg_tenant_id");
        const res = await fetch("/api/ecd/admin/ai-settings", {
          headers: {
            Authorization: `Bearer ${token ?? ""}`,
            "X-Tenant-ID": tenantId ?? "",
            "X-User-Role": role,
          },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { enabled?: boolean };
        if (!cancelled) {
          setTenantEnabled(data.enabled === true);
        }
      } catch {
        // AI not available
      }
    }

    void check();
    return () => { cancelled = true; };
  }, [hasPermission, role]);

  return hasPermission && tenantEnabled;
}

/* ── ChatPanel component ── */

const MAX_MESSAGES = 20;
const HISTORY_SEND_COUNT = 18;

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const context = usePageContext();

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setInput("");
    setStreaming(false);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(updated);
    setInput("");
    setStreaming(true);

    // Add empty assistant message placeholder
    const withAssistant = [...updated, { role: "assistant" as const, content: "" }];
    setMessages(withAssistant);

    const historyToSend = updated.slice(-HISTORY_SEND_COUNT);

    try {
      const token = localStorage.getItem("openzorg_token");
      const tenantId = localStorage.getItem("openzorg_tenant_id");
      const role = getUserRole();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/ecd/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
          "X-Tenant-ID": tenantId ?? "",
          "X-User-Role": role,
        },
        body: JSON.stringify({
          message: text,
          context,
          history: historyToSend,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: "Er is een fout opgetreden. Probeer het opnieuw." };
          }
          return copy;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep incomplete last line in buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const chunk = line.slice(6);
            if (chunk === "[DONE]") break;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: last.content + chunk };
              }
              return copy;
            });
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled
      } else {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: "Er is een fout opgetreden. Probeer het opnieuw." };
          }
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, messages, context]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  if (!open) return null;

  const label = contextLabel(context);

  return (
    <div className="w-[350px] shrink-0 flex flex-col border-l border-default bg-raised h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-14 shrink-0 border-b border-default">
        <div className="flex-1 min-w-0">
          <h2 className="text-body-sm font-semibold text-fg truncate">AI Assistent</h2>
          {label && (
            <p className="text-caption text-fg-subtle truncate">{label}</p>
          )}
        </div>
        <button
          onClick={clearChat}
          className="text-caption text-fg-subtle hover:text-fg transition-colors px-1"
          title="Gesprek wissen"
        >
          Wissen
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-fg-muted hover:text-fg hover:bg-sunken transition-colors"
          title="Sluiten"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-body-sm text-fg-subtle text-center">
              Stel een vraag over de huidige pagina of een zorgvraag.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-body-sm whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-sunken text-fg"
              }`}
            >
              {msg.content || (streaming && i === messages.length - 1 ? (
                <span className="inline-flex gap-1 items-center h-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-bounce [animation-delay:300ms]" />
                </span>
              ) : null)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-default">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stel een vraag..."
            className="flex-1 rounded-lg border border-default bg-page px-3 py-2 text-body-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-brand-500"
            disabled={streaming}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={streaming || !input.trim()}
            className="p-2 rounded-lg bg-brand-600 text-white disabled:opacity-40 hover:bg-brand-700 transition-colors"
            title="Verstuur"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
