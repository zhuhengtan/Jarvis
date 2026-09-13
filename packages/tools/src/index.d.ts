import { PermissionEngine, type Permission } from "@jarvis/permissions";
export declare class ToolGateway {
    private readonly permissions;
    constructor(permissions?: PermissionEngine);
    authorize(permission: Permission): {
        permission: Permission;
        allowed: boolean;
        requiresConfirmation: boolean;
    };
}
