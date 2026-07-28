/**
 * Step 3 of the Coolify migration — copy every Storage bucket and object from
 * Supabase Cloud into the self-hosted instance.
 *
 * pg_dump does not carry Storage: the bytes live in S3 behind the Storage API,
 * and `storage.objects` rows without the matching bytes are worse than useless.
 * This walks the source through the public API and re-uploads to the target,
 * which recreates both sides consistently.
 *
 *   SOURCE_SUPABASE_URL=https://<ref>.supabase.co \
 *   SOURCE_SERVICE_ROLE_KEY=... \
 *   TARGET_SUPABASE_URL=https://supabase.example.com \
 *   TARGET_SERVICE_ROLE_KEY=... \
 *     node scripts/migrate/migrate-storage.mjs
 *
 * Safe to re-run: objects already present at the target with the same size are
 * skipped, so an interrupted run resumes where it left off.
 */
import { createClient } from "@supabase/supabase-js";

const env = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`missing required env var ${name}`);
    process.exit(1);
  }
  return value;
};

const source = createClient(env("SOURCE_SUPABASE_URL"), env("SOURCE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const target = createClient(env("TARGET_SUPABASE_URL"), env("TARGET_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = process.argv.includes("--dry-run");
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
const PAGE_SIZE = 1000;

/** Storage `list` is one level deep and pages at PAGE_SIZE, so walk it ourselves. */
async function listAll(client, bucket, prefix = "") {
  const files = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data.length) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A directory placeholder has no id/metadata — recurse into it.
      if (entry.id === null) {
        files.push(...(await listAll(client, bucket, path)));
      } else {
        files.push({ path, size: entry.metadata?.size ?? null, mimetype: entry.metadata?.mimetype });
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }

  return files;
}

async function copyObject(bucket, file) {
  const { data: blob, error: downloadError } = await source.storage.from(bucket).download(file.path);
  if (downloadError) throw new Error(`download ${bucket}/${file.path}: ${downloadError.message}`);

  const body = Buffer.from(await blob.arrayBuffer());
  const { error: uploadError } = await target.storage.from(bucket).upload(file.path, body, {
    contentType: file.mimetype || blob.type || "application/octet-stream",
    upsert: true,
  });
  if (uploadError) throw new Error(`upload ${bucket}/${file.path}: ${uploadError.message}`);
}

/** Runs `worker` over `items` with a fixed number of workers pulling from a shared cursor. */
async function pool(items, worker) {
  let cursor = 0;
  const failures = [];

  const runner = async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await worker(item);
      } catch (err) {
        failures.push({ item, message: err.message });
        console.error(`  ! ${err.message}`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, runner));
  return failures;
}

async function main() {
  const { data: buckets, error } = await source.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);

  console.log(`Found ${buckets.length} bucket(s): ${buckets.map((b) => b.name).join(", ")}`);
  if (DRY_RUN) console.log("(dry run — nothing will be written)\n");

  const allFailures = [];
  let copied = 0;
  let skipped = 0;

  for (const bucket of buckets) {
    console.log(`\n=== ${bucket.name} (public: ${bucket.public}) ===`);

    if (!DRY_RUN) {
      const { error: createError } = await target.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: bucket.file_size_limit ?? undefined,
        allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
      });
      // Re-runs hit an existing bucket; anything else is fatal.
      if (createError && !/already exists/i.test(createError.message)) {
        throw new Error(`createBucket ${bucket.name}: ${createError.message}`);
      }
    }

    const sourceFiles = await listAll(source, bucket.name);
    const targetFiles = DRY_RUN ? [] : await listAll(target, bucket.name);
    const existing = new Map(targetFiles.map((f) => [f.path, f.size]));

    const pending = sourceFiles.filter((f) => existing.get(f.path) !== f.size);
    skipped += sourceFiles.length - pending.length;

    const bytes = pending.reduce((sum, f) => sum + (f.size ?? 0), 0);
    console.log(
      `${sourceFiles.length} object(s), ${pending.length} to copy (${(bytes / 1024 / 1024).toFixed(1)} MB)`,
    );

    if (DRY_RUN) continue;

    let done = 0;
    const failures = await pool(pending, async (file) => {
      await copyObject(bucket.name, file);
      done += 1;
      if (done % 25 === 0 || done === pending.length) {
        console.log(`  ${done}/${pending.length}`);
      }
    });

    copied += pending.length - failures.length;
    allFailures.push(...failures.map((f) => ({ ...f, bucket: bucket.name })));
  }

  console.log(`\nCopied ${copied}, skipped ${skipped} (already present), failed ${allFailures.length}.`);
  if (allFailures.length) {
    console.error("\nFailures — re-run to retry just these:");
    for (const f of allFailures) console.error(`  ${f.bucket}/${f.item.path}: ${f.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
