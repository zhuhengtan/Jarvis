import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createJarvisMcpServer } from "./gateway.js";
import { loadLocalEnv } from "./env.js";
await loadLocalEnv();
const server = createJarvisMcpServer();
await server.connect(new StdioServerTransport());
//# sourceMappingURL=stdio.js.map