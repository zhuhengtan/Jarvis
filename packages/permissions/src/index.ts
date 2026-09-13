export type Permission = "read" | "search" | "write" | "run" | "delete" | "network";
export class PermissionEngine { decide(permission: Permission) { return { permission, allowed: permission === "read" || permission === "search", requiresConfirmation: !["read", "search"].includes(permission) }; } }
