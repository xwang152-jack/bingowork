import path from 'path';
import fs from 'fs';
import { configStore } from '../../config/ConfigStore';

/**
 * SECURITY: Sensitive system directories that should never be authorized
 * Covers Windows, macOS, and Linux specific paths
 */
const SENSITIVE_SYSTEM_DIRECTORIES = new Set([
  // Unix/Linux root and system directories
  '/',
  '/root',
  '/boot',
  '/sys',
  '/proc',
  '/dev',
  '/etc',
  '/bin',
  '/sbin',
  '/usr/bin',
  '/usr/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/var/root',
  '/var/run',
  '/var/log',

  // macOS system directories
  '/System',
  '/System/Library',
  '/Library',
  '/Library/Application Support',

  // Windows system directories
  'C:\\',
  'C:\\Windows',
  'C:\\Windows\\System32',
  'C:\\Windows\\System32\\config',
  'C:\\Windows\\System32\\drivers\\etc',
  'C:\\ProgramData',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\Program Files (x64)',
]);


/**
 * Audit log entry for authorization changes
 */
interface AuthorizationAuditLogEntry {
  timestamp: number;
  action: 'authorize' | 'revoke' | 'blocked';
  path: string;
  reason?: string;
  details?: Record<string, unknown>;
}

const auditLog: AuthorizationAuditLogEntry[] = [];

/**
 * Log authorization change for audit purposes
 */
function logAuthorizationChange(entry: AuthorizationAuditLogEntry): void {
  auditLog.push(entry);

  // Keep only last 200 entries
  if (auditLog.length > 200) {
    auditLog.shift();
  }

  // Log security-relevant events
  if (entry.action === 'blocked') {
    console.warn('[Permission Security]', JSON.stringify(entry));
  } else {
    console.log('[Permission Audit]', JSON.stringify(entry));
  }
}

/**
 * SECURITY: Check if a path is a root directory
 */
function isRootDirectory(normalizedPath: string): boolean {
  const parsed = path.parse(normalizedPath);

  // Check if path is the root of its drive
  return normalizedPath === parsed.root;
}

/**
 * SECURITY: Check if path is a sensitive system directory
 */
function isSensitiveSystemDirectory(normalizedPath: string): { isSensitive: boolean; reason: string } {
  const normalizedLower = process.platform === 'win32'
    ? normalizedPath.toLowerCase()
    : normalizedPath;

  for (const sensitiveDir of SENSITIVE_SYSTEM_DIRECTORIES) {
    const sensitiveLower = process.platform === 'win32'
      ? sensitiveDir.toLowerCase()
      : sensitiveDir;

    // Check if path is exactly the sensitive directory
    if (normalizedLower === sensitiveLower) {
      return { isSensitive: true, reason: 'Matches sensitive system directory' };
    }

    // Check if path is within a sensitive directory
    if (normalizedLower.startsWith(sensitiveLower + path.sep)) {
      // Exception: allow certain subdirectories that are safe
      const safeSubdirs = ['/usr/local', '/Library/Preferences'];

      let isSafeSubdir = false;
      for (const safeDir of safeSubdirs) {
        const safeDirLower = process.platform === 'win32'
          ? safeDir.toLowerCase()
          : safeDir;

        if (normalizedLower === safeDirLower ||
            normalizedLower.startsWith(safeDirLower + path.sep)) {
          isSafeSubdir = true;
          break;
        }
      }

      if (!isSafeSubdir) {
        return { isSensitive: true, reason: `Within sensitive directory: ${sensitiveDir}` };
      }
    }
  }

  return { isSensitive: false, reason: '' };
}

export class PermissionManager {

  constructor() {
    // No initialization needed
  }

  /**
   * SECURITY: Enhanced folder authorization with comprehensive security checks
   */
  authorizeFolder(folderPath: string): boolean {
    // Clean and normalize input
    const raw = String(folderPath || '').trim();
    if (!raw) {
      console.warn('[Permission] Empty path provided for authorization');
      return false;
    }

    // SECURITY: Check for null bytes
    if (raw.includes('\u0000')) {
      logAuthorizationChange({
        timestamp: Date.now(),
        action: 'blocked',
        path: raw,
        reason: 'Null byte detected in path'
      });
      console.warn('[Permission] Null byte detected in path, denied.');
      return false;
    }

    // SECURITY: Limit path length
    if (raw.length > 1000) {
      logAuthorizationChange({
        timestamp: Date.now(),
        action: 'blocked',
        path: raw,
        reason: 'Path too long'
      });
      console.warn('[Permission] Path too long, denied.');
      return false;
    }

    // Normalize the path
    let normalized: string;
    try {
      normalized = path.resolve(raw);
    } catch (e) {
      logAuthorizationChange({
        timestamp: Date.now(),
        action: 'blocked',
        path: raw,
        reason: `Invalid path: ${(e as Error).message}`
      });
      console.warn('[Permission] Invalid path format, denied:', raw);
      return false;
    }

    // SECURITY: Check if path is a root directory
    if (isRootDirectory(normalized)) {
      logAuthorizationChange({
        timestamp: Date.now(),
        action: 'blocked',
        path: normalized,
        reason: 'Root directory'
      });

      console.warn(`[Permission] Attempted to authorize root directory: ${normalized}, denied.`);
      return false;
    }

    // SECURITY: Check for Windows drive letter root (C:\, D:\, etc.)
    if (process.platform === 'win32') {
      const parsed = path.parse(normalized);
      if (normalized === parsed.root) {
        logAuthorizationChange({
          timestamp: Date.now(),
          action: 'blocked',
          path: normalized,
          reason: 'Windows drive root'
        });

        console.warn(`[Permission] Attempted to authorize Windows drive root: ${normalized}, denied.`);
        return false;
      }
    }

    // SECURITY: Check if path is a sensitive system directory
    const sensitiveCheck = isSensitiveSystemDirectory(normalized);
    if (sensitiveCheck.isSensitive) {
      logAuthorizationChange({
        timestamp: Date.now(),
        action: 'blocked',
        path: normalized,
        reason: sensitiveCheck.reason
      });

      console.warn(`[Permission] Attempted to authorize sensitive directory: ${normalized}, denied.`);
      return false;
    }

    // SECURITY: Check if path exists
    try {
      if (!fs.existsSync(normalized)) {
        logAuthorizationChange({
          timestamp: Date.now(),
          action: 'blocked',
          path: normalized,
          reason: 'Path does not exist'
        });

        console.warn(`[Permission] Attempted to authorize non-existent path: ${normalized}, denied.`);
        return false;
      }

      const stats = fs.statSync(normalized);
      if (!stats.isDirectory()) {
        logAuthorizationChange({
          timestamp: Date.now(),
          action: 'blocked',
          path: normalized,
          reason: 'Path is not a directory'
        });

        console.warn(`[Permission] Attempted to authorize file (not directory): ${normalized}, denied.`);
        return false;
      }
    } catch (e) {
      logAuthorizationChange({
        timestamp: Date.now(),
        action: 'blocked',
        path: normalized,
        reason: `Cannot access path: ${(e as Error).message}`
      });

      console.warn(`[Permission] Cannot access path: ${normalized}, denied.`);
      return false;
    }

    // All checks passed - authorize the folder
    configStore.addAuthorizedFolder(normalized);

    logAuthorizationChange({
      timestamp: Date.now(),
      action: 'authorize',
      path: normalized
    });

    console.log(`[Permission] Authorized folder: ${normalized}`);
    return true;
  }

  /**
   * SECURITY: Enhanced path authorization check with Windows case-insensitive handling
   */
  isPathAuthorized(filePath: string): boolean {
    const raw = String(filePath || '').trim().replace(/^["']|["']$/g, '');

    // SECURITY: Basic validation
    if (!raw) return false;

    // SECURITY: Check for null bytes
    if (raw.includes('\u0000')) {
      console.warn('[Permission] Null byte detected in path check');
      return false;
    }

    // SECURITY: For Windows, ensure absolute paths
    if (process.platform === 'win32') {
      const isWindowsAbs = /^[A-Za-z]:[\\/]/.test(raw);
      if (!isWindowsAbs && !path.isAbsolute(raw)) return false;
    } else {
      if (!path.isAbsolute(raw)) return false;
    }

    // Normalize the path
    let normalized: string;
    try {
      normalized = path.resolve(raw);
    } catch (e) {
      console.warn('[Permission] Failed to resolve path:', raw);
      return false;
    }

    const authorizedFolders = configStore.getAuthorizedFolders();

    // SECURITY: Check each authorized folder with platform-specific handling
    for (const folder of authorizedFolders) {
      let resolvedFolder: string;
      try {
        resolvedFolder = path.resolve(folder);
      } catch (e) {
        console.warn('[Permission] Failed to resolve authorized folder:', folder);
        continue;
      }

      // SECURITY: Windows case-insensitive comparison
      const normalizedPath = process.platform === 'win32'
        ? normalized.toLowerCase()
        : normalized;

      const normalizedFolder = process.platform === 'win32'
        ? resolvedFolder.toLowerCase()
        : resolvedFolder;

      // Check if path is exactly the authorized folder or within it
      if (normalizedPath === normalizedFolder ||
          normalizedPath.startsWith(normalizedFolder + path.sep)) {
        return true;
      }
    }

    return false;
  }

  getAuthorizedFolders(): string[] {
    return configStore.getAuthorizedFolders();
  }

  setNetworkAccess(enabled: boolean): void {
    configStore.setNetworkAccess(enabled);
  }

  isNetworkAccessEnabled(): boolean {
    return configStore.getNetworkAccess();
  }

  /**
   * SECURITY: Get audit log entries (for debugging/admin purposes)
   */
  getAuditLog(): AuthorizationAuditLogEntry[] {
    return [...auditLog];
  }

  /**
   * SECURITY: Clear audit log
   */
  clearAuditLog(): void {
    auditLog.length = 0;
  }
}

export const permissionManager = new PermissionManager();
