'use client';

import { AppLayout } from '@/components/layout';
import { useToast } from '@/lib/toast';
import { chatWithAgent } from '@/services/AgentService';
import { Bot, Database, Mail, Receipt, RotateCcw, Search, SendHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string | null;
  toolsUsed?: string[];
}

const STARTER_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Ask Smartdok Agent about invoices, duplicates, missing DO or custom form flags, bank statements, supplier statements, Gmail sync, or exports. This beta can use backend tools directly against your active organisation.',
  createdAt: null,
};

const SUGGESTIONS = [
  'Give me a summary of my invoices this month',
  'List all unpaid invoices from Grab',
  'Show me duplicate invoices',
  'Show me invoices missing DO',
  'Show me my uploaded bank statements',
  'Check unmatched supplier items and unreconciled bank transactions',
];

const CAPABILITIES = [
  {
    title: 'Invoice search and detail',
    description: 'Find invoices by vendor, status, date, amount, duplicate state, or missing DO and custom form flags.',
    icon: Search,
  },
  {
    title: 'Financial overview',
    description: 'Get dashboard-style summaries and quick KPI answers without switching screens.',
    icon: Database,
  },
  {
    title: 'Statement follow-up',
    description: 'Check unreconciled bank transactions and unmatched supplier statement items in natural language.',
    icon: Receipt,
  },
  {
    title: 'Operational actions',
    description: 'Trigger Gmail invoice sync, queue uploaded S3 files for OCR, and export pending invoices to AutoCount.',
    icon: Mail,
  },
];

function createMessage(role: ChatRole, content: string, toolsUsed?: string[]): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    toolsUsed,
  };
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoString));
  } catch {
    return '';
  }
}

function formatSessionId(sessionId: string | null): string {
  if (!sessionId) return 'New chat';
  if (sessionId.length <= 16) return sessionId;
  return `${sessionId.slice(0, 8)}...${sessionId.slice(-6)}`;
}

export default function SmartdokAgentPage() {
  const { error: showError, success: showSuccess } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([STARTER_MESSAGE]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const sendMessage = async (messageText?: string) => {
    const trimmedMessage = (messageText ?? input).trim();
    if (!trimmedMessage || isSending) {
      return;
    }

    const userMessage = createMessage('user', trimmedMessage);
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await chatWithAgent({
        message: trimmedMessage,
        session_id: sessionId,
      });

      const assistantMessage = createMessage(
        'assistant',
        response.data.reply,
        response.data.tools_used
      );

      setMessages((current) => [...current, assistantMessage]);
      setSessionId(response.data.session_id);
      setLastToolsUsed(response.data.tools_used || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to send message to Smartdok Agent';
      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          'I could not complete that request just now. Please try again in a moment.'
        ),
      ]);
      showError(message);
    } finally {
      setIsSending(false);
    }
  };

  const startNewChat = () => {
    setMessages([createMessage('assistant', STARTER_MESSAGE.content)]);
    setInput('');
    setSessionId(null);
    setLastToolsUsed([]);
    showSuccess('Started a new Smartdok Agent session');
  };

  return (
    <AppLayout pageName="Smartdok Agent (Beta)">
      <div className="space-y-6">
        <section
          className="rounded-3xl border overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, var(--card)) 0%, var(--card) 55%, color-mix(in srgb, var(--secondary) 18%, var(--card)) 100%)',
            borderColor: 'color-mix(in srgb, var(--primary) 20%, var(--border))',
          }}
        >
          <div className="p-6 md:p-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
                  style={{
                    background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                    color: 'var(--foreground)',
                    border: '1px solid color-mix(in srgb, var(--primary) 30%, var(--border))',
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Smartdok Agent
                </div>
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{
                    background: 'color-mix(in srgb, var(--warning) 18%, transparent)',
                    color: 'var(--foreground)',
                    border: '1px solid color-mix(in srgb, var(--warning) 25%, var(--border))',
                  }}
                >
                  Beta
                </span>
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>
                  Chat with your accounting workspace in plain English
                </h1>
                <p className="mt-3 max-w-2xl text-sm md:text-base leading-7" style={{ color: 'var(--muted-foreground)' }}>
                  The backend agent decides which Smartdok tools to call, runs them against the live database, and replies in a single conversation. Sessions stay active until the server restarts or you begin a new chat.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2"
                  style={{ background: 'var(--card)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
                >
                  <Bot className="h-4 w-4" />
                  Session {formatSessionId(sessionId)}
                </div>
                {lastToolsUsed.length > 0 && (
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-2"
                    style={{ background: 'var(--card)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
                  >
                    Last tools: {lastToolsUsed.join(', ')}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={startNewChat}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-opacity"
              style={{
                background: 'var(--foreground)',
                color: 'var(--background)',
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Start new chat
            </button>
          </div>
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section
              className="rounded-2xl border p-5"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--muted-foreground)' }}>
                Try asking
              </h2>
              <div className="mt-4 space-y-3">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void sendMessage(suggestion)}
                    disabled={isSending}
                    className="w-full rounded-2xl border p-4 text-left text-sm leading-6 transition-colors disabled:opacity-60"
                    style={{
                      background: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </section>

            <section
              className="rounded-2xl border p-5"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--muted-foreground)' }}>
                Current beta scope
              </h2>
              <div className="mt-4 space-y-4">
                {CAPABILITIES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-3">
                      <div
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                          color: 'var(--primary)',
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted-foreground)' }}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section
            className="flex h-[70vh] min-h-[34rem] max-h-[54rem] min-w-0 flex-col overflow-hidden rounded-3xl border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div
              className="flex items-center justify-between gap-4 border-b px-5 py-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  Conversation
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Replies can include live results from invoices, statements, duplicates, missing document flags, Gmail, and exports.
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-5">
              <div className="mx-auto flex max-w-4xl flex-col gap-4">
                {messages.map((message) => {
                  const isAssistant = message.role === 'assistant';

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className="max-w-[92%] rounded-3xl px-4 py-3 md:max-w-[78%]"
                        style={{
                          background: isAssistant
                            ? 'var(--background)'
                            : 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 76%, var(--secondary)) 100%)',
                          color: isAssistant ? 'var(--foreground)' : 'var(--primary-foreground)',
                          border: isAssistant ? '1px solid var(--border)' : '1px solid transparent',
                        }}
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
                          {isAssistant ? 'Smartdok Agent' : 'You'}
                          {formatTime(message.createdAt) && (
                            <span
                              className="font-medium normal-case tracking-normal"
                              style={{
                                color: isAssistant
                                  ? 'var(--muted-foreground)'
                                  : 'color-mix(in srgb, var(--primary-foreground) 75%, transparent)',
                              }}
                            >
                              {formatTime(message.createdAt)}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 whitespace-pre-wrap text-sm leading-7">
                          {message.content}
                        </div>

                        {isAssistant && message.toolsUsed && message.toolsUsed.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {message.toolsUsed.map((tool) => (
                              <span
                                key={`${message.id}-${tool}`}
                                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                style={{
                                  background: 'color-mix(in srgb, var(--secondary) 12%, transparent)',
                                  color: 'var(--foreground)',
                                  border: '1px solid color-mix(in srgb, var(--secondary) 24%, var(--border))',
                                }}
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex justify-start">
                    <div
                      className="rounded-3xl border px-4 py-3"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <span className="h-2.5 w-2.5 animate-bounce rounded-full" style={{ background: 'var(--primary)' }} />
                          <span
                            className="h-2.5 w-2.5 animate-bounce rounded-full"
                            style={{ background: 'var(--primary)', animationDelay: '120ms' }}
                          />
                          <span
                            className="h-2.5 w-2.5 animate-bounce rounded-full"
                            style={{ background: 'var(--primary)', animationDelay: '240ms' }}
                          />
                        </div>
                        <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                          Smartdok Agent is working...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div
              className="border-t px-4 py-4 md:px-5"
              style={{ borderColor: 'var(--border)' }}
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage();
                }}
                className="mx-auto max-w-4xl"
              >
                <div
                  className="rounded-3xl border p-3"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Ask about duplicates, missing DO/custom form, unreconciled transactions, Gmail sync, exports, or statement follow-up..."
                    className="min-h-[110px] w-full resize-none bg-transparent px-2 py-2 text-sm outline-none"
                    style={{ color: 'var(--foreground)' }}
                  />

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5" style={{ color: 'var(--muted-foreground)' }}>
                      Enter sends. Shift+Enter adds a new line. The active organisation header is included automatically.
                    </p>

                    <button
                      type="submit"
                      disabled={isSending || !input.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        background: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                      }}
                    >
                      <SendHorizontal className="h-4 w-4" />
                      {isSending ? 'Sending...' : 'Send to Agent'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
