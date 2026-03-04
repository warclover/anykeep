"use client";

import { AIInputEnhanced } from "./ai-input-enhanced";
import {
  ContextPanel,
  useContextItems,
  AISuggestionBar,
  IntentCorrectionDialog,
} from "./phase4";
import type { AIPanelContentEnhancedProps } from "./types";
import { useAttachmentManager } from "@/hooks/ai/use-attachment-manager";
import { useAIConversation } from "./hooks/use-ai-conversation";
import { useAIMessagePersistence } from "./hooks/use-ai-message-persistence";
import { useAIChatActions } from "./hooks/use-ai-chat-actions";
import { useAIConfirmationHandlers } from "./hooks/use-ai-confirmation-handlers";
import { useAIFeedbackHandlers } from "./hooks/use-ai-feedback-handlers";
import { AIPanelHeader } from "./ai-panel-header";
import { AIMessageList } from "./ai-message-list";

export function AIPanelContentEnhanced({
  conversationId: initialConversationId,
  bookmarkIds,
  folderId,
  title = "AI 知识助手",
  showCloseButton = false,
  onClose,
  className,
  useUnifiedEngine = true,
  initialMessage,
  autoSendInitialMessage = false,
  initialMessages,
}: AIPanelContentEnhancedProps) {
  const conversation = useAIConversation({
    initialConversationId,
    initialMessage,
    initialMessages,
  });
  const context = useContextItems();
  const attachment = useAttachmentManager();
  const confirmation = useAIConfirmationHandlers(conversation.setMessages);
  const feedback = useAIFeedbackHandlers(
    conversation.messages,
    conversation.conversationId,
    bookmarkIds,
  );
  const chatActions = useAIChatActions({
    conversation,
    bookmarkIds,
    folderId,
    useUnifiedEngine,
    getContextReferences: context.getContextReferences,
    attachments: attachment.attachments,
    setPendingConfirmations: confirmation.setPendingConfirmations,
    setShowMemoryHint: feedback.setShowMemoryHint,
    autoSendInitialMessage,
    initialMessage,
  });

  useAIMessagePersistence(conversation.messages, conversation.conversationId);

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      <AIPanelHeader
        title={title}
        showMemoryHint={feedback.showMemoryHint}
        hasMessages={conversation.messages.length > 0}
        showCloseButton={showCloseButton}
        onClear={() => chatActions.handleClear(context.clearItems)}
        onClose={onClose}
      />
      {context.hasItems && (
        <div className="px-4 pt-2 flex-shrink-0">
          <ContextPanel
            items={context.items}
            onRemove={context.removeItem}
            onClear={context.clearItems}
            onAddMore={() => context.setExpanded(true)}
            expanded={context.expanded}
            onExpandedChange={context.setExpanded}
          />
        </div>
      )}
      <AIMessageList
        scrollRef={conversation.scrollRef}
        messages={conversation.messages}
        conversationId={conversation.conversationId}
        isConfirming={confirmation.isConfirming}
        feedbackMap={feedback.feedbackMap}
        onSetInput={conversation.setInput}
        onSuggestionClick={chatActions.handleSuggestionClick}
        onRegenerate={chatActions.handleRegenerate}
        onSaveToNote={feedback.handleSaveToNote}
        onExport={feedback.handleExport}
        onFeedback={feedback.handleFeedback}
        onWrongIntent={feedback.handleWrongIntent}
        onConfirm={confirmation.handleConfirm}
        onCancel={confirmation.handleCancel}
        onRetry={chatActions.handleRetry}
      />
      <AISuggestionBar
        onSetInput={conversation.setInput}
        visible={conversation.messages.length > 0 && !conversation.isLoading}
      />
      <AIInputEnhanced
        value={conversation.input}
        onChange={conversation.setInput}
        onSubmit={chatActions.handleSubmit}
        disabled={conversation.isLoading}
        placeholder=""
        selectedTool={chatActions.selectedTool}
        onToolChange={chatActions.setSelectedTool}
        contextItems={context.items}
        onExpandContext={() => context.setExpanded(true)}
        onClearContext={context.clearItems}
        attachments={attachment.attachments}
        onAttachmentsChange={attachment.setAttachments}
        onClearAttachments={attachment.clearAll}
        onAddFiles={attachment.addFiles}
        isProcessingFile={attachment.isProcessingFile}
      />
      <IntentCorrectionDialog
        open={feedback.intentCorrectionState.open}
        onOpenChange={(open) =>
          feedback.setIntentCorrectionState((prev) => ({ ...prev, open }))
        }
        messageId={feedback.intentCorrectionState.messageId}
        originalInput={feedback.intentCorrectionState.originalInput}
        wrongIntent={feedback.intentCorrectionState.wrongIntent}
      />
    </div>
  );
}

export default AIPanelContentEnhanced;
