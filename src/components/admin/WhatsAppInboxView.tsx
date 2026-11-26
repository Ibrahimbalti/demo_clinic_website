import React, { useState, useMemo } from 'react';
import {
  Bot,
  CheckCheck,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Search,
  Send,
  UserCheck,
  CheckCircle,
  PlusCircle,
} from 'lucide-react';
import { useClinicStore } from '../../hooks/useClinicStore';
import { handleInboundWhatsAppWebhookMessage } from '../../lib/aiReceptionistEngine';

export const WhatsAppInboxView: React.FC = () => {
  const { state, store, currentUser } = useClinicStore();
  const { conversations, messages } = state;

  const [selectedConvId, setSelectedConvId] = useState<string>(
    conversations[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [simInboundText, setSimInboundText] = useState('');

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.patientName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const activeConversation = useMemo(() => {
    return (
      conversations.find((c) => c.id === selectedConvId) ||
      filteredConversations[0] ||
      null
    );
  }, [conversations, selectedConvId, filteredConversations]);

  const activeMessages = useMemo(() => {
    if (!activeConversation) return [];
    return messages.filter((m) => m.conversationId === activeConversation.id);
  }, [messages, activeConversation]);

  const handleManualReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !replyText.trim()) return;
    store.sendManualHumanReply(
      activeConversation.id,
      replyText.trim(),
      currentUser?.fullName || 'Receptionist'
    );
    setReplyText('');
  };

  const handleToggleHandlingMode = () => {
    if (!activeConversation) return;
    const nextMode = activeConversation.handlingMode === 'ai' ? 'human' : 'ai';
    store.setConversationHandlingMode(
      activeConversation.id,
      nextMode,
      currentUser?.fullName || 'Receptionist'
    );
  };

  const handleSimulatePatientIncoming = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !simInboundText.trim()) return;
    handleInboundWhatsAppWebhookMessage({
      whatsappMessageId: `wamid.inbox_test.${Date.now()}`,
      fromPhone: activeConversation.phone,
      senderProfileName: activeConversation.patientName,
      messageType: 'text',
      textContent: simInboundText.trim(),
    });
    setSimInboundText('');
  };

  return (
    <div className="bg-[var(--surf)] border border-[var(--line)] rounded-2xl shadow-xs overflow-hidden grid lg:grid-cols-12 min-h-[640px]">
      {/* Left 4 Cols: Conversation List */}
      <div className="lg:col-span-4 border-r border-[var(--line)] flex flex-col">
        <div className="p-4 border-b border-[var(--line)] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-heading font-semibold text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#25D366]" />
              <span>WhatsApp Inbox</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--teal-subtle)] text-[var(--teal)] text-xs font-bold">
              {conversations.length} Chats
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[var(--mut)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient or phone..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs focus:outline-none focus:border-[var(--teal)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--mut)]">
              No WhatsApp conversations match your search.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = activeConversation?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-left p-4 transition flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-[var(--teal-subtle)]/70 border-l-4 border-l-[var(--teal)]'
                      : 'hover:bg-[var(--surf-alt)]'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--ink)] truncate">
                        {conv.patientName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          conv.handlingMode === 'ai'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {conv.handlingMode === 'ai' ? '🤖 AI Active' : '👤 Human Mode'}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--mut)] font-mono">{conv.phone}</div>
                    <p className="text-xs text-[var(--mut)] truncate">
                      {conv.lastMessagePreview}
                    </p>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span className="text-[10px] text-[var(--mut)] block">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-[#25D366] text-white text-[10px] font-bold">
                        {conv.unreadCount} new
                      </span>
                    )}
                    <span
                      className={`block text-[10px] font-semibold ${
                        conv.status === 'open' ? 'text-emerald-600' : 'text-[var(--mut)]'
                      }`}
                    >
                      {conv.status.toUpperCase()}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right 8 Cols: Active Conversation Thread & Human Takeover Controls */}
      <div className="lg:col-span-8 flex flex-col">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center p-12 text-sm text-[var(--mut)]">
            Select a conversation to view message history and manage AI/Human takeover.
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-[var(--line)] bg-[var(--surf-alt)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h4 className="font-bold text-base text-[var(--ink)]">
                    {activeConversation.patientName}
                  </h4>
                  <span className="text-xs font-mono text-[var(--mut)]">
                    ({activeConversation.phone})
                  </span>
                </div>
                <p className="text-xs text-[var(--mut)] mt-0.5">
                  {activeConversation.handlingMode === 'ai'
                    ? 'AI Receptionist is currently responding automatically to this patient.'
                    : 'Human Takeover Active — AI is paused and will not respond until explicitly resumed.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleHandlingMode}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition ${
                    activeConversation.handlingMode === 'ai'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {activeConversation.handlingMode === 'ai' ? (
                    <>
                      <PauseCircle className="w-4 h-4" />
                      <span>Take Over (Pause AI)</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4" />
                      <span>Return to AI (Resume AI)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => store.closeConversation(activeConversation.id)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[var(--line-strong)] hover:border-[var(--teal)] text-xs font-semibold transition"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>
                    {activeConversation.status === 'open' ? 'Close Chat' : 'Reopen Chat'}
                  </span>
                </button>
              </div>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#ece5dd]/60 dark:bg-[#0b191c]">
              {activeMessages.map((msg) => {
                const isInbound = msg.direction === 'inbound';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-3.5 shadow-xs text-xs sm:text-sm space-y-1.5 ${
                        isInbound
                          ? 'bg-white dark:bg-[#122529] text-[var(--ink)] rounded-tl-xs'
                          : msg.senderType === 'human'
                          ? 'bg-[#0e4f57] text-white rounded-tr-xs'
                          : 'bg-[#dcf8c6] text-slate-900 rounded-tr-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-wider opacity-75">
                        <span className="flex items-center gap-1">
                          {msg.senderType === 'patient' && '👤 Patient'}
                          {msg.senderType === 'ai' && (
                            <>
                              <Bot className="w-3 h-3" /> AI Receptionist
                            </>
                          )}
                          {msg.senderType === 'human' && (
                            <>
                              <UserCheck className="w-3 h-3" /> Staff Receptionist
                            </>
                          )}
                          {msg.senderType === 'system' && '⏰ Automated Reminder'}
                        </span>
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>

                      {msg.toolCallsExecuted && msg.toolCallsExecuted.length > 0 && (
                        <div className="pt-1.5 border-t border-black/10 flex flex-wrap gap-1">
                          {msg.toolCallsExecuted.map((tool) => (
                            <span
                              key={tool}
                              className="px-2 py-0.5 rounded bg-emerald-700/15 text-emerald-900 font-mono text-[10px] font-semibold"
                            >
                              ⚡ Tool: {tool}()
                            </span>
                          ))}
                        </div>
                      )}

                      {!isInbound && (
                        <div className="flex items-center justify-end gap-1 text-[10px] opacity-75">
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>{msg.deliveryStatus}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Simulator Bar: Test Incoming Patient Message in This Thread */}
            <form
              onSubmit={handleSimulatePatientIncoming}
              className="px-4 py-2.5 bg-[var(--surf-alt)] border-t border-[var(--line)] flex items-center gap-2"
            >
              <span className="text-[11px] font-semibold text-[var(--mut)] shrink-0">
                Simulate Patient Reply:
              </span>
              <input
                type="text"
                value={simInboundText}
                onChange={(e) => setSimInboundText(e.target.value)}
                placeholder="Send a test inbound message from this patient..."
                className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surf)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--teal)]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-[var(--surf)] border border-[var(--line-strong)] hover:border-[var(--teal)] text-xs font-semibold flex items-center gap-1 transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Simulate Webhook</span>
              </button>
            </form>

            {/* Staff Manual Reply Box */}
            <form
              onSubmit={handleManualReply}
              className="p-4 bg-[var(--surf)] border-t border-[var(--line)] flex items-center gap-3"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type a manual receptionist reply (automatically pauses AI for this thread)..."
                className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--teal)]"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[var(--teal)] hover:bg-[var(--teal-light)] text-white font-bold text-sm flex items-center gap-2 transition"
              >
                <Send className="w-4 h-4" />
                <span>Send Manual Reply</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
