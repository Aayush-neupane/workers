/** Portal host routing. One build serves all four portals.
 * Prod: www. / clients. / pros. / admin. — dev: path routing on localhost.
 * Role enforcement is always server-side; this is navigation only. */

export type Portal = "public" | "clients" | "pros" | "admin";

export function currentPortal(): Portal {
  const host = window.location.hostname;
  if (host.startsWith("clients.")) return "clients";
  if (host.startsWith("pros.")) return "pros";
  if (host.startsWith("admin.")) return "admin";
  return "public";
}

/** Where an authenticated user belongs. */
export function portalHome(role: "customer" | "worker" | "admin"): string {
  if (role === "worker") return "/worker";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

/** Build a portal URL from env hosts (never hardcode the prod domain). */
export function portalUrl(portal: Portal, path: string): string {
  const proto = window.location.protocol;
  const apex = (import.meta.env.VITE_APEX_DOMAIN as string | undefined) ?? "sajilodamak.com";
  const sub = portal === "public" ? "www" : portal === "clients" ? "clients" : portal === "pros" ? "pros" : "admin";
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return path; // local dev: same-origin path routing
  }
  return `${proto}//${sub}.${apex}${path}`;
}
