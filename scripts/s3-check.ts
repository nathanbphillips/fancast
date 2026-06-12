/** Verify the Supabase S3 credentials do what LiveKit egress needs:
 *  create the public `radio` bucket if missing, then put/get/delete a
 *  test object through the S3 protocol and fetch it via the public URL. */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

async function main() {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: bucket } = await service.storage.getBucket("radio");
  if (!bucket) {
    const { error } = await service.storage.createBucket("radio", {
      public: true,
    });
    if (error) throw new Error(`createBucket: ${error.message}`);
    console.log("created public bucket: radio");
  } else {
    console.log(`bucket radio exists (public: ${bucket.public})`);
  }

  const s3 = new S3Client({
    endpoint: process.env.SUPABASE_S3_ENDPOINT!,
    region: process.env.SUPABASE_S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY!,
      secretAccessKey: process.env.SUPABASE_S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: "radio",
      Key: "s3-check.txt",
      Body: "fancast s3 check",
      ContentType: "text/plain",
    }),
  );
  console.log("S3 PUT ok");

  const got = await s3.send(
    new GetObjectCommand({ Bucket: "radio", Key: "s3-check.txt" }),
  );
  const body = await got.Body!.transformToString();
  console.log(`S3 GET ok: "${body}"`);

  const pub = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/radio/s3-check.txt`,
  );
  console.log(`public URL fetch: ${pub.status} ${pub.ok ? "ok" : "FAILED"}`);

  await s3.send(
    new DeleteObjectCommand({ Bucket: "radio", Key: "s3-check.txt" }),
  );
  console.log("S3 DELETE ok — credentials verified end to end");
}

main().catch((e) => {
  console.error("FAILED:", e.message ?? e);
  process.exit(1);
});
