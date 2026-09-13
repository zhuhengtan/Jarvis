import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
export class IdentityService {
    path;
    initialName;
    state = {};
    constructor(path, initialName) {
        this.path = path;
        this.initialName = initialName;
    }
    async initialize() {
        try {
            this.state = JSON.parse(await readFile(this.path, "utf8"));
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
            if (this.initialName)
                await this.setName(this.initialName);
        }
    }
    get assistantName() { return this.state.assistantName; }
    get onboardingRequired() { return !this.state.assistantName; }
    get onboardingQuestion() { return "你好，我刚刚开始陪伴你。你希望我叫什么名字？"; }
    async setName(value) {
        const assistantName = validateName(value);
        this.state = { assistantName, updatedAt: new Date().toISOString() };
        await mkdir(dirname(this.path), { recursive: true });
        const temporary = `${this.path}.tmp`;
        await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
        await rename(temporary, this.path);
        return this.state;
    }
    async changeFromNaturalLanguage(message) {
        const name = extractName(message);
        if (!name)
            throw new Error("我没能从这句话中确认新名字。请直接说“以后叫你 XXX”。");
        return this.setName(name);
    }
}
function validateName(value) { const name = value.trim().replace(/[。！，,.!?]+$/g, ""); if (!name || name.length > 64 || /[\u0000-\u001F\\/]/.test(name))
    throw new Error("名字需要是 1 到 64 个字符，且不能包含路径或控制字符。"); return name; }
function extractName(message) {
    const trimmed = message.trim();
    const match = trimmed.match(/(?:以后|之后|从现在起)?(?:就)?(?:叫你|称呼你|把你的名字(?:改成|改为)|你(?:的)?名字(?:改成|改为)|call you|name you)\s*(?:是|为|叫|as|to)?\s*[“"']?([^“”"'。！，,!？?\n]{1,64})/iu);
    return match?.[1]?.trim();
}
//# sourceMappingURL=identity.js.map