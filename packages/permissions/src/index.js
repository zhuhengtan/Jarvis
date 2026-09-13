export class PermissionEngine {
    decide(permission) { return { permission, allowed: permission === "read" || permission === "search", requiresConfirmation: !["read", "search"].includes(permission) }; }
}
//# sourceMappingURL=index.js.map