/** Temp helper: room + real link submissions for link-card visual checks.
 *  Usage: tsx scripts/linkcard-test.ts [clean] */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});
const email = "fancast.linkcard.test@example.com";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];

const TEST_LINKS = [
  "https://www.theguardian.com/football",
  "https://www.bbc.co.uk/sport/football",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://example.com", // no OG data → text-only card
];

function cookieFor(session: Session): string {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  return `sb-${PROJECT_REF}-auth-token=${value}`;
}

async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === email);
  if (u) {
    await service.from("rooms").delete().eq("commentator_id", u.id);
    await service.auth.admin.deleteUser(u.id);
  }
  console.log("cleaned");
}

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  await service.auth.admin.createUser({
    email,
    password: "linkcard-Test-1!",
    email_confirm: true,
  });
  const { data } = await anon.auth.signInWithPassword({
    email,
    password: "linkcard-Test-1!",
  });
  const cookie = cookieFor(data!.session!);
  const userId = data!.session!.user.id;

  await service.from("profiles").insert({ user_id: userId, username: "linkcard_tester" });
  const { data: room } = await service
    .from("rooms")
    .insert({
      fixture_id: -3,
      commentator_id: userId,
      state: "pregame",
      scheduled_kickoff: "2026-08-29T16:30:00Z",
    })
    .select()
    .single();

  for (const url of TEST_LINKS) {
    const res = await fetch("http://localhost:3000/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ roomId: room!.id, url }),
    });
    const body = await res.json().catch(() => ({}));
    console.log(
      `${res.status} ${url} -> title=${JSON.stringify(body.link?.og_title)} image=${body.link?.og_image ? "yes" : "no"}`,
    );
  }
  console.log(`ROOM=${room!.id}`);
}

main();
