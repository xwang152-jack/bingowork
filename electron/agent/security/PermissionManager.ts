import path from 'path';
import { configStore } from '../../config/ConfigStore';

export class PermissionManager {

    constructor() {
        // No initialization needed
    }

    authorizeFolder(folderPath: string): boolean {
        const normalized = path.resolve(folderPath);
        // Security check: never allow root directories
        if (normalized === '/' || normalized === 'C:\\' || normalized.match(/^[A-Z]:\\$/)) {
            console.warn('Attempted to authorize root directory, denied.');
            return false;
        }
        configStore.addAuthorizedFolder(normalized);
        console.log(`Authorized folder: ${normalized}`);
        return true;
    }

    revokeFolder(folderPath: string): void {
        const normalized = path.resolve(folderPath);
        configStore.removeAuthorizedFolder(normalized);
    }

    isPathAuthorized(filePath: string): boolean {
        const raw = String(filePath || '').trim().replace(/^["']|["']$/g, '');
        const isWindowsAbs = /^[A-Za-z]:[\\/]/.test(raw);
        if (!isWindowsAbs && !path.isAbsolute(raw)) return false;

        const normalized = path.resolve(raw);
        const authorizedFolders = configStore.getAuthorizedFolders();
        for (const folder of authorizedFolders) {
            const normalizedFolder = path.resolve(folder);
            if (normalized === normalizedFolder || normalized.startsWith(normalizedFolder + path.sep)) {
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
}

export const permissionManager = new PermissionManager();
