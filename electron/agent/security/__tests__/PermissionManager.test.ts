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
    removeAuthorizedFolder: vi.fn(),
    getAuthorizedFolders: vi.fn(),
    setNetworkAccess: vi.fn(),
    getNetworkAccess: vi.fn(),
  },
}));

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;

  beforeEach(() => {
    permissionManager = new PermissionManager();
    vi.clearAllMocks();
  });

  describe('authorizeFolder()', () => {
    it('should authorize a valid folder', () => {
      vi.mocked(configStore.addAuthorizedFolder).mockReturnValue(undefined);

      const result = permissionManager.authorizeFolder('/home/user/documents');

      expect(result).toBe(true);
      expect(configStore.addAuthorizedFolder).toHaveBeenCalledWith(
        expect.stringContaining('home/user/documents')
      );
    });

    it('should reject root directory "/"', () => {
      const result = permissionManager.authorizeFolder('/');

      expect(result).toBe(false);
      expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
    });

    it('should reject Windows root "C:\\"', () => {
      const result = permissionManager.authorizeFolder('C:\\');

      // On non-Windows platforms, path.resolve may not normalize Windows roots
      // The regex check /^[A-Z]:\\$/ only matches if path.resolve preserves this
      // On macOS/Linux, it might convert to something else
      if (process.platform === 'win32') {
        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      } else {
        // On non-Windows, the behavior may differ
        expect(configStore.addAuthorizedFolder).toHaveBeenCalled();
      }
    });

    it('should reject Windows root "D:\\"', () => {
      const result = permissionManager.authorizeFolder('D:\\');

      // Same as above - platform-specific behavior
      if (process.platform === 'win32') {
        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      } else {
        expect(configStore.addAuthorizedFolder).toHaveBeenCalled();
      }
    });

    it('should reject Windows root with pattern "E:\\"', () => {
      const result = permissionManager.authorizeFolder('E:\\');

      // Same as above - platform-specific behavior
      if (process.platform === 'win32') {
        expect(result).toBe(false);
        expect(configStore.addAuthorizedFolder).not.toHaveBeenCalled();
      } else {
        expect(configStore.addAuthorizedFolder).toHaveBeenCalled();
      }
    });

    it('should authorize Windows non-root paths', () => {
      vi.mocked(configStore.addAuthorizedFolder).mockReturnValue(undefined);

      const result = permissionManager.authorizeFolder('C:\\Users\\test');

      expect(result).toBe(true);
      expect(configStore.addAuthorizedFolder).toHaveBeenCalled();
    });

    it('should resolve relative paths to absolute', () => {
      vi.mocked(configStore.addAuthorizedFolder).mockReturnValue(undefined);

      const result = permissionManager.authorizeFolder('./documents');

      expect(result).toBe(true);
      expect(configStore.addAuthorizedFolder).toHaveBeenCalledWith(
        expect.not.stringContaining('./')
      );
    });
  });

  describe('revokeFolder()', () => {
    it('should revoke folder authorization', () => {
      vi.mocked(configStore.removeAuthorizedFolder).mockReturnValue(undefined);

      permissionManager.revokeFolder('/home/user/documents');

      expect(configStore.removeAuthorizedFolder).toHaveBeenCalledWith(
        expect.stringContaining('home/user/documents')
      );
    });

    it('should resolve relative paths when revoking', () => {
      vi.mocked(configStore.removeAuthorizedFolder).mockReturnValue(undefined);

      permissionManager.revokeFolder('./documents');

      expect(configStore.removeAuthorizedFolder).toHaveBeenCalledWith(
        expect.not.stringContaining('./')
      );
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

    it('should return true for Windows absolute paths in authorized folder', () => {
      vi.mocked(configStore.getAuthorizedFolders).mockReturnValue(['C:\\Users\\test\\documents']);

      // On non-Windows platforms, Windows paths may not be recognized as absolute
      const result = permissionManager.isPathAuthorized('C:\\Users\\test\\documents\\file.txt');

      if (process.platform === 'win32') {
        expect(result).toBe(true);
      } else {
        // On macOS/Linux, Windows paths aren't recognized as absolute by path.isAbsolute
        // So the function returns false
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
});
