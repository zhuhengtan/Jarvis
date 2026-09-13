import { PermissionEngine } from "@jarvis/permissions";
export class ToolGateway {
    permissions;
    constructor(permissions = new PermissionEngine()) {
        this.permissions = permissions;
    }
    authorize(permission) { return this.permissions.decide(permission); }
}
//# sourceMappingURL=index.js.map