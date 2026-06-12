/** Verify LiveKit credentials: list rooms (auth check) + mint a token. */
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import "dotenv/config";

async function main() {
  const url = process.env.LIVEKIT_URL!;
  const key = process.env.LIVEKIT_API_KEY!;
  const secret = process.env.LIVEKIT_API_SECRET!;

  const svc = new RoomServiceClient(
    url.replace("wss://", "https://"),
    key,
    secret,
  );
  const rooms = await svc.listRooms();
  console.log(`auth OK — ${rooms.length} active room(s)`);

  const at = new AccessToken(key, secret, { identity: "credential-check" });
  at.addGrant({ room: "check", roomJoin: true, canSubscribe: true });
  const jwt = await at.toJwt();
  console.log(`token mint OK — ${jwt.slice(0, 24)}…`);
}

main().catch((e) => {
  console.error("FAILED:", e.message ?? e);
  process.exit(1);
});
