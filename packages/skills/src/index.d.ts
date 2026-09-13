import type { SkillEngine } from "@jarvis/core";
import type { SkillBundle } from "@jarvis/shared";
export declare class FilesystemSkillEngine implements SkillEngine {
    private readonly root;
    constructor(root: string);
    search(query: string, limit?: number): Promise<{
        name: string;
        description: string;
        scriptCount: number;
    }[]>;
    load(name: string): Promise<string | undefined>;
    loadBundle(name: string): Promise<SkillBundle | undefined>;
    saveBundle(bundle: SkillBundle): Promise<void>;
    delete(name: string): Promise<boolean>;
    private all;
}
