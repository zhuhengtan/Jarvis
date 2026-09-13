export interface IdentityState {
    assistantName?: string;
    updatedAt?: string;
}
export declare class IdentityService {
    private readonly path;
    private readonly initialName?;
    private state;
    constructor(path: string, initialName?: string | undefined);
    initialize(): Promise<void>;
    get assistantName(): string | undefined;
    get onboardingRequired(): boolean;
    get onboardingQuestion(): string;
    setName(value: string): Promise<IdentityState>;
    changeFromNaturalLanguage(message: string): Promise<IdentityState>;
}
