/**
 * Skills Management Handlers
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import { IPC_CHANNELS } from '../../constants/IpcChannels';
import {
  createSuccessResponse,
  IpcErrorCode,
  withIpcErrorHandling,
} from '../types/IpcResponse';
import { logs } from '../../utils/logger';

const skillsDir = path.join(os.homedir(), '.bingowork', 'skills');

interface SkillInfo {
  id: string;
  name: string;
  path: string;
  isBuiltin: boolean;
}

// Helper to get built-in skills
const getBuiltinSkills = (): SkillInfo[] => {
  try {
    let sourceDir = path.join(process.cwd(), 'resources', 'skills');
    if (app.isPackaged) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resourcesPath = (app as any).getPath('resources') || app.getAppPath();
      const possiblePath = path.join(resourcesPath, 'resources', 'skills');
      if (fsSync.existsSync(possiblePath)) sourceDir = possiblePath;
      else sourceDir = path.join(resourcesPath, 'skills');
    }

    if (!fsSync.existsSync(sourceDir)) return [];

    return fsSync.readdirSync(sourceDir).filter((entry) => {
      const skillPath = path.join(sourceDir, entry);
      const stat = fsSync.statSync(skillPath);
      return stat.isDirectory() && fsSync.existsSync(path.join(skillPath, 'SKILL.md'));
    }).map((entry) => ({
      id: entry,
      name: entry,
      path: path.join(sourceDir, entry, 'SKILL.md'),
      isBuiltin: true,
    }));
  } catch (error) {
    logs.ipc.error('[Skills] Failed to get built-in skills:', error);
    return [];
  }
};

// Check if a user skill is actually a built-in skill (by checking for .builtin marker)
const isBuiltinSkill = (skillName: string): boolean => {
  const skillPath = path.join(skillsDir, skillName);
  const builtinMarker = path.join(skillPath, '.builtin');
  return fsSync.existsSync(builtinMarker);
};

// Check if a built-in skill has been modified by the user
const isModifiedBuiltinSkill = (skillName: string): boolean => {
  const skillPath = path.join(skillsDir, skillName);
  const builtinMarker = path.join(skillPath, '.builtin');

  if (!fsSync.existsSync(builtinMarker)) return false;

  // Try to read the source directory for comparison
  let sourceDir = path.join(process.cwd(), 'resources', 'skills');
  if (app.isPackaged) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resourcesPath = (app as any).getPath('resources') || app.getAppPath();
    const possiblePath = path.join(resourcesPath, 'resources', 'skills');
    if (fsSync.existsSync(possiblePath)) sourceDir = possiblePath;
    else sourceDir = path.join(resourcesPath, 'skills');
  }

  const sourceSkillPath = path.join(sourceDir, skillName, 'SKILL.md');
  const userSkillPath = path.join(skillPath, 'SKILL.md');

  if (!fsSync.existsSync(sourceSkillPath) || !fsSync.existsSync(userSkillPath)) return false;

  // Compare file modification times
  const userStat = fsSync.statSync(userSkillPath);

  // If user skill is newer than builtin marker, it's been modified
  const markerStat = fsSync.statSync(builtinMarker);
  return userStat.mtimeMs > markerStat.mtimeMs;
};

export function registerSkillsHandlers(): void {
  // List all skills (built-in + user-defined)
  ipcMain.handle(IPC_CHANNELS.SKILLS.LIST, async () => {
    try {
      const builtIn = getBuiltinSkills();
      const userDefined: SkillInfo[] = [];
      const processedIds = new Set<string>();

      if (fsSync.existsSync(skillsDir)) {
        const entries = fsSync.readdirSync(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillPath = path.join(skillsDir, entry.name);
            // Check for SKILL.md (uppercase) or skill.md (lowercase) for backward compatibility
            const hasSkillFile = fsSync.existsSync(path.join(skillPath, 'SKILL.md')) ||
                                 fsSync.existsSync(path.join(skillPath, 'skill.md'));
            if (hasSkillFile) {
              const isBuiltin = isBuiltinSkill(entry.name);
              const isModified = isBuiltin && isModifiedBuiltinSkill(entry.name);

              userDefined.push({
                id: entry.name,
                name: entry.name,
                path: skillPath,
                isBuiltin: !isModified, // Mark as user skill if modified
              });
              processedIds.add(entry.name);
            }
          }
        }
      }

      // Merge skills, with user-defined skills taking precedence over built-in ones
      const skillMap = new Map<string, SkillInfo>();

      // Add built-in skills first (only if not already in user directory)
      for (const skill of builtIn) {
        if (!processedIds.has(skill.id)) {
          skillMap.set(skill.id, skill);
        }
      }

      // User skills override built-in skills with the same ID
      for (const skill of userDefined) {
        skillMap.set(skill.id, skill);
      }

      return Array.from(skillMap.values());
    } catch (error) {
      logs.ipc.error('[Skills] Failed to list skills:', error);
      return [];
    }
  });

  // Get skill content
  ipcMain.handle(IPC_CHANNELS.SKILLS.GET, async (_event, skillName: string) => {
    return withIpcErrorHandling(async () => {
      // Try built-in skills first
      let sourceDir = path.join(process.cwd(), 'resources', 'skills');
      if (app.isPackaged) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resourcesPath = (app as any).getPath('resources') || app.getAppPath();
        const possiblePath = path.join(resourcesPath, 'resources', 'skills');
        if (fsSync.existsSync(possiblePath)) sourceDir = possiblePath;
        else sourceDir = path.join(resourcesPath, 'skills');
      }

      // Try uppercase SKILL.md first (new standard), then lowercase skill.md (backward compatibility)
      const builtInPathUpper = path.join(sourceDir, skillName, 'SKILL.md');
      const builtInPathLower = path.join(sourceDir, skillName, 'skill.md');
      const userPathUpper = path.join(skillsDir, skillName, 'SKILL.md');
      const userPathLower = path.join(skillsDir, skillName, 'skill.md');

      let skillContent = '';
      let isBuiltIn = false;
      let skillPath = '';

      if (fsSync.existsSync(builtInPathUpper)) {
        skillContent = await fs.readFile(builtInPathUpper, 'utf-8');
        isBuiltIn = true;
        skillPath = builtInPathUpper;
      } else if (fsSync.existsSync(builtInPathLower)) {
        skillContent = await fs.readFile(builtInPathLower, 'utf-8');
        isBuiltIn = true;
        skillPath = builtInPathLower;
      } else if (fsSync.existsSync(userPathUpper)) {
        skillContent = await fs.readFile(userPathUpper, 'utf-8');
        isBuiltIn = false;
        skillPath = userPathUpper;
      } else if (fsSync.existsSync(userPathLower)) {
        skillContent = await fs.readFile(userPathLower, 'utf-8');
        isBuiltIn = false;
        skillPath = userPathLower;
      } else {
        throw new Error(`Skill "${skillName}" not found`);
      }

      return createSuccessResponse({
        name: skillName,
        content: skillContent,
        isBuiltIn,
        path: skillPath,
      });
    }, IpcErrorCode.SKILL_NOT_FOUND)();
  });

  // Save skill
  ipcMain.handle(
    IPC_CHANNELS.SKILLS.SAVE,
    async (_event, skillName: string, content: string) => {
      return withIpcErrorHandling(async () => {
        const skillPath = path.join(skillsDir, skillName);
        if (!fsSync.existsSync(skillPath)) {
          fsSync.mkdirSync(skillPath, { recursive: true });
        }

        // Save with uppercase SKILL.md (new standard)
        await fs.writeFile(path.join(skillPath, 'SKILL.md'), content, 'utf-8');
        return createSuccessResponse();
      }, IpcErrorCode.SKILL_SAVE_ERROR)();
    }
  );

  // Delete skill
  ipcMain.handle(IPC_CHANNELS.SKILLS.DELETE, async (_event, skillName: string) => {
    return withIpcErrorHandling(async () => {
      const skillPath = path.join(skillsDir, skillName);
      if (fsSync.existsSync(skillPath)) {
        await fs.rm(skillPath, { recursive: true, force: true });
        return createSuccessResponse();
      }
      throw new Error(`Skill "${skillName}" not found`);
    }, IpcErrorCode.SKILL_NOT_FOUND)();
  });
}
