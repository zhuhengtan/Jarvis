import { PermissionEngine, type Permission } from "@jarvis/permissions";
export class ToolGateway { constructor(private readonly permissions = new PermissionEngine()) {} authorize(permission: Permission) { return this.permissions.decide(permission); } }
