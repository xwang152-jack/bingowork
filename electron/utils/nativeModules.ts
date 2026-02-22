/**
 * Native Module Loader
 * Handles loading of native modules for Electron
 */

import path from 'node:path';
import { app } from 'electron';

/**
 * Get the correct path for native modules that are unpacked from asar
 */
export function getNativeModulePath(moduleName: string): string {
  try {
    // In production, native modules are unpacked to app.asar.unpacked
    if (app.isPackaged) {
      const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', moduleName);
      return unpackedPath;
    }
    // In development, use the normal node_modules path
    return moduleName;
  } catch (error) {
    console.warn(`[NativeModules] Failed to resolve path for ${moduleName}:`, error);
    return moduleName;
  }
}

/**
 * Import better-sqlite3 with correct path handling
 */
export async function importBetterSqlite3() {
  try {
    const modulePath = getNativeModulePath('better-sqlite3');
    const Database = (await import(modulePath)).default;
    return Database;
  } catch (error) {
    console.error('[NativeModules] Failed to import better-sqlite3:', error);
    throw error;
  }
}

/**
 * Import keytar with correct path handling
 */
export async function importKeytar() {
  try {
    const modulePath = getNativeModulePath('keytar');
    const keytar = await import(modulePath);
    return keytar;
  } catch (error) {
    console.error('[NativeModules] Failed to import keytar:', error);
    throw error;
  }
}
