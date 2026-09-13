export type Permission = "read" | "search" | "write" | "run" | "delete" | "network";
export declare class PermissionEngine {
    decide(permission: Permission): {
        permission: Permission;
        allowed: boolean;
        requiresConfirmation: boolean;
    };
}
