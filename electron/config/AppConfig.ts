/**
 * Application Configuration
 * Centralizes app-level configuration and paths
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fsSync from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

/**
 * Set up development environment paths
 */
export function setupDevEnvironment(): string | null {
  if (VITE_DEV_SERVER_URL) {
    const devUserData = path.join(process.env.APP_ROOT!, 'local-data', 'electron-userdata');
    if (!fsSync.existsSync(devUserData)) {
      fsSync.mkdirSync(devUserData, { recursive: true });
    }
    return devUserData;
  }
  return null;
}

/**
 * Get the preload script path
 */
export function getPreloadPath(): string {
  return path.join(__dirname, 'preload.mjs');
}

/**
 * Get icon path
 */
export function getIconPath(): string {
  const publicPath = process.env.VITE_PUBLIC || '';
  return path.join(publicPath, 'icon.png');
}
