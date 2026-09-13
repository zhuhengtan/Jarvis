import { createServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createJarvisMcpServer } from "./gateway.js";
import { loadLocalEnv } from "./env.js";
await loadLocalEnv();
const handler = toNodeHandler(createMcpHandler(createJarvisMcpServer));
const port = Number(process.env.JARVIS_MCP_PORT ?? 7331);
createServer((request, response) => {
    if (new URL(request.url ?? "/", "http://localhost").pathname !== "/mcp") {
        response.writeHead(404).end();
        return;
    }
    handler(request, response);
}).listen(port, "127.0.0.1", () => console.error(`Jarvis MCP listening on http://127.0.0.1:${port}/mcp`));
//# sourceMappingURL=http.js.map