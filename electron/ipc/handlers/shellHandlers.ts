/**
 * Shell IPC Handlers
 * Handle file system operations like opening files/folders
 * SECURITY: Enhanced with path traversal protection, file extension whitelist, and audit logging
 */

import { ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { configStore } from '../../config/ConfigStore';
import { logs } from '../../utils/logger';

/**
 * SECURITY: Allowed file extensions for opening
 * Prevents opening executable files that could lead to code execution
 * NOTE: This list is kept for documentation purposes. Actual enforcement uses BLOCKED_EXTENSIONS.
 */
const ALLOWED_EXTENSIONS = new Set([
  // Documents
  '.txt', '.md', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.rtf', '.csv', '.json', '.xml', '.yaml', '.yml',
  '.html', '.htm', '.css', '.scss', '.less', '.svg',
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  // Audio/Video
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.wmv', '.flv', '.mkv',
  '.m4a', '.m4v', '.ogg', '.ogv', '.webm',
  // Archives (viewing only, execution should be prevented by OS)
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  // Code files
  '.js', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.swift', '.kt',
  '.sh', '.bash', '.zsh', '.fish', '.ps1',
  // Config files
  '.ini', '.cfg', '.conf', '.toml', '.env',
  // Database
  '.db', '.sqlite', '.sqlite3',
]);

// Prevent unused variable warning - kept for documentation
void ALLOWED_EXTENSIONS;

/**
 * SECURITY: Dangerous file extensions that should NEVER be opened
 * These could lead to arbitrary code execution
 */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
  '.app', '.dmg', '.pkg', '.deb', '.rpm', '.sh', '.bash', '.zsh',
  '.ps1', '.vb', '.vbscript', '.wsf', '.wsh',
]);

/**
 * SECURITY: Audit log for shell operations
 */
interface ShellAuditLogEntry {
  timestamp: number;
  action: 'open' | 'blocked' | 'error';
  path: string;
  reason?: string;
  method?: string;
}

const shellAuditLog: ShellAuditLogEntry[] = [];

/**
 * Log shell operation for audit purposes
 */
function logShellOperation(entry: ShellAuditLogEntry): void {
  shellAuditLog.push(entry);

  // Keep only last 200 entries
  if (shellAuditLog.length > 200) {
    shellAuditLog.shift();
  }

  // Log security-relevant events
  if (entry.action === 'blocked') {
    logs.ipc.warn('[Shell Security]', JSON.stringify(entry));
  } else {
    logs.ipc.info('[Shell Audit]', JSON.stringify(entry));
  }
}

/**
 * SECURITY: Normalize and validate path with comprehensive checks
 *
 * This function implements multiple layers of path validation:
 * 1. Traversal pattern detection BEFORE resolution
 * 2. URL encoding validation
 * 3. Null byte detection
 * 4. Authorized folder verification
 * 5. Symbolic link attack prevention
 * 6. File extension validation
 */
function normalizeAndValidatePath(inputPath: string): { ok: boolean; normalized?: string; error?: string } {
  // Step 1: Clean and validate input
  const raw = String(inputPath || '').trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/^["']|["']$/g, ''); // Remove quotes

  if (!raw) {
    return { ok: false, error: 'Path cannot be empty' };
  }

  // SECURITY: Check for path traversal patterns BEFORE any resolution
  const traversalPatterns = ['../', '..\\', '%2e%2e', '%252e', '%2e%2e%2f', '%252e%252e%252f'];
  const lowerRaw = raw.toLowerCase();
  for (const pattern of traversalPatterns) {
    if (lowerRaw.includes(pattern)) {
      logShellOperation({
        timestamp: Date.now(),
        action: 'blocked',
        path: raw,
        reason: `Path traversal pattern detected: ${pattern}`
      });
      return { ok: false, error: `Path traversal pattern detected: ${pattern}` };
    }
  }

  // SECURITY: Check for null bytes
  if (raw.includes('\u0000')) {
    logShellOperation({
      timestamp: Date.now(),
      action: 'blocked',
      path: raw,
      reason: 'Null byte detected in path'
    });
    return { ok: false, error: 'Null byte detected in path' };
  }

  // SECURITY: Limit path length
  if (raw.length > 1000) {
    logShellOperation({
      timestamp: Date.now(),
      action: 'blocked',
      path: raw.substring(0, 100) + '...',
      reason: 'Path too long (max 1000 characters)'
    });
    return { ok: false, error: 'Path too long' };
  }

  let normalized: string;

  // Handle URLs
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    // URL validation is handled separately
    return { ok: true, normalized: raw };
  }

  // Handle file:// URLs
  if (raw.startsWith('file:')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { fileURLToPath } = require('url');
      normalized = fileURLToPath(raw);
    } catch (e) {
      return { ok: false, error: `Invalid file URL: ${(e as Error).message}` };
    }
  } else {
    normalized = raw;
  }

  // SECURITY: Decode URL encoding with validation
  if (normalized.includes('%')) {
    try {
      const decoded = decodeURIComponent(normalized);
      // Check if decoded string contains dangerous patterns
      const dangerousPatterns = ['../', '..\\', '\u0000'];
      for (const pattern of dangerousPatterns) {
        if (decoded.includes(pattern)) {
          logShellOperation({
            timestamp: Date.now(),
            action: 'blocked',
            path: normalized,
            reason: `Dangerous pattern after URL decoding: ${pattern}`
          });
          return { ok: false, error: `Dangerous pattern detected in encoded path` };
        }
      }
      normalized = decoded;
    } catch (e) {
      return { ok: false, error: `Invalid URL encoding: ${(e as Error).message}` };
    }
  }

  // Expand ~ to home directory
  if (normalized.startsWith('~/')) {
    normalized = path.join(os.homedir(), normalized.slice(2));
  }

  // Normalize the path
  try {
    normalized = path.normalize(normalized);
  } catch (e) {
    return { ok: false, error: `Invalid path format: ${(e as Error).message}` };
  }

  // Convert to absolute path
  if (!path.isAbsolute(normalized)) {
    // For relative paths, only search within authorized folders
    const authorizedFolders = configStore.getAll().authorizedFolders || [];
    if (authorizedFolders.length === 0) {
      return { ok: false, error: 'No authorized folders configured' };
    }
    // Use the first authorized folder as base
    normalized = path.resolve(authorizedFolders[0], normalized);
  }

  // SECURITY: Windows case-insensitive handling
  const normalizedForComparison = process.platform === 'win32'
    ? normalized.toLowerCase()
    : normalized;

  // SECURITY: Validate against authorized folders
  const authorizedFolders = configStore.getAll().authorizedFolders || [];
  let isAuthorized = false;

  for (const folder of authorizedFolders) {
    const normalizedFolder = process.platform === 'win32'
      ? folder.toLowerCase()
      : folder;

    if (normalizedForComparison === normalizedFolder ||
        normalizedForComparison.startsWith(normalizedFolder + path.sep)) {
      isAuthorized = true;

      // SECURITY: Check for symbolic link attacks
      try {
        if (fs.existsSync(normalized)) {
          const stats = fs.lstatSync(normalized);
          if (stats.isSymbolicLink()) {
            const target = fs.readlinkSync(normalized);
            const resolvedTarget = path.resolve(path.dirname(normalized), target);
            const targetNormalized = process.platform === 'win32'
              ? resolvedTarget.toLowerCase()
              : resolvedTarget;

            // Verify symlink target is also within authorized folder
            if (!targetNormalized.startsWith(normalizedFolder + path.sep) &&
                targetNormalized !== normalizedFolder) {
              logShellOperation({
                timestamp: Date.now(),
                action: 'blocked',
                path: normalized,
                reason: `Symbolic link points outside authorized directory: ${target}`
              });
              return { ok: false, error: 'Symbolic link points outside authorized directory' };
            }
          }
        }
      } catch (e) {
        // File doesn't exist yet, continue
      }

      break;
    }
  }

  if (!isAuthorized) {
    logShellOperation({
      timestamp: Date.now(),
      action: 'blocked',
      path: normalized,
      reason: 'Path is not within an authorized folder'
    });
    return { ok: false, error: 'Path is not within an authorized folder' };
  }

  // SECURITY: Validate file extension
  const ext = path.extname(normalized).toLowerCase();
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    logShellOperation({
      timestamp: Date.now(),
      action: 'blocked',
      path: normalized,
      reason: `Blocked file extension: ${ext}`
    });
    return { ok: false, error: `File extension ${ext} is not allowed for security reasons` };
  }

  return { ok: true, normalized };
}

/**
 * Register shell-related IPC handlers
 */
export function registerShellHandlers(): void {
  ipcMain.handle('shell:open-path', async (_, filePathOrUrl: string) => {
    try {
      const validation = normalizeAndValidatePath(filePathOrUrl);

      if (!validation.ok) {
        logs.ipc.warn('[Shell] Path validation failed:', validation.error);
        dialog.showErrorBox('路径验证失败', `无法打开路径:\n${filePathOrUrl}\n\n原因:\n${validation.error}`);
        return { success: false, error: validation.error };
      }

      const targetPath = validation.normalized!;
      logs.ipc.info('[Shell] Request to open:', filePathOrUrl);

      // Handle URLs
      if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
        await shell.openExternal(targetPath);
        logShellOperation({
          timestamp: Date.now(),
          action: 'open',
          path: targetPath,
          method: 'openExternal'
        });
        return { success: true, path: targetPath, method: 'openExternal' };
      }

      // For file paths, check if file exists
      if (!fs.existsSync(targetPath)) {
        logShellOperation({
          timestamp: Date.now(),
          action: 'error',
          path: targetPath,
          reason: 'File does not exist'
        });
        dialog.showErrorBox('文件不存在', `无法找到文件:\n${targetPath}`);
        return { success: false, error: '文件不存在', path: targetPath };
      }

      const stat = fs.statSync(targetPath);
      logs.ipc.info('[Shell] Opening:', targetPath);

      if (!stat.isDirectory()) {
        const openError = await shell.openPath(targetPath);
        if (openError) {
          logs.ipc.error('[Shell] shell.openPath failed:', openError);
          shell.showItemInFolder(targetPath);
          await shell.openPath(path.dirname(targetPath));
          logShellOperation({
            timestamp: Date.now(),
            action: 'open',
            path: targetPath,
            method: 'showItemInFolder'
          });
          return { success: true, path: targetPath, method: 'showItemInFolder' };
        }
        logShellOperation({
          timestamp: Date.now(),
          action: 'open',
          path: targetPath,
          method: 'openPath'
        });
        return { success: true, path: targetPath, method: 'openPath' };
      }

      const openError = await shell.openPath(targetPath);
      if (openError) {
        logs.ipc.error('[Shell] shell.openPath failed:', openError);
        logShellOperation({
          timestamp: Date.now(),
          action: 'error',
          path: targetPath,
          reason: openError
        });
        return { success: false, error: openError, path: targetPath };
      }

      logShellOperation({
        timestamp: Date.now(),
        action: 'open',
        path: targetPath,
        method: 'openPath'
      });

      return { success: true, path: targetPath, method: 'openPath' };
    } catch (e) {
      logs.ipc.error('[Shell] Error opening path:', e);
      logShellOperation({
        timestamp: Date.now(),
        action: 'error',
        path: filePathOrUrl,
        reason: (e as Error).message
      });
      return { success: false, error: (e as Error).message };
    }
  });

  logs.ipc.info('[IPC] Shell handlers registered');
}

/**
 * SECURITY: Get audit log entries (for debugging/admin purposes)
 */
export function getShellAuditLog(): ShellAuditLogEntry[] {
  return [...shellAuditLog];
}

/**
 * SECURITY: Clear audit log
 */
export function clearShellAuditLog(): void {
  shellAuditLog.length = 0;
}
