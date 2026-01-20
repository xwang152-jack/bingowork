/**
 * Conversation Manager
 *
 * Manages conversation history and state for the agent.
 * Handles history size limits, artifact tracking, and history persistence.
 */

import type { Anthropic } from '@anthropic-ai/sdk';

export type ConversationMessage = Anthropic.MessageParam;

export interface Artifact {
  path: string;
  name: string;
  type: string;
}

/**
 * Manages conversation state
 */
export class ConversationManager {
  private history: ConversationMessage[] = [];
  private artifacts: Artifact[] = [];
  private readonly MAX_HISTORY_SIZE = 200;

  /**
   * Add a message to history
   */
  addMessage(message: ConversationMessage): void {
    this.history.push(message);
  }

  /**
   * Get current history
   */
  getHistory(): ConversationMessage[] {
    return this.history;
  }

  /**
   * Load history from saved session (trims to max size)
   */
  loadHistory(messages: ConversationMessage[]): void {
    this.history = messages.slice(0, this.MAX_HISTORY_SIZE);
    this.artifacts = []; // Clear artifacts when loading new session
  }

  /**
   * Clear history and artifacts for new session
   */
  clearHistory(): void {
    this.history = [];
    this.artifacts = [];
  }

  /**
   * Get current history size
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Check if history is at max capacity
   */
  isHistoryFull(): boolean {
    return this.history.length >= this.MAX_HISTORY_SIZE;
  }

  /**
   * Add an artifact to the tracking list
   */
  addArtifact(artifact: Artifact): void {
    this.artifacts.push(artifact);
  }

  /**
   * Get all artifacts
   */
  getArtifacts(): Artifact[] {
    return this.artifacts;
  }

  /**
   * Clear artifacts
   */
  clearArtifacts(): void {
    this.artifacts = [];
  }

  /**
   * Get the last N messages from history
   */
  getLastMessages(count: number): ConversationMessage[] {
    return this.history.slice(-count);
  }

  /**
   * Get history statistics
   */
  getStats(): {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    artifactCount: number;
  } {
    const userMessages = this.history.filter(m => m.role === 'user').length;
    const assistantMessages = this.history.filter(m => m.role === 'assistant').length;

    return {
      totalMessages: this.history.length,
      userMessages,
      assistantMessages,
      artifactCount: this.artifacts.length,
    };
  }
}
