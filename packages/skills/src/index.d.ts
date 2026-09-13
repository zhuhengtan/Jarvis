import type { SkillEngine } from "@jarvis/core";
export declare class FilesystemSkillEngine implements SkillEngine {
    private readonly root;
    constructor(root: string);
    search(query: string, limit?: number): Promise<{
        name: string;
        description: string;
    }[]>;
    load(name: string): Promise<string | undefined>;
    private all;
}
