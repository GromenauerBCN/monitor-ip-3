// Augment Fastify instance types
import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
  }
  interface FastifyRequest {
    user?: { id: string; email: string };
  }
}
