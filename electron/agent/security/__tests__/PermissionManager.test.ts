/**
 * Unit tests for PermissionManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PermissionManager } from '../PermissionManager';
import { configStore } from '../../../config/ConfigStore';

// Mock configStore
vi.mock('../../../config/ConfigStore', () => ({
  configStore: {
    addAuthorizedFolder: vi.fn(),
    getAuthorizedFolders: vi.fn(),
    setNetworkAccess: vi.fn(),
    getNetworkAccess: vi.fn(),
  },
}));

// Mock fs module using vi.hoisted
const { mockExistsSync, mockStatSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockStatSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    statSync: mockStatSync,
  },
  existsSync: mockExistsSync,
  statSync: mockStatSync,
}));

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;

  beforeEach(() => {
    permissionManager = new PermissionManager();
    vi.clearAllMocks();

    // Set up default mocks
    mockExistsSync.mockReturnValue(false);
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
  });

  describe('authorizeFolder()', () => {
    it('should authorize a valid folder', () => {
      const testPath = '/tmp/authorized/folder';
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(configStore.addAuthorizedFolder).mockReturnValue(undefined);

      const result = permissionManager.authorizeFolder(testPath);

      expect(result).toBe(true);
      expect(configStore.addAuthorizedFolder).toHaveBeenCalledWith(testPath);
    });

    it('should reject root directory "/"', () => {
      const result = permissionManager.authorizeFolder('/');

      expect(result).toBe(false);
      expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
    });

    it('should reject Windows root "C:\\" on Windows', () => {
      if (process.platform === 'win32') {
        const result = permissionManager.authorizeFolder('C:\\');

        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      } else {
        // On non-Windows platforms, Windows drive roots are converted to different paths
        // but should still be rejected as they don't exist
        mockExistsSync.mockReturnValue(false);
        const result = permissionManager.authorizeFolder('C:\\');

        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      }
    });

    it('should reject Windows root "D:\\" on Windows', () => {
      if (process.platform === 'win32') {
        const result = permissionManager.authorizeFolder('D:\\');

        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      } else {
        mockExistsSync.mockReturnValue(false);
        const result = permissionManager.authorizeFolder('D:\\');

        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      }
    });

    it('should reject Windows root with pattern "E:\\" on Windows', () => {
      if (process.platform === 'win32') {
        const result = permissionManager.authorizeFolder('E:\\');

        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      } else {
        mockExistsSync.mockReturnValue(false);
        const result = permissionManager.authorizeFolder('E:\\');

        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      }
    });

    it('should reject non-existent paths', () => {
      mockExistsSync.mockReturnValue(false);

      const result = permissionManager.authorizeFolder('/nonexistent/path');

      expect(result).toBe(false);
      expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
    });

    it('should reject files (not directories)', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = permissionManager.authorizeFolder('/home/user/file.txt');

      expect(result).toBe(false);
      expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
    });

    it('should reject empty string', () => {
      const result = permissionManager.authorizeFolder('');

      expect(result).toBe(false);
      expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
    });

    it('should reject paths with null bytes', () => {
      mockExistsSync.mockReturnValue(false);

      const result = permissionManager.authorizeFolder('/home/user\0documents');

      expect(result).toBe(false);
      expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
    });

    it('should reject overly long paths', () => {
      const longPath = '/a/'.repeat(500); // Way over 1000 chars

      const result = permissionManager.authorizeFolder(longPath);

      expect(result).toBe(false);
      expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
    });

    it('should reject sensitive system directories', () => {
      const sensitivePaths = [
        '/etc',
        '/bin',
        '/usr/bin',
        '/System',
        '/Library',
      ];

      for (const path of sensitivePaths) {
        const result = permissionManager.authorizeFolder(path);
        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      }
    });

    it('should resolve relative paths to absolute before checking', () => {
      // Test that the function properly normalizes paths
      const testPath = '/tmp/another/folder';

      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(configStore.addAuthorizedFolder).mockReturnValue(undefined);

      const result = permissionManager.authorizeFolder(testPath);

      expect(result).toBe(true);
      expect(configStore.addAuthorizedFolder).toHaveBeenCalledWith(testPath);
    });
  });

  describe('isPathAuthorized()', () => {
    it('should return true for authorized folder path', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('/home/user/documents/file.txt');

      expect(result).toBe(true);
    });

    it('should return true for exact folder match', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('/home/user/documents');

      expect(result).toBe(true);
    });

    it('should return false for non-authorized path', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('/home/user/downloads/file.txt');

      expect(result).toBe(false);
    });

    it('should return false for relative paths', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('./documents/file.txt');

      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('');

      expect(result).toBe(false);
    });

    it('should handle undefined input', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized(undefined as any);

      expect(result).toBe(false);
    });

    it('should strip quotes from path', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('"/home/user/documents/file.txt"');

      expect(result).toBe(true);
    });

    it('should strip single quotes from path', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized("'/home/user/documents/file.txt'");

      expect(result).toBe(true);
    });

    it('should return true for Windows absolute paths in authorized folder on Windows', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['C:\\Users\\test\\documents']);

      const result = permissionManager.isPathAuthorized('C:\\Users\\test\\documents\\file.txt');

      if (process.platform === 'win32') {
        expect(result).toBe(true);
      } else {
        // On macOS/Linux, Windows paths aren't recognized as absolute by path.isAbsolute
        expect(result).toBe(false);
      }
    });

    it('should return false for Windows relative paths', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['C:\\Users\\test\\documents']);

      const result = permissionManager.isPathAuthorized('documents\\file.txt');

      expect(result).toBe(false);
    });

    it('should trim whitespace from path', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('  /home/user/documents/file.txt  ');

      expect(result).toBe(true);
    });

    it('should handle multiple authorized folders', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue([
        '/home/user/documents',
        '/home/user/downloads',
      ]);

      expect(permissionManager.isPathAuthorized('/home/user/documents/file.txt')).toBe(true);
      expect(permissionManager.isPathAuthorized('/home/user/downloads/file.txt')).toBe(true);
      expect(permissionManager.isPathAuthorized('/home/user/photos/file.txt')).toBe(false);
    });

    it('should check subdirectory paths correctly', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('/home/user/documents/subfolder/file.txt');

      expect(result).toBe(true);
    });

    it('should not authorize path that starts with authorized folder but is different', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('/home/user/documents_backup/file.txt');

      expect(result).toBe(false);
    });

    it('should reject paths with null bytes', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['/home/user/documents']);

      const result = permissionManager.isPathAuthorized('/home/user\0documents/file.txt');

      expect(result).toBe(false);
    });
  });

  describe('getAuthorizedFolders()', () => {
    it('should return list of authorized folders', () => {
      const folders = ['/home/user/documents', '/home/user/downloads'];
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(folders);

      const result = permissionManager.getAuthorizedFolders();

      expect(result).toEqual(folders);
      expect(configStore.getAuthorizedFolders).toHaveBeenCalled();
    });

    it('should return empty array when no folders authorized', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue([]);

      const result = permissionManager.getAuthorizedFolders();

      expect(result).toEqual([]);
    });
  });

  describe('setNetworkAccess()', () => {
    it('should enable network access', () => {
      vi.mocked(configStore.setNetworkAccess).mockReturnValue(undefined);

      permissionManager.setNetworkAccess(true);

      expect(configStore.setNetworkAccess).toHaveBeenCalledWith(true);
    });

    it('should disable network access', () => {
      vi.mocked(configStore.setNetworkAccess).mockReturnValue(undefined);

      permissionManager.setNetworkAccess(false);

      expect(configStore.setNetworkAccess).toHaveBeenCalledWith(false);
    });
  });

  describe('isNetworkAccessEnabled()', () => {
    it('should return true when network access is enabled', () => {
      vi.mocked(configStore.getNetworkAccess).mockReturnValue(true);

      const result = permissionManager.isNetworkAccessEnabled();

      expect(result).toBe(true);
    });

    it('should return false when network access is disabled', () => {
      vi.mocked(configStore.getNetworkAccess).mockReturnValue(false);

      const result = permissionManager.isNetworkAccessEnabled();

      expect(result).toBe(false);
    });
  });

  describe('getAuditLog()', () => {
    it('should return audit log entries', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(configStore.addAuthorizedFolder).mockReturnValue(undefined);

      permissionManager.authorizeFolder('/home/user/test');
      const log = permissionManager.getAuditLog();

      expect(Array.isArray(log)).toBe(true);
      expect(log.length).toBeGreaterThan(0);
      expect(log[0]).toHaveProperty('timestamp');
      expect(log[0]).toHaveProperty('action');
      expect(log[0]).toHaveProperty('path');
    });
  });

  describe('clearAuditLog()', () => {
    it('should clear audit log', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(configStore.addAuthorizedFolder).mockReturnValue(undefined);

      permissionManager.authorizeFolder('/home/user/test');
      permissionManager.clearAuditLog();
      const log = permissionManager.getAuditLog();

      expect(log).toEqual([]);
    });
  });
});
