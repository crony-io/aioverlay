/** Role of a chat message participant */
export type MessageRole = 'user' | 'assistant' | 'system';

/** A single message in a conversation */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  model?: string;
  /** Whether this message was truncated due to stream abort */
  incomplete?: boolean;
}

/** Metadata for a conversation (used in the index) */
export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/** A full conversation with all messages */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}
