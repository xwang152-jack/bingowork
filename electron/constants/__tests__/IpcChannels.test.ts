/**
 * Unit tests for IPC Channels
 */

import { describe, it, expect } from 'vitest';
import {
  IPC_CHANNELS,
  AGENT_CHANNELS,
  SESSION_CHANNELS,
  CONFIG_CHANNELS,
  PERMISSION_CHANNELS,
  WINDOW_CHANNELS,
  isEventChannel,
  getEventChannels,
} from '../../constants/IpcChannels';

describe('IPC Channels', () => {
  describe('Channel Constants', () => {
    it('should have all agent channels', () => {
      expect(AGENT_CHANNELS.SEND_MESSAGE).toBe('agent:send-message');
      expect(AGENT_CHANNELS.STREAM_TOKEN).toBe('agent:stream-token');
      expect(AGENT_CHANNELS.HISTORY_UPDATE).toBe('agent:history-update');
      expect(AGENT_CHANNELS.ABORT).toBe('agent:abort');
      expect(AGENT_CHANNELS.CONFIRM_RESPONSE).toBe('agent:confirm-response');
      expect(AGENT_CHANNELS.AUTHORIZE_FOLDER).toBe('agent:authorize-folder');
      expect(AGENT_CHANNELS.SET_WORK_MODE).toBe('agent:set-work-mode');
    });

    it('should have all session channels', () => {
      expect(SESSION_CHANNELS.CREATE).toBe('session:create');
      expect(SESSION_CHANNELS.LIST).toBe('session:list');
      expect(SESSION_CHANNELS.GET).toBe('session:get');
      expect(SESSION_CHANNELS.LOAD).toBe('session:load');
      expect(SESSION_CHANNELS.SAVE).toBe('session:save');
      expect(SESSION_CHANNELS.DELETE).toBe('session:delete');
      expect(SESSION_CHANNELS.RENAME).toBe('session:rename');
      expect(SESSION_CHANNELS.CURRENT).toBe('session:current');
    });

    it('should have all config channels', () => {
      expect(CONFIG_CHANNELS.GET_ALL).toBe('config:get-all');
      expect(CONFIG_CHANNELS.SET_ALL).toBe('config:set-all');
      expect(CONFIG_CHANNELS.SET_MODEL).toBe('config:set-model');
      expect(CONFIG_CHANNELS.UPDATED).toBe('config:updated');
    });

    it('should have all permission channels', () => {
      expect(PERMISSION_CHANNELS.LIST).toBe('permissions:list');
      expect(PERMISSION_CHANNELS.REVOKE).toBe('permissions:revoke');
      expect(PERMISSION_CHANNELS.CLEAR).toBe('permissions:clear');
    });

    it('should have all window channels', () => {
      expect(WINDOW_CHANNELS.MINIMIZE).toBe('window:minimize');
      expect(WINDOW_CHANNELS.MAXIMIZE).toBe('window:maximize');
      expect(WINDOW_CHANNELS.CLOSE).toBe('window:close');
    });
  });

  describe('Channel Grouping', () => {
    it('should have IPC_CHANNELS with all groups', () => {
      expect(IPC_CHANNELS.AGENT).toBeDefined();
      expect(IPC_CHANNELS.SESSION).toBeDefined();
      expect(IPC_CHANNELS.CONFIG).toBeDefined();
      expect(IPC_CHANNELS.PERMISSION).toBeDefined();
      expect(IPC_CHANNELS.WINDOW).toBeDefined();
    });

    it('should have consistent naming pattern', () => {
      const allChannels = Object.values(IPC_CHANNELS).flatMap(group => Object.values(group));

      allChannels.forEach(channel => {
        // Pattern: lowercase prefix, colon, then lowercase/numbers/hyphens/camelCase
        // e.g., 'agent:send-message', 'agent:sendMessage', 'floating-ball:toggle'
        expect(channel).toMatch(/^[a-z-]+:[a-zA-Z0-9-_]+$/);
      });
    });
  });

  describe('Event Channels', () => {
    it('should identify event channels correctly', () => {
      expect(isEventChannel(AGENT_CHANNELS.STREAM_TOKEN)).toBe(true);
      expect(isEventChannel(AGENT_CHANNELS.HISTORY_UPDATE)).toBe(true);
      expect(isEventChannel(AGENT_CHANNELS.STAGE)).toBe(true);
      expect(isEventChannel(AGENT_CHANNELS.TOOL_CALL)).toBe(true);
      expect(isEventChannel(AGENT_CHANNELS.TOOL_RESULT)).toBe(true);
      expect(isEventChannel(AGENT_CHANNELS.ERROR)).toBe(true);
      expect(isEventChannel(CONFIG_CHANNELS.UPDATED)).toBe(true);
    });

    it('should not identify non-event channels as events', () => {
      expect(isEventChannel(AGENT_CHANNELS.SEND_MESSAGE)).toBe(false);
      expect(isEventChannel(SESSION_CHANNELS.CREATE)).toBe(false);
      expect(isEventChannel(CONFIG_CHANNELS.GET_ALL)).toBe(false);
    });

    it('should get all event channels', () => {
      const eventChannels = getEventChannels();

      expect(eventChannels.length).toBeGreaterThan(0);
      expect(eventChannels).toContain(AGENT_CHANNELS.STREAM_TOKEN);
      expect(eventChannels).toContain(AGENT_CHANNELS.HISTORY_UPDATE);
    });
  });

  describe('Channel Uniqueness', () => {
    it('should have unique channel names across all groups', () => {
      const allChannels = Object.values(IPC_CHANNELS).flatMap(group => Object.values(group));
      const uniqueChannels = new Set(allChannels);

      expect(allChannels.length).toBe(uniqueChannels.size);
    });
  });

  describe('Type Safety', () => {
    it('should have correct types for channel values', () => {
      const channel: string = AGENT_CHANNELS.SEND_MESSAGE;
      expect(channel).toBeTruthy();
      expect(typeof channel).toBe('string');
    });
  });
});
