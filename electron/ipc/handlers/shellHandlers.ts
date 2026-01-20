/**
 * Shell IPC Handlers
 * Handle file system operations like opening files/folders
 */

import { ipcMain, dialog, shell, app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { configStore } from '../../config/ConfigStore';

/**
 * Register shell-related IPC handlers
 */
export function registerShellHandlers(): void {
  ipcMain.handle('shell:open-path', async (_, filePathOrUrl: string) => {
    try {
      const cleanedInput = String(filePathOrUrl || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .replace(/^["']|["']$/g, '');

      let targetPath = cleanedInput;
      console.log('[Shell] Request to open:', filePathOrUrl);

      if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
        await shell.openExternal(targetPath);
        return { success: true, path: targetPath, method: 'openExternal' };
      }

      if (targetPath.startsWith('file:')) {
        try {
          const { fileURLToPath } = require('url');
          targetPath = fileURLToPath(targetPath);
        } catch (e) {
          console.error('[Shell] Failed to parse file URL:', e);
        }
      }

      if (targetPath.includes('%')) {
        try {
          targetPath = decodeURIComponent(targetPath);
        } catch (e) {
          // ignore
        }
      }

      if (targetPath.startsWith('~/')) {
        targetPath = path.join(os.homedir(), targetPath.slice(2));
      }

      const candidates: string[] = [];
      if (path.isAbsolute(targetPath)) {
        candidates.push(targetPath);
      } else {
        const folders = configStore.getAll().authorizedFolders || [];
        for (const folder of folders) {
          candidates.push(path.resolve(folder, targetPath));
        }
        candidates.push(path.resolve(process.cwd(), targetPath));
        candidates.push(path.resolve(app.getPath('documents'), targetPath));
        candidates.push(path.resolve(os.homedir(), targetPath));
      }

      const normalizeName = (name: string) =>
        name
          .toLowerCase()
          .replace(/\.[^.]+$/, '')
          .replace(/[\s\-_—–.·（）()【】[\]{}'"""''，,，。:：;；!?！？/\\]/g, '');

      let existing = candidates.find(p => fs.existsSync(p));
      if (!existing && path.isAbsolute(targetPath)) {
        const dir = path.dirname(targetPath);
        try {
          if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            const reqBase = path.basename(targetPath);
            const reqExt = path.extname(reqBase).toLowerCase();
            const reqNorm = normalizeName(reqBase);
            const files = fs.readdirSync(dir);
            const matched = files.find(f => {
              if (reqExt && path.extname(f).toLowerCase() !== reqExt) return false;
              return normalizeName(f) === reqNorm;
            });
            if (matched) existing = path.join(dir, matched);
          }
        } catch (e) {
          console.error('[Shell] Fuzzy match failed:', e);
        }
      }

      if (!existing) {
        const preview = candidates.slice(0, 8).join('\n');
        console.error('[Shell] File not found. Candidates tried:\n', preview);
        dialog.showErrorBox('文件不存在', `无法找到文件:\n${filePathOrUrl}\n\n尝试过的路径:\n${preview}`);
        return { success: false, error: '文件不存在', candidates: preview };
      }

      const stat = fs.statSync(existing);
      console.log('[Shell] Opening:', existing);
      if (!stat.isDirectory()) {
        const openError = await shell.openPath(existing);
        if (openError) {
          console.error('[Shell] shell.openPath failed:', openError);
          shell.showItemInFolder(existing);
          await shell.openPath(path.dirname(existing));
          return { success: true, path: existing, method: 'showItemInFolder' };
        }
        return { success: true, path: existing, method: 'openPath' };
      }

      const openError = await shell.openPath(existing);
      if (openError) {
        console.error('[Shell] shell.openPath failed:', openError);
        return { success: false, error: openError, path: existing };
      }

      return { success: true, path: existing, method: 'openPath' };
    } catch (e) {
      console.error('[Shell] Error opening path:', e);
      return { success: false, error: (e as Error).message };
    }
  });

  console.log('[IPC] Shell handlers registered');
}
