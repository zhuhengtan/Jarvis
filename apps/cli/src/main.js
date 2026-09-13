const api = process.env.JARVIS_API_URL ?? "http://127.0.0.1:7330";
const [command, subcommand, ...args] = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const positionals = () => args.filter((value, index) => !value.startsWith("--") && !["--client", "--workspace", "--task", "--project", "--title", "--transport"].includes(args[index - 1]));
const usage = `jarvis commands:\n  jarvis status | doctor\n  jarvis identity name <name>\n  jarvis identity say <natural-language request>\n  jarvis session open --client <name> --workspace <absolute path> --task <task>\n  jarvis memory search --project <id> <query>\n  jarvis project context --project <id>\n  jarvis goal create --project <id> --title <goal>\n  jarvis skill list <query>\n  jarvis mcp config --client <codex|cursor|antigravity> [--transport http|stdio]`;
async function call(path, init) { const response = await fetch(`${api}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } }); if (!response.ok)
    throw new Error(`${response.status}: ${await response.text()}`); console.log(JSON.stringify(await response.json(), null, 2)); }
function printMcpConfig(client, transport = "http") {
    const stdio = { command: "pnpm", args: ["--dir", process.cwd(), "mcp"] };
    const url = process.env.JARVIS_MCP_URL ?? "http://127.0.0.1:7331/mcp";
    if (client === "codex")
        return console.log(transport === "stdio" ? `[mcp_servers.jarvis]\ncommand = "${stdio.command}"\nargs = ${JSON.stringify(stdio.args)}` : `[mcp_servers.jarvis]\nurl = "${url}"`);
    if (client === "cursor")
        return console.log(JSON.stringify({ mcpServers: { jarvis: transport === "stdio" ? stdio : { url } } }, null, 2));
    if (client === "antigravity")
        return console.log(JSON.stringify({ mcpServers: { jarvis: transport === "stdio" ? stdio : { serverUrl: url } } }, null, 2));
    throw new Error("client must be codex, cursor, or antigravity");
}
try {
    if (command === "status" || command === "doctor")
        await call(command === "doctor" ? "/v1/capabilities" : "/health");
    else if (command === "identity" && subcommand === "name")
        await call("/v1/identity/name", { method: "PUT", body: JSON.stringify({ name: positionals().join(" ") }) });
    else if (command === "identity" && subcommand === "say")
        await call("/v1/identity/interpret", { method: "POST", body: JSON.stringify({ message: positionals().join(" ") }) });
    else if (command === "session" && subcommand === "open")
        await call("/v1/sessions", { method: "POST", body: JSON.stringify({ client: option("--client"), workspace: option("--workspace"), task: option("--task") }) });
    else if (command === "memory" && subcommand === "search") {
        const projectId = option("--project");
        await call(`/v1/memory/search?${new URLSearchParams({ projectId: projectId ?? "", query: positionals().join(" ") })}`);
    }
    else if (command === "project" && subcommand === "context")
        await call(`/v1/projects/${encodeURIComponent(option("--project") ?? "")}/context`);
    else if (command === "goal" && subcommand === "create")
        await call("/v1/goals", { method: "POST", body: JSON.stringify({ projectId: option("--project"), title: option("--title") }) });
    else if (command === "skill" && subcommand === "list")
        await call(`/v1/skills/search?${new URLSearchParams({ query: positionals().join(" ") })}`);
    else if (command === "mcp" && subcommand === "config")
        printMcpConfig(option("--client") ?? "", option("--transport"));
    else
        console.log(usage);
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
export {};
//# sourceMappingURL=main.js.map