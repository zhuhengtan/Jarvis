import type { FastifyPluginAsync } from "fastify";
import type { JarvisRuntime } from "../runtime.js";
interface AdminRoutesOptions {
    runtime: JarvisRuntime;
}
export declare const adminRoutes: FastifyPluginAsync<AdminRoutesOptions>;
export {};
