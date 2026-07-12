import { brand } from "@/lib/brand";

/**
 * Reserved usernames (FR-18.3). Profiles live at root-level `/{username}`, so
 * every name that is (or plausibly becomes) a top-level path must never be a
 * username. Enforced in the username zod schema (app/api/profile) at create
 * AND change time; migration 0026 asserts no existing username collides.
 *
 * Notes on scope: usernames match /^[A-Za-z0-9_]{3,20}$/, so names with
 * hyphens or dots (opengraph-image, sw.js, favicon.ico, no-reply) can never
 * collide and are not listed. Comparison is case-insensitive (citext column;
 * we lowercase before checking).
 */

const RESERVED = [
  // current top-level routes (app/(app) + api/auth)
  "about",
  "admin",
  "api",
  "auth",
  "guidelines",
  "matches",
  "privacy",
  "room",
  "rooms",
  "settings",
  "signin",
  "terms",
  "welcome",
  // "u" and "dev-docs" are shorter than 3 chars / contain a hyphen, but "u"
  // stays listed defensively in case the username pattern ever loosens
  "u",
  // plausible future routes
  "pricing",
  "blog",
  "help",
  "support",
  "login",
  "logout",
  "signup",
  "signout",
  "careers",
  "contact",
  "docs",
  "faq",
  "legal",
  "press",
  "search",
  "explore",
  "discover",
  "live",
  "home",
  "app",
  "download",
  "downloads",
  "notifications",
  "friends",
  "followers",
  "following",
  "profile",
  "profiles",
  "account",
  "accounts",
  "billing",
  "tips",
  "tip",
  "replay",
  "replays",
  "recordings",
  "recording",
  "clubs",
  "teams",
  "fixtures",
  "fixture",
  "community",
  "mod",
  "moderation",
  "status",
  "news",
  "store",
  "shop",
  "dashboard",
  "host",
  "hosts",
  "listen",
  "schedule",
  // file-ish top-level names Next or crawlers expect
  "manifest",
  "icons",
  "icon",
  "robots",
  "sitemap",
  "favicon",
  "assets",
  "static",
  "public",
  "_next",
  // infrastructure + impersonation guards
  "www",
  "mail",
  "email",
  "ftp",
  "root",
  "null",
  "undefined",
  "administrator",
  "sysadmin",
  "webmaster",
  "postmaster",
  "noreply",
  "security",
  "abuse",
  "official",
  "staff",
  "team",
  // brand handles (the platform's own name; `brand.name` has a space so it
  // can't cover a real handle — reserve the usable forms explicitly). Keeps
  // the prior "fancast" reserved through the rename.
  "redub",
  "redubradio",
  "redub-radio",
  "radio",
  "fancast",
] as const;

// the platform's own name is always reserved (from config, golden rule 7:
// the product may be renamed); harmless when it contains a space
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  ...RESERVED,
  brand.name.toLowerCase(),
]);

/** True when the (case-insensitive) username may never be registered. */
export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}
