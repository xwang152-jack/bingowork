/**
 * Unit tests for IPC Handlers
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_CHANNELS,
  SESSION_CHANNELS,
  CONFIG_CHANNELS,
  PERMISSION_CHANNELS,
  WINDOW_CHANNELS,
  DIALOG_CHANNELS,
  FLOATING_BALL_CHANNELS,
  SHORTCUT_CHANNELS,
  MCP_CHANNELS,
  SKILLS_CHANNELS,
} from '../../constants/IpcChannels';

describe('IPC Handler Requirements', () => {
  describe('Agent Handlers', () => {
    it('should define SEND_MESSAGE handler', () => {
      expect(AGENT_CHANNELS.SEND_MESSAGE).toBe('agent:send-message');
    });

    it('should define ABORT handler', () => {
      expect(AGENT_CHANNELS.ABORT).toBe('agent:abort');
    });

    it('should define CONFIRM_RESPONSE handler', () => {
      expect(AGENT_CHANNELS.CONFIRM_RESPONSE).toBe('agent:confirm-response');
    });

    it('should define AUTHORIZE_FOLDER handler', () => {
      expect(AGENT_CHANNELS.AUTHORIZE_FOLDER).toBe('agent:authorize-folder');
    });

    it('should define SET_WORK_MODE handler', () => {
      expect(AGENT_CHANNELS.SET_WORK_MODE).toBe('agent:set-work-mode');
    });
  });

  describe('Session Handlers', () => {
    it('should define CREATE handler', () => {
      expect(SESSION_CHANNELS.CREATE).toBe('session:create');
    });

    it('should define LIST handler', () => {
      expect(SESSION_CHANNELS.LIST).toBe('session:list');
    });

    it('should define GET handler', () => {
      expect(SESSION_CHANNELS.GET).toBe('session:get');
    });

    it('should define LOAD handler', () => {
      expect(SESSION_CHANNELS.LOAD).toBe('session:load');
    });

    it('should define SAVE handler', () => {
      expect(SESSION_CHANNELS.SAVE).toBe('session:save');
    });

    it('should define DELETE handler', () => {
      expect(SESSION_CHANNELS.DELETE).toBe('session:delete');
    });

    it('should define RENAME handler', () => {
      expect(SESSION_CHANNELS.RENAME).toBe('session:rename');
    });

    it('should define CURRENT handler', () => {
      expect(SESSION_CHANNELS.CURRENT).toBe('session:current');
    });
  });

  describe('Config Handlers', () => {
    it('should define GET_ALL handler', () => {
      expect(CONFIG_CHANNELS.GET_ALL).toBe('config:get-all');
    });

    it('should define SET_ALL handler', () => {
      expect(CONFIG_CHANNELS.SET_ALL).toBe('config:set-all');
    });

    it('should define SET_MODEL handler', () => {
      expect(CONFIG_CHANNELS.SET_MODEL).toBe('config:set-model');
    });
  });

  describe('Permission Handlers', () => {
    it('should define LIST handler', () => {
      expect(PERMISSION_CHANNELS.LIST).toBe('permissions:list');
    });

    it('should define REVOKE handler', () => {
      expect(PERMISSION_CHANNELS.REVOKE).toBe('permissions:revoke');
    });

    it('should define CLEAR handler', () => {
      expect(PERMISSION_CHANNELS.CLEAR).toBe('permissions:clear');
    });
  });

  describe('Window Handlers', () => {
    it('should define MINIMIZE handler', () => {
      expect(WINDOW_CHANNELS.MINIMIZE).toBe('window:minimize');
    });

    it('should define MAXIMIZE handler', () => {
      expect(WINDOW_CHANNELS.MAXIMIZE).toBe('window:maximize');
    });

    it('should define CLOSE handler', () => {
      expect(WINDOW_CHANNELS.CLOSE).toBe('window:close');
    });
  });

  describe('Dialog Handlers', () => {
    it('should define SELECT_FOLDER handler', () => {
      expect(DIALOG_CHANNELS.SELECT_FOLDER).toBe('dialog:select-folder');
    });
  });

  describe('Floating Ball Handlers', () => {
    it('should define TOGGLE handler', () => {
      expect(FLOATING_BALL_CHANNELS.TOGGLE).toBe('floating-ball:toggle');
    });

    it('should define SHOW_MAIN handler', () => {
      expect(FLOATING_BALL_CHANNELS.SHOW_MAIN).toBe('floating-ball:show-main');
    });

    it('should define START_DRAG handler', () => {
      expect(FLOATING_BALL_CHANNELS.START_DRAG).toBe('floating-ball:start-drag');
    });

    it('should define MOVE handler', () => {
      expect(FLOATING_BALL_CHANNELS.MOVE).toBe('floating-ball:move');
    });
  });

  describe('Shortcut Handlers', () => {
    it('should define UPDATE handler', () => {
      expect(SHORTCUT_CHANNELS.UPDATE).toBe('shortcut:update');
    });
  });

  describe('MCP Handlers', () => {
    it('should define GET_CONFIG handler', () => {
      expect(MCP_CHANNELS.GET_CONFIG).toBe('mcp:get-config');
    });

    it('should define SAVE_CONFIG handler', () => {
      expect(MCP_CHANNELS.SAVE_CONFIG).toBe('mcp:save-config');
    });
  });

  describe('Skills Handlers', () => {
    it('should define LIST handler', () => {
      expect(SKILLS_CHANNELS.LIST).toBe('skills:list');
    });

    it('should define GET handler', () => {
      expect(SKILLS_CHANNELS.GET).toBe('skills:get');
    });

    it('should define SAVE handler', () => {
      expect(SKILLS_CHANNELS.SAVE).toBe('skills:save');
    });

    it('should define DELETE handler', () => {
      expect(SKILLS_CHANNELS.DELETE).toBe('skills:delete');
    });
  });
});

describe('IPC Handler Pattern Validation', () => {
  it('should follow consistent naming convention', () => {
    const channels = [
      AGENT_CHANNELS.SEND_MESSAGE,
      SESSION_CHANNELS.CREATE,
      CONFIG_CHANNELS.GET_ALL,
      PERMISSION_CHANNELS.LIST,
      WINDOW_CHANNELS.MINIMIZE,
    ];

    channels.forEach(channel => {
      expect(channel).toMatch(/^[a-z]+:[a-z-]+$/);
    });
  });

  it('should have colon-separated namespace', () => {
    const channels = [
      AGENT_CHANNELS.SEND_MESSAGE,
      SESSION_CHANNELS.CREATE,
      CONFIG_CHANNELS.GET_ALL,
    ];

    channels.forEach(channel => {
      const parts = channel.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBeTruthy();
      expect(parts[1]).toBeTruthy();
    });
  });
});
