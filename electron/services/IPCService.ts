
import type { AppConfigDTO, Session, SkillInfo, ToolPermission } from '../types/ipc';

class IPCService {
    async sendMessage(content: string, images: string[] = []): Promise<void> {
        await window.ipcRenderer.invoke('agent:send-message', { content, images });
    }

    async abortAgent(): Promise<void> {
        await window.ipcRenderer.invoke('agent:abort');
    }

    async deleteMessage(id: string): Promise<void> {
        await window.ipcRenderer.invoke('agent:delete-message', id);
    }

    async regenerateMessage(id: string): Promise<void> {
        await window.ipcRenderer.invoke('agent:regenerate', id);
    }

    async setWorkMode(mode: 'chat' | 'code' | 'cowork'): Promise<void> {
        await window.ipcRenderer.invoke('agent:set-work-mode', mode);
    }

    // Config
    async getConfig(): Promise<AppConfigDTO> {
        return (await window.ipcRenderer.invoke('config:get-all')) as AppConfigDTO;
    }

    async updateConfig(updates: Partial<AppConfigDTO>): Promise<void> {
        const current = await this.getConfig();
        await window.ipcRenderer.invoke('config:set-all', { ...current, ...updates });
    }

    // Session Management
    async getSessions(): Promise<Session[]> {
        return (await window.ipcRenderer.invoke('session:list')) as Session[];
    }

    async listSessions(): Promise<Session[]> {
        return await this.getSessions();
    }

    async createSession(): Promise<{ success: boolean; sessionId: string }> {
        return (await window.ipcRenderer.invoke('session:create')) as { success: boolean; sessionId: string };
    }

    async createNewSession(): Promise<{ success: boolean; sessionId: string }> {
        return await this.createSession();
    }

    async deleteSession(id: string): Promise<void> {
        await window.ipcRenderer.invoke('session:delete', id);
    }

    async renameSession(id: string, title: string): Promise<void> {
        await window.ipcRenderer.invoke('session:rename', id, title);
    }

    async loadSession(id: string): Promise<void> {
        await window.ipcRenderer.invoke('session:load', id);
    }

    async getCurrentSession(): Promise<Session | null> {
        return (await window.ipcRenderer.invoke('session:current')) as Session | null;
    }

    // Config & Permissions
    async getAuthorizedFolders(): Promise<string[]> {
        return (await window.ipcRenderer.invoke('agent:get-authorized-folders')) as string[];
    }

    async setAuthorizedFolders(folders: string[]): Promise<void> {
        await this.updateConfig({ authorizedFolders: folders });
    }

    async listPermissions(): Promise<ToolPermission[]> {
        return (await window.ipcRenderer.invoke('permissions:list')) as ToolPermission[];
    }

    async revokePermission(tool: string, pathPattern?: string): Promise<void> {
        await window.ipcRenderer.invoke('permissions:revoke', { tool, pathPattern });
    }

    async clearPermissions(): Promise<void> {
        await window.ipcRenderer.invoke('permissions:clear');
    }

    // Skills
    async listSkills(): Promise<SkillInfo[]> {
        return (await window.ipcRenderer.invoke('skills:list')) as SkillInfo[];
    }
}

export const ipcService = new IPCService();
