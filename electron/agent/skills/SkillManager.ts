import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import os from 'os';
import { app } from 'electron';

export interface SkillDefinition {
    name: string;
    description: string;
    instructions: string;
    input_schema: Record<string, unknown>;
}

export class SkillManager {
    private skillsDir: string;
    private oldSkillsDir: string;
    private skills: Map<string, SkillDefinition> = new Map();

    constructor() {
        this.skillsDir = path.join(os.homedir(), '.bingowork', 'skills');
        this.oldSkillsDir = path.join(os.homedir(), '.opencowork', 'skills');
    }

    /**
     * Migrate skills from old opencowork directory to new bingowork directory
     * This preserves existing user skills during brand migration
     */
    private async migrateSkills(): Promise<void> {
        try {
            // Check if new skills directory already exists and has content
            try {
                const files = await fs.readdir(this.skillsDir);
                if (files.length > 0) {
                    // New skills directory exists and has content, no migration needed
                    return;
                }
            } catch {
                // New skills directory doesn't exist, proceed with migration
            }

            // Check if old skills directory exists and has content
            try {
                const oldFiles = await fs.readdir(this.oldSkillsDir);
                if (oldFiles.length === 0) {
                    // Old directory is empty, nothing to migrate
                    return;
                }
            } catch {
                // Old skills directory doesn't exist, nothing to migrate
                return;
            }

            // Ensure the new directory exists
            try {
                await fs.access(this.skillsDir);
            } catch {
                await fs.mkdir(this.skillsDir, { recursive: true });
            }

            // Recursively copy all skills from old to new directory
            const oldFiles = await fs.readdir(this.oldSkillsDir);
            let migratedCount = 0;

            for (const file of oldFiles) {
                const oldPath = path.join(this.oldSkillsDir, file);
                const newPath = path.join(this.skillsDir, file);

                try {
                    const stats = await fs.stat(oldPath);
                    if (stats.isDirectory()) {
                        // Recursively copy directory
                        await fs.cp(oldPath, newPath, { recursive: true, force: true });
                        migratedCount++;
                    } else if (file.endsWith('.md')) {
                        // Copy single-file skills
                        await fs.copyFile(oldPath, newPath);
                        migratedCount++;
                    }
                } catch (error) {
                    console.warn(`[SkillManager] Failed to migrate ${file}:`, error);
                }
            }

            if (migratedCount > 0) {
                console.log(`[SkillManager] Migrated ${migratedCount} skills from ~/.opencowork/skills/ to ~/.bingowork/skills/`);
            }
        } catch (error) {
            console.warn('[SkillManager] Skills migration failed:', error);
            // Non-fatal: continue without migration
        }
    }

    async initializeDefaults() {
        // Migrate skills from old directory if needed
        await this.migrateSkills();

        try {
            // Determine source directory for default skills
            let sourceDir = path.join(process.cwd(), 'resources', 'skills');
            if (app.isPackaged) {
                // In production, resources are typically in process.resourcesPath
                // Checking 'resources/skills' inside resourcesPath (common mapping)
                const possiblePath = path.join(process.resourcesPath, 'resources', 'skills');
                // Fallback to just 'skills' if flattened
                const fallbackPath = path.join(process.resourcesPath, 'skills');

                // Using async exists check helper or try/catch
                try {
                    await fs.access(possiblePath);
                    sourceDir = possiblePath;
                } catch {
                    sourceDir = fallbackPath;
                }
            }

            // Check if source exists
            try {
                await fs.access(sourceDir);
            } catch {
                console.log('Default skills source not found at:', sourceDir);
                return;
            }

            // Ensure target directory exists
            try {
                await fs.access(this.skillsDir);
            } catch {
                await fs.mkdir(this.skillsDir, { recursive: true });
            }

            // Copy files
            const files = await fs.readdir(sourceDir);
            for (const file of files) {
                // Must be a directory (skills are folders now)
                try {
                    const stats = await fs.stat(path.join(sourceDir, file));
                    if (!stats.isDirectory()) continue;
                } catch { continue; }

                const targetPath = path.join(this.skillsDir, file);
                try {
                    // Check if user has modified this skill
                    const builtinMarker = path.join(targetPath, '.builtin');
                    const userModified = await fs.access(targetPath).then(() => true).catch(() => false) &&
                                      await fs.access(builtinMarker).then(() => false).catch(() => true);

                    // Only copy if user hasn't modified it, or mark it as builtin
                    if (!userModified) {
                        await fs.cp(path.join(sourceDir, file), targetPath, { recursive: true, force: true });
                        // Create .builtin marker to indicate this is a built-in skill
                        await fs.writeFile(builtinMarker, String(Date.now()), 'utf-8');
                        console.log(`Installed/Updated default skill: ${file}`);
                    } else {
                        console.log(`Skipping modified skill: ${file}`);
                    }
                } catch (e) {
                    console.error(`Failed to install skill ${file}:`, e);
                }
            }
        } catch (e) {
            console.error('Failed to initialize default skills:', e);
        }
    }

    async loadSkills() {
        await this.initializeDefaults(); // Ensure defaults are installed before loading

        this.skills.clear();
        try {
            await fs.access(this.skillsDir);
        } catch {
            return; // No skills directory
        }

        const files = await fs.readdir(this.skillsDir);
        const loadErrors: Array<{ file: string; error: Error }> = [];

        for (const file of files) {
            const filePath = path.join(this.skillsDir, file);
            let stats;
            try {
                stats = await fs.stat(filePath);
            } catch { continue; }

            if (stats.isDirectory()) {
                // Look for SKILL.md inside directory
                const skillMdPath = path.join(filePath, 'SKILL.md');
                try {
                    await fs.access(skillMdPath);
                    await this.parseSkill(skillMdPath);
                } catch (parseError) {
                    loadErrors.push({ file, error: parseError as Error });
                }
            } else if (file.endsWith('.md')) {
                // Support legacy single-file skills
                try {
                    await this.parseSkill(filePath);
                } catch (parseError) {
                    loadErrors.push({ file, error: parseError as Error });
                }
            }
        }

        console.log(`Loaded ${this.skills.size} skills`);

        // Log any errors that occurred during loading
        if (loadErrors.length > 0) {
            console.warn(`${loadErrors.length} skills failed to load:`);
            for (const { file, error } of loadErrors) {
                console.warn(`  - ${file}: ${error.message}`);
            }
        }
    }

    private async parseSkill(filePath: string) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parts = content.split('---');
            if (parts.length < 3) return; // Invalid frontmatter structure

            const frontmatter = yaml.load(parts[1]) as { name?: string; description?: string; input_schema?: Record<string, unknown> } | undefined;
            const instructions = parts.slice(2).join('---').trim();

            if (frontmatter && frontmatter.name && frontmatter.description) {
                console.log(`[SkillManager] Loaded ${frontmatter.name} (desc: ${frontmatter.description}, inst len: ${instructions.length})`);
                this.skills.set(frontmatter.name, {
                    name: frontmatter.name,
                    description: frontmatter.description,
                    input_schema: frontmatter.input_schema || { type: 'object', properties: {} },
                    instructions: instructions
                });
            } else {
                console.warn(`[SkillManager] Invalid frontmatter in ${filePath}`);
            }
        } catch (e) {
            console.error(`Failed to load skill from ${filePath}`, e);
        }
    }

    getTools() {
        return Array.from(this.skills.values()).map(skill => ({
            name: skill.name,
            description: skill.description,
            input_schema: skill.input_schema
        }));
    }

    getSkillInstructions(name: string): string | undefined {
        return this.getSkillInfo(name)?.instructions;
    }

    getSkillInfo(name: string): { instructions: string, skillDir: string } | undefined {
        // Try exact match first
        let skill = this.skills.get(name);
        let skillName = name;

        // Try underscore/hyphen swap if not found
        if (!skill) {
            const alternativeName = name.includes('_') ? name.replace(/_/g, '-') : name.replace(/-/g, '_');
            skill = this.skills.get(alternativeName);
            if (skill) skillName = alternativeName;
        }

        if (!skill) return undefined;

        // Return both instructions and the skill directory path
        const skillDir = path.join(this.skillsDir, skillName);
        return {
            instructions: skill.instructions,
            skillDir: skillDir
        };
    }
}
