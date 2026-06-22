'use client';



import { useCallback, useEffect, useRef, useState } from 'react';

import {

  Bot,

  Loader2,

  Paperclip,

  RotateCcw,

  Send,

  Sparkles,

  Upload,

} from 'lucide-react';

import { useLanguage } from '@/lib/i18n';

import { useToast } from '@/lib/toast';

import { useAuth } from '@/lib/auth';

import { useOrganization } from '@/lib/OrganizationContext';

import {

  sendAgentMessage,

  resolveAgentConfirmation,

  prepareAgentAttachmentsFromFiles,

  createAgentSessionId,

  buildConversationHistory,

  type AgentContext,

} from '@/services/AgentService';

import {

  AGENT_ACCEPT_MIME,

  AGENT_MAX_ATTACHMENTS,

  mergePendingAgentFiles,

} from '@/services/agentAttachments';

import { AgentMessageBubble, type ChatMessage } from './AgentMessageBubble';

import { AgentAttachmentTray } from './AgentAttachmentTray';



const SESSION_STORAGE_KEY = 'smartdok_agent_session_id';



function createMessageId(): string {

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

}



export function AgentChat() {

  const { t } = useLanguage();

  const { error: showError } = useToast();

  const { user } = useAuth();

  const { selectedOrganizationId } = useOrganization();

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState('');

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);

  const [isResolving, setIsResolving] = useState(false);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [isPreparingFiles, setIsPreparingFiles] = useState(false);

  const [isDragging, setIsDragging] = useState(false);

  const dragDepthRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);



  useEffect(() => {

    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (stored) {

      setSessionId(stored);

    }

  }, []);



  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  }, [messages, isSending]);



  const persistSession = useCallback((id: string) => {

    setSessionId(id);

    sessionStorage.setItem(SESSION_STORAGE_KEY, id);

  }, []);



  const appendAssistantReply = useCallback((data: {

    reply: string;

    pending_action?: ChatMessage['pendingAction'];

  }) => {

    setMessages((prev) => [

      ...prev,

      {

        id: createMessageId(),

        role: 'assistant',

        text: data.reply,

        timestamp: new Date(),

        pendingAction: data.pending_action,

      },

    ]);

  }, []);



  const buildAgentContext = useCallback((): AgentContext | null => {

    if (!user?.id) return null;

    const companyId =

      selectedOrganizationId !== null

        ? String(selectedOrganizationId)

        : 'default';

    return {

      user_id: String(user.id),

      company_id: companyId,

      session_id: sessionId,

    };

  }, [user?.id, selectedOrganizationId, sessionId]);



  const notifyFileMergeResult = useCallback(

    (result: ReturnType<typeof mergePendingAgentFiles>) => {

      if (result.skippedTooLarge.length > 0) {

        showError(t.agent.fileTooLarge);

      }

      if (result.skippedUnsupported.length > 0) {

        showError(t.agent.unsupportedFileType);

      }

      if (result.skippedLimit > 0) {

        showError(t.agent.maxFilesReached);

      }

    },

    [showError, t.agent]

  );



  const addFiles = useCallback(

    (incoming: FileList | File[]) => {

      setPendingFiles((current) => {

        const result = mergePendingAgentFiles(current, incoming);

        notifyFileMergeResult(result);

        return result.files;

      });

    },

    [notifyFileMergeResult]

  );



  const handleDragEnter = (e: React.DragEvent) => {

    e.preventDefault();

    e.stopPropagation();

    dragDepthRef.current += 1;

    if (e.dataTransfer.types.includes('Files')) {

      setIsDragging(true);

    }

  };



  const handleDragLeave = (e: React.DragEvent) => {

    e.preventDefault();

    e.stopPropagation();

    dragDepthRef.current -= 1;

    if (dragDepthRef.current <= 0) {

      dragDepthRef.current = 0;

      setIsDragging(false);

    }

  };



  const handleDragOver = (e: React.DragEvent) => {

    e.preventDefault();

    e.stopPropagation();

    if (e.dataTransfer.types.includes('Files')) {

      e.dataTransfer.dropEffect = 'copy';

    }

  };



  const handleDrop = (e: React.DragEvent) => {

    e.preventDefault();

    e.stopPropagation();

    dragDepthRef.current = 0;

    setIsDragging(false);

    if (e.dataTransfer.files?.length) {

      addFiles(e.dataTransfer.files);

    }

  };



  const sendMessage = async (text: string) => {

    const trimmed = text.trim();

    if (!trimmed && pendingFiles.length === 0) return;

    if (isSending || isPreparingFiles) return;



    const context = buildAgentContext();

    if (!context) {

      showError(t.agent.notAuthenticated);

      return;

    }



    if (!context.session_id) {

      const newSessionId = createAgentSessionId();

      context.session_id = newSessionId;

      persistSession(newSessionId);

    }



    let attachments: Awaited<ReturnType<typeof prepareAgentAttachmentsFromFiles>> = [];



    if (pendingFiles.length > 0) {

      setIsPreparingFiles(true);

      try {

        attachments = await prepareAgentAttachmentsFromFiles(pendingFiles);

      } catch (err) {

        showError(err instanceof Error ? err.message : t.agent.uploadFailed);

        setIsPreparingFiles(false);

        return;

      }

      setIsPreparingFiles(false);

    }



    const attachmentNames = attachments.map((a) => a.filename);

    const userText =

      trimmed ||

      (attachmentNames.length === 1

        ? t.agent.sentAttachment

        : t.agent.sentAttachments.replace('{count}', String(attachmentNames.length)));



    const conversationHistory = buildConversationHistory(messages);



    const userMessage: ChatMessage = {

      id: createMessageId(),

      role: 'user',

      text: userText,

      timestamp: new Date(),

      attachments: attachmentNames.length > 0 ? attachmentNames.map((filename) => ({ filename })) : undefined,

    };



    setMessages((prev) => [...prev, userMessage]);

    setInput('');

    setPendingFiles([]);

    setIsSending(true);



    try {

      const data = await sendAgentMessage({

        text: trimmed || t.agent.analyzeAttachment,

        context,

        attachments,

        conversation_history: conversationHistory,

      });



      if (data.session_id) {

        persistSession(data.session_id);

      }



      appendAssistantReply({

        reply: data.reply,

        pending_action: data.pending_action,

      });

    } catch (err) {

      showError(err instanceof Error ? err.message : t.agent.sendFailed);

    } finally {

      setIsSending(false);

      textareaRef.current?.focus();

    }

  };



  const handleResolveAction = async (

    actionId: string,

    resolution: 'approved' | 'rejected',

    payload?: Record<string, unknown>

  ) => {

    if (isResolving) return;

    setIsResolving(true);



    const context = buildAgentContext();

    if (!context) {

      showError(t.agent.notAuthenticated);

      setIsResolving(false);

      return;

    }



    try {

      const data = await resolveAgentConfirmation({

        action_id: actionId,

        resolution,

        edited_payload: payload,

        context,

      });



      setMessages((prev) =>

        prev.map((msg) =>

          msg.pendingAction?.action_id === actionId

            ? { ...msg, pendingAction: null }

            : msg

        )

      );



      if (data.session_id) {

        persistSession(data.session_id);

      }

      appendAssistantReply({

        reply: data.reply,

        pending_action: data.pending_action,

      });

    } catch (err) {

      showError(err instanceof Error ? err.message : t.agent.resolveFailed);

    } finally {

      setIsResolving(false);

    }

  };



  const handleNewChat = () => {

    setMessages([]);

    setSessionId(null);

    setInput('');

    setPendingFiles([]);

    sessionStorage.removeItem(SESSION_STORAGE_KEY);

    textareaRef.current?.focus();

  };



  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {

    if (e.key === 'Enter' && !e.shiftKey) {

      e.preventDefault();

      sendMessage(input);

    }

  };



  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {

    if (e.target.files?.length) {

      addFiles(e.target.files);

    }

    e.target.value = '';

  };



  const suggestedPrompts = [

    t.agent.prompts.cashBalance,

    t.agent.prompts.recentInvoices,

    t.agent.prompts.dueBills,

  ];



  const isBusy = isSending || isPreparingFiles;



  return (

    <div

      className="relative flex flex-col overflow-hidden rounded-xl border"

      style={{

        background: 'var(--card)',

        borderColor: 'var(--border)',

        height: 'calc(100vh - 10rem)',

        minHeight: '480px',

      }}

      onDragEnter={handleDragEnter}

      onDragLeave={handleDragLeave}

      onDragOver={handleDragOver}

      onDrop={handleDrop}

    >

      {isDragging && (

        <div

          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed"

          style={{

            background: 'color-mix(in srgb, var(--primary) 12%, transparent)',

            borderColor: 'var(--primary)',

          }}

        >

          <div className="flex flex-col items-center gap-2 text-center">

            <Upload className="h-8 w-8" style={{ color: 'var(--primary)' }} />

            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>

              {t.agent.dragDropOverlay}

            </p>

            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>

              {t.agent.dragDropHint}

            </p>

          </div>

        </div>

      )}



      {/* Header */}

      <div

        className="flex items-center justify-between border-b px-5 py-4"

        style={{ borderColor: 'var(--border)' }}

      >

        <div className="flex items-center gap-3">

          <div

            className="flex h-10 w-10 items-center justify-center rounded-full"

            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}

          >

            <Bot className="h-5 w-5" />

          </div>

          <div>

            <div className="flex items-center gap-2">

              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>

                {t.nav.smartdokAgent}

              </h2>

              <span

                className="rounded-full px-2 py-0.5 text-xs font-medium"

                style={{

                  background: 'var(--info-light)',

                  color: 'var(--info-dark)',

                }}

              >

                {t.agent.beta}

              </span>

            </div>

            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>

              {t.agent.subtitle}

            </p>

          </div>

        </div>

        <button

          type="button"

          onClick={handleNewChat}

          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"

          style={{

            color: 'var(--muted-foreground)',

            border: '1px solid var(--border)',

          }}

          title={t.agent.newChat}

        >

          <RotateCcw className="h-4 w-4" />

          <span className="hidden sm:inline">{t.agent.newChat}</span>

        </button>

      </div>



      {/* Messages */}

      <div className="flex-1 overflow-y-auto px-5 py-4">

        {messages.length === 0 ? (

          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">

            <div

              className="flex h-16 w-16 items-center justify-center rounded-full"

              style={{ background: 'var(--muted)' }}

            >

              <Sparkles className="h-8 w-8" style={{ color: 'var(--primary)' }} />

            </div>

            <div>

              <p className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>

                {t.agent.welcomeTitle}

              </p>

              <p className="mt-1 max-w-md text-sm" style={{ color: 'var(--muted-foreground)' }}>

                {t.agent.welcomeDescription}

              </p>

              <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>

                {t.agent.dragDropHint}

              </p>

            </div>

            <div className="flex flex-wrap justify-center gap-2">

              {suggestedPrompts.map((prompt) => (

                <button

                  key={prompt}

                  type="button"

                  onClick={() => sendMessage(prompt)}

                  disabled={isBusy}

                  className="rounded-full px-4 py-2 text-sm transition-colors disabled:opacity-50"

                  style={{

                    background: 'var(--muted)',

                    color: 'var(--foreground)',

                    border: '1px solid var(--border)',

                  }}

                >

                  {prompt}

                </button>

              ))}

            </div>

          </div>

        ) : (

          <div className="space-y-4">

            {messages.map((message) => (

              <AgentMessageBubble

                key={message.id}

                message={message}

                onResolveAction={handleResolveAction}

                isResolving={isResolving}

                approveLabel={t.agent.approve}

                rejectLabel={t.agent.reject}

              />

            ))}

            {isBusy && (

              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>

                <Loader2 className="h-4 w-4 animate-spin" />

                {isPreparingFiles ? t.agent.preparingAttachments : t.agent.thinking}

              </div>

            )}

            <div ref={messagesEndRef} />

          </div>

        )}

      </div>



      {/* Input */}

      <div

        className="border-t px-5 py-4"

        style={{ borderColor: 'var(--border)' }}

      >

        <AgentAttachmentTray

          files={pendingFiles}

          onRemove={(index) => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}

          onClear={() => setPendingFiles([])}

        />



        <div className="flex items-end gap-2">

          <input

            ref={fileInputRef}

            type="file"

            accept={AGENT_ACCEPT_MIME}

            multiple

            className="hidden"

            onChange={handleFileSelect}

          />

          <button

            type="button"

            onClick={() => fileInputRef.current?.click()}

            disabled={isBusy || pendingFiles.length >= AGENT_MAX_ATTACHMENTS}

            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50"

            style={{

              border: '1px solid var(--border)',

              color: 'var(--muted-foreground)',

            }}

            title={t.agent.attachFile}

          >

            <Paperclip className="h-4 w-4" />

          </button>



          <textarea

            ref={textareaRef}

            value={input}

            onChange={(e) => setInput(e.target.value)}

            onKeyDown={handleKeyDown}

            placeholder={t.agent.inputPlaceholder}

            rows={1}

            disabled={isBusy}

            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg px-4 py-2.5 text-sm outline-none disabled:opacity-50"

            style={{

              background: 'var(--input)',

              color: 'var(--foreground)',

              border: '1px solid var(--border)',

            }}

          />



          <button

            type="button"

            onClick={() => sendMessage(input)}

            disabled={isBusy || (!input.trim() && pendingFiles.length === 0)}

            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50"

            style={{

              background: 'var(--primary)',

              color: 'var(--primary-foreground)',

            }}

            title={t.agent.send}

          >

            {isBusy ? (

              <Loader2 className="h-4 w-4 animate-spin" />

            ) : (

              <Send className="h-4 w-4" />

            )}

          </button>

        </div>



        <p className="mt-2 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>

          {t.agent.disclaimer}

        </p>

      </div>

    </div>

  );

}


