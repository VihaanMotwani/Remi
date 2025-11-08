/**
 * Agenda Types for Live Meeting Assistant
 * Defines the structure for predefined agendas and tracking
 */

export type AgendaStatus = 'not-started' | 'in-progress' | 'covered' | 'skipped';

export interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  status: AgendaStatus;
  subItems?: AgendaItem[];
  coveredAt?: string; // ISO timestamp
  keywords?: string[]; // Keywords to help detect when this is discussed
  estimatedMinutes?: number;
}

export interface Agenda {
  id: string;
  meetingTitle: string;
  createdAt: string;
  items: AgendaItem[];
}

export interface AgendaPrompt {
  id: string;
  type: 'missing' | 'expand' | 'off-track';
  message: string;
  relatedItemId: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface TranscriptionChunk {
  timestamp: string;
  speaker: 'You' | 'Other';
  text: string;
}

export interface AgendaAnalysis {
  agenda: Agenda;
  prompts: AgendaPrompt[];
  currentTopic?: string;
  conversationSummary?: string;
}
