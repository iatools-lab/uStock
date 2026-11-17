import { SupplyError } from "./supply-store.mjs";
import { supplyPermissions, visibleRequests } from "./supply-access.mjs";

// Le prototype sans comptes n'est accessible que depuis la machine locale.
// En production, aucune lecture ou ecriture des demandes n'est exposee.
export function assertLocalSupplyPrototype(req, environment = process.env) {
  if (environment.NODE_ENV === "production")
    throw new SupplyError(
      "Le circuit de demandes est un prototype local. Un contrôle d’accès est nécessaire pour l’activer en production.",
      503,
    );
  const address = req.socket?.remoteAddress;
  if (
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address) ||
    req.headers["x-forwarded-for"] ||
    req.headers.forwarded
  )
    throw new SupplyError(
      "Le prototype est accessible uniquement en local.",
      403,
    );
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host)
    throw new SupplyError("Origine non autorisée.", 403);
}
export function registerSupplyRoutes(server, database) {
  server.middlewares.use("/api/supply-requests", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    try {
      assertLocalSupplyPrototype(req);
      const params = new URL(req.url, "http://localhost").searchParams;
      const role = params.get("role");
      if (!["am", "commercial", "supply"].includes(role))
        throw new SupplyError("Rôle invalide.", 403);
      const managerId = params.get("managerId");
      if (req.method === "GET") {
        if (role === "am") {
          if (params.has("kitsFor"))
            throw new SupplyError("Action non autoris\u00e9e.", 403);
          res.end(
            JSON.stringify(
              await database.areaManagerWorkspace(managerId, {
                kits: params.get("kits") === "true",
              }),
            ),
          );
          return;
        }
        if (params.has("kitsFor")) {
          if (role !== "supply")
            throw new SupplyError("Action réservée à la supply chain.", 403);
          res.end(
            JSON.stringify(
              await database.supplyKitOptions(params.get("kitsFor")),
            ),
          );
          return;
        }
        const workspace = await database.supplyWorkspace();
        workspace.requests = visibleRequests(
          workspace.requests,
          role,
          managerId,
        );
        res.end(JSON.stringify(workspace));
        return;
      }
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, POST");
        res.end(JSON.stringify({ error: "Méthode non autorisée." }));
        return;
      }
      if (!req.headers["content-type"]?.includes("application/json"))
        throw new SupplyError("Format de demande invalide.");
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 100000)
          throw new SupplyError("Demande trop volumineuse.", 413);
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new SupplyError("Demande invalide.");
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new SupplyError("Demande invalide.");
      if (!supplyPermissions[body.action]?.includes(role))
        throw new SupplyError(
          "Action non autoris\u00e9e pour ce r\u00f4le.",
          403,
        );
      if (role === "am" && !managerId)
        throw new SupplyError("Choisissez votre Area manager.");
      res.end(
        JSON.stringify(await database.supplyAction(body, role, managerId)),
      );
    } catch (error) {
      res.statusCode = error instanceof SupplyError ? error.status : 503;
      res.end(
        JSON.stringify({
          error:
            error instanceof SupplyError
              ? error.message
              : "Demandes indisponibles. Réessayez dans quelques instants.",
        }),
      );
    }
  });
}
