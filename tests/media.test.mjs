import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const privateDataTest = process.env.PTE_PRIVATE_DATA_TESTS === "1" ? test : test.skip;

const tsSource = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const urlFor = async (path, replacements = []) => {
  let code = await tsSource(path);
  for (const [from, to] of replacements) code = code.replaceAll(from, to);
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
};
const importModule = async (name, url) => {
  try { return await import(url); } catch (error) { throw new Error(`Could not load ${name}: ${error.message}`); }
};

const questionTypesUrl = await urlFor("../src/lib/study/question-types.ts");
const identityUrl = await urlFor("../src/lib/study/item-identity.ts", [
  ['from "@/lib/study/question-types"', `from "${questionTypesUrl}"`],
]);
const audioTypesUrl = await urlFor("../src/lib/audio/types.ts");
const playbackUrl = await urlFor("../src/lib/audio/playback.ts", [
  ['from "@/lib/audio/types"', `from "${audioTypesUrl}"`],
]);
const reviewTypesUrl = await urlFor("../src/lib/review/types.ts");
const fsrsUrl = await urlFor("../src/lib/review/fsrs.ts", [
  ['from "ts-fsrs"', `from "${import.meta.resolve("ts-fsrs")}"`],
  ['from "@/lib/review/types"', `from "${reviewTypesUrl}"`],
]);
const adaptersUrl = await urlFor("../src/lib/study/adapters.ts", [
  ['from "@/lib/audio/playback"', `from "${playbackUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
]);
const modesUrl = await urlFor("../src/lib/study/modes.ts");
const availabilityUrl = await urlFor("../src/lib/study/mode-availability.ts");
const engineUrl = await urlFor("../src/lib/datasets/engine.ts", [
  ['import "server-only";', ""],
  ['from "@/lib/study/question-types"', `from "${questionTypesUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
]);
const resolverUrl = await urlFor("../src/lib/media/resolver.ts", [
  ['import "server-only";', ""],
  ['from "@/lib/datasets/engine"', `from "${engineUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
  ['from "@/lib/study/question-types"', `from "${questionTypesUrl}"`],
  ['from "@/lib/study/adapters"', `from "${adaptersUrl}"`],
]);
const cloudinaryUrl = await urlFor("../src/lib/media/cloudinary-delivery.ts", [
  ['import "server-only";', ""],
  ['from "@/lib/media/resolver"', `from "${resolverUrl}"`],
]);
const endpointUrl = await urlFor("../src/lib/media/endpoint-core.ts", [
  ['import "server-only";', ""],
  ['from "@/lib/media/cloudinary-delivery"', `from "${cloudinaryUrl}"`],
]);
const runnerUrl = await urlFor("../src/lib/study/runner-core.ts", [
  ['from "@/lib/review/fsrs"', `from "${fsrsUrl}"`],
  ['from "@/lib/review/types"', `from "${reviewTypesUrl}"`],
  ['from "@/lib/study/adapters"', `from "${adaptersUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
  ['from "@/lib/study/modes"', `from "${modesUrl}"`],
  ['from "@/lib/study/mode-availability"', `from "${availabilityUrl}"`],
]);
const resolver = await importModule("media resolver", resolverUrl);
const runner = await importModule("Study Runner", runnerUrl);
const cloudinary = await importModule("Cloudinary media delivery", cloudinaryUrl);
const endpoint = await importModule("authenticated media endpoint", endpointUrl);

const sha = "a".repeat(64);
function fixture({ typeKey = "03-di", itemId = 1, role = "image", delivery = "upload", sourcePath, publicId, sourceSha = sha } = {}) {
  const type = typeKey === "03-di" ? { number: 3, code: "di" } : { number: 4, code: "rl" };
  const directory = `${String(type.number).padStart(2, "0")}-${type.code.toUpperCase()}`;
  const relativePath = sourcePath ?? (role === "image" ? "images/q1.png" : `audio/004-q${itemId}.mp3`);
  const id = `apeuni:${typeKey}:${itemId}::${role}:${typeKey === "03-di" ? "03-describe-image" : "04-retell-lecture"}/${relativePath}`;
  const expectedPublicId = publicId ?? `pte/data/${directory}/${relativePath.replace(/\.[^.]+$/, "")}`;
  const extension = relativePath.split(".").at(-1);
  const resourceType = role === "audio" ? "video" : "image";
  const registry = {
    asset_id: id,
    owner: { provider: "apeuni", question_type: typeKey, question_id: itemId },
    role,
    source_path: `${typeKey === "03-di" ? "03-describe-image" : "04-retell-lecture"}/${relativePath}`,
    target_path: `data/${directory}/${relativePath}`,
    expected_public_id: expectedPublicId,
    expected_delivery_type: delivery,
    resource_type: resourceType,
    source_sha256: sourceSha,
    format: extension,
    association_status: "EXPLICIT_REFERENCE",
  };
  const deliveryUrl = `https://res.cloudinary.com/example-cloud/${resourceType}/${delivery}/v1791883865/${expectedPublicId}.${extension}`;
  const remote = {
    asset_id: id,
    registry_asset_id: id,
    cloudinary_asset_id: "14e75e0d1b09751000878485a1825fd5",
    cloud_name: "example-cloud",
    delivery_type: delivery,
    public_id: expectedPublicId,
    remote_status: "REMOTE_VERIFIED",
    resource_type: resourceType,
    format: extension,
    remote_bytes: 12,
    source_sha256: sourceSha,
    delivery_url: deliveryUrl,
    verification_evidence: {
      asset_id: "14e75e0d1b09751000878485a1825fd5",
      bytes: 12,
      cloud_name: "example-cloud",
      delivery_type: delivery,
      etag_matches_source_md5: true,
      public_id: expectedPublicId,
      resource_type: resourceType,
      format: extension,
      source_md5: "d10b9c1c4ba13e2f56f09040cab4724f",
      status: "active",
      version: 1791883865,
      etag: "d10b9c1c4ba13e2f56f09040cab4724f",
      delivery_url: deliveryUrl,
      identity_conflicts: [],
    },
  };
  const reference = role === "image" ? { id: itemId, image: relativePath } : { id: itemId, audio: relativePath };
  return { registry, remote, reference, index: { registry: [registry], remote: { [id]: remote }, cloudName: "example-cloud" }, deliveryUrl };
}

test("canonical identity plus exact remote asset identity resolves a verified media URL", () => {
  const value = fixture();
  assert.equal(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, value.index).imageUrl, value.deliveryUrl);
});

test("remote asset identity must match the registry key and evidence", () => {
  const value = fixture();
  const remote = { ...value.remote, verification_evidence: { ...value.remote.verification_evidence, asset_id: "" } };
  assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, { ...value.index, remote: { [value.registry.asset_id]: remote } }), {});
});

test("audio resources map to Cloudinary video delivery", () => {
  const value = fixture({ typeKey: "04-rl", itemId: 123, role: "audio" });
  assert.match(value.deliveryUrl, /\/video\/upload\//);
  assert.equal(resolver.resolveQuestionMediaFromIndex("04-rl", value.reference, value.index).audioUrl, value.deliveryUrl);
});

test("image resources map to Cloudinary image delivery", () => {
  const value = fixture();
  assert.match(value.deliveryUrl, /\/image\/upload\//);
  assert.equal(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, value.index).imageUrl, value.deliveryUrl);
});

test("wrong question IDs are rejected", () => {
  const value = fixture();
  assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", { ...value.reference, id: 2 }, value.index), {});
});

test("wrong media roles are rejected", () => {
  const value = fixture();
  assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", { id: 1, audio: "images/q1.png" }, value.index), {});
});

test("duplicate exact registry associations are rejected", () => {
  const value = fixture();
  assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, { ...value.index, registry: [value.registry, { ...value.registry }] }), {});
});

test("source checksum mismatch rejects a remote asset", () => {
  const value = fixture();
  assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, { ...value.index, remote: { [value.registry.asset_id]: { ...value.remote, source_sha256: "b".repeat(64) } } }), {});
});

test("unsupported delivery types are rejected", () => {
  const value = fixture({ delivery: "private" });
  assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, value.index), {});
});

test("authenticated verified media resolves only to the same-origin media endpoint", () => {
  const value = fixture({ delivery: "authenticated" });
  const expected = "/api/media?identity=apeuni%3Aquestion%3A03-di%3A1&role=image";
  assert.equal(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, value.index).imageUrl, expected);
});

test("unverified authenticated delivery is rejected", () => {
  const value = fixture({ delivery: "authenticated" });
  value.remote.verification_evidence = { ...value.remote.verification_evidence, status: "deleted" };
  assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, value.index), {});
});

test("authenticated media rejects hash, ownership, resource, and conflict mismatches", () => {
  const value = fixture({ delivery: "authenticated" });
  const candidates = [
    { registry: { ...value.registry, source_sha256: "b".repeat(64) }, remote: value.remote },
    { registry: { ...value.registry, association_status: "ASSOCIATION_UNVERIFIED" }, remote: value.remote },
    { registry: { ...value.registry, target_identity_conflict: true }, remote: value.remote },
    { registry: value.registry, remote: { ...value.remote, resource_type: "video" } },
    { registry: value.registry, remote: { ...value.remote, verification_evidence: { ...value.remote.verification_evidence, identity_conflicts: ["conflict"] } } },
  ];
  for (const candidate of candidates) {
    const index = { registry: [candidate.registry], remote: { [candidate.registry.asset_id]: candidate.remote }, cloudName: "example-cloud" };
    assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, index), {});
  }
});

test("invalid, insecure, credentialed, query-bearing, and mismatched URLs are rejected", () => {
  const value = fixture();
  for (const badUrl of [
    "http://res.cloudinary.com/example-cloud/image/upload/v1/pte/data/03-DI/images/q1.png",
    "https://evil.example/image/upload/v1/pte/data/03-DI/images/q1.png",
    "https://user:pass@res.cloudinary.com/example-cloud/image/upload/v1/pte/data/03-DI/images/q1.png",
    `${value.deliveryUrl}?token=untrusted`,
    "https://res.cloudinary.com/example-cloud/image/upload/v1/pte/data/03-DI/images/q2.png",
  ]) {
    const remote = { ...value.remote, delivery_url: badUrl, verification_evidence: { ...value.remote.verification_evidence, delivery_url: badUrl } };
    assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, { ...value.index, remote: { [value.registry.asset_id]: remote } }), {}, badUrl);
  }
});

test("missing remote media is unavailable", () => {
  const value = fixture();
  assert.deepEqual(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, { registry: [value.registry], remote: {} }), {});
});

test("resolver returns a private endpoint independently of signing configuration", () => {
  const value = fixture({ delivery: "authenticated" });
  assert.equal(resolver.resolveQuestionMediaFromIndex("03-di", value.reference, value.index).imageUrl, "/api/media?identity=apeuni%3Aquestion%3A03-di%3A1&role=image");
});

test("missing signing configuration fails closed without contacting Cloudinary", async () => {
  let fetches = 0;
  const handle = endpoint.createAuthenticatedMediaHandler({
    authenticate: async () => true,
    resolve: async () => ({ cloudName: "example-cloud", format: "png", publicId: "pte/data/03-DI/images/q1", remoteBytes: 12, resourceType: "image", version: 1791883865 }),
    cloudinaryUrl: () => undefined,
    fetcher: async () => { fetches += 1; throw new Error("unexpected request"); },
  });
  const response = await handle(new Request("https://app.test/api/media?identity=apeuni%3Aquestion%3A03-di%3A1&role=image"));
  assert.equal(response.status, 503);
  assert.equal(fetches, 0);
});

privateDataTest("reconciled manifest preserves the previous verified DI record and scopes its audit claim", async () => {
  const manifest = JSON.parse(await readFile(new URL("../data/.sync/cloudinary-assets.json", import.meta.url), "utf8"));
  const previousId = "apeuni:03-di:1::image:03-describe-image/images/q1.png";
  assert.equal(manifest.assets[previousId]?.remote_status, "REMOTE_VERIFIED");
  assert.equal(manifest.assets[previousId]?.verification_evidence?.etag_matches_source_md5, true);
  assert.equal(manifest.assets[previousId]?.delivery_type, "authenticated");
  const run = manifest.audit.reconciliations?.at(-1);
  assert.equal(run?.checked, 382);
  assert.equal(run?.delivery_urls_stored, false);
  assert.equal(run?.remote_status, "REMOTE_VERIFIED");
});

privateDataTest("verified remote records are reused without scheduling duplicate uploads", async () => {
  const manifest = JSON.parse(await readFile(new URL("../data/.sync/cloudinary-assets.json", import.meta.url), "utf8"));
  const record = manifest.assets["apeuni:04-rl:123::audio:04-retell-lecture/audio/004-q123.mp3"];
  assert.equal(record?.operation, "audit");
  assert.equal(record?.remote_status, "REMOTE_VERIFIED");
  assert.equal(record?.delivery_type, "authenticated");
  assert.equal(record?.verification_evidence?.etag_matches_source_md5, true);
});

test("Study Runner passes only resolver-approved media URLs into the active study item", async () => {
  const first = fixture({ typeKey: "04-rl", itemId: 123, role: "audio" });
  const second = fixture({ typeKey: "04-rl", itemId: 124, role: "audio", sourcePath: "audio/005-q124.mp3", publicId: "pte/data/04-RL/audio/005-q124" });
  const allowedIndex = { registry: [first.registry, second.registry], remote: { [first.registry.asset_id]: first.remote, [second.registry.asset_id]: second.remote }, cloudName: "example-cloud" };
  const resolved = [];
  const service = runner.createStudyRunnerService({
    authenticate: async () => "test-user",
    resolve: async () => ({ dataset: { id: "all", label: "All", status: "available", count: 2 }, items: [first.reference, second.reference] }),
    loadStates: async () => [],
    save: async () => ({ status: "saved" }),
    resolveMedia: async (typeKey, item) => {
      resolved.push(item.id);
      return resolver.resolveQuestionMediaFromIndex(typeKey, item, allowedIndex);
    },
    now: () => new Date("2026-10-14T00:00:00.000Z"),
  });
  const session = await service.start("04-rl", "all", "listen-repeat", "all");
  assert.deepEqual(resolved, [123]);
  assert.equal(session.item?.audioUrl, first.deliveryUrl);
});

test("authenticated Study Runner items receive only a local proxy URL", async () => {
  const value = fixture({ typeKey: "04-rl", itemId: 123, role: "audio", delivery: "authenticated" });
  const service = runner.createStudyRunnerService({
    authenticate: async () => "test-user",
    resolve: async () => ({ dataset: { id: "all", label: "All", status: "available", count: 1 }, items: [value.reference] }),
    loadStates: async () => [],
    save: async () => ({ status: "saved" }),
    resolveMedia: async (typeKey, item) => resolver.resolveQuestionMediaFromIndex(typeKey, item, value.index),
    now: () => new Date("2026-10-14T00:00:00.000Z"),
  });
  const session = await service.start("04-rl", "all", "listen-repeat", "all");
  assert.equal(session.item?.audioUrl, "/api/media?identity=apeuni%3Aquestion%3A04-rl%3A123&role=audio");
});

test("Cloudinary URL signing uses the documented server-side authenticated delivery path", () => {
  const sample = fixture({ delivery: "authenticated" });
  const signed = cloudinary.buildAuthenticatedCloudinaryUrl({
    cloudName: "example-cloud", format: "png", publicId: "pte/data/03-DI/images/q1",
    remoteBytes: 12, resourceType: "image", version: 1791883865,
  }, "cloudinary://api-key:api-secret@example-cloud");
  assert.match(signed, /^https:\/\/res\.cloudinary\.com\/example-cloud\/image\/authenticated\/s--[A-Za-z0-9_-]{8}--\/v1791883865\//);
  assert.equal(signed.includes("api-secret"), false);
  assert.equal(cloudinary.buildAuthenticatedCloudinaryUrl({ cloudName: "other", format: "png", publicId: "p/q", remoteBytes: 12, resourceType: "image", version: 1 }, "cloudinary://key:secret@example-cloud"), null);
  assert.equal(cloudinary.mediaContentType(sample.registry.format), "image/png");
});

test("anonymous, invalid identity, invalid role, and arbitrary URLs are rejected before Cloudinary", async () => {
  let resolves = 0;
  let fetches = 0;
  const handle = endpoint.createAuthenticatedMediaHandler({
    authenticate: async () => false,
    resolve: async () => { resolves += 1; return null; },
    cloudinaryUrl: () => "cloudinary://key:secret@example-cloud",
    fetcher: async () => { fetches += 1; throw new Error("unexpected fetch"); },
  });
  const denied = await handle(new Request("https://app.test/api/media?identity=apeuni%3Aquestion%3A03-di%3A1&role=image"));
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get("cache-control").includes("no-store"), true);
  const authed = endpoint.createAuthenticatedMediaHandler({
    authenticate: async () => true,
    resolve: async () => { resolves += 1; return null; },
  });
  for (const path of [
    "/api/media?identity=bad&role=image",
    "/api/media?identity=apeuni%3Aquestion%3A03-di%3A1&role=video",
    "/api/media?identity=apeuni%3Aquestion%3A03-di%3A1&role=image&url=https%3A%2F%2Fevil.example",
  ]) assert.equal((await authed(new Request(`https://app.test${path}`))).status, 404);
  assert.equal(resolves, 0);
  assert.equal(fetches, 0);
});

test("authenticated media streams valid range responses without exposing signed upstream URLs", async () => {
  let upstreamUrl = "";
  const handle = endpoint.createAuthenticatedMediaHandler({
    authenticate: async () => true,
    resolve: async () => ({ cloudName: "example-cloud", format: "mp3", publicId: "pte/data/04-RL/audio/004-q123", remoteBytes: 100, resourceType: "video", version: 1791883865 }),
    cloudinaryUrl: () => "cloudinary://api-key:do-not-leak@example-cloud",
    fetcher: async (input, init) => {
      upstreamUrl = String(input);
      assert.equal(init.headers.Range, "bytes=10-20");
      return new Response("01234567890", { status: 206, headers: { "Content-Range": "bytes 10-20/100", "Content-Length": "11", "Accept-Ranges": "bytes" } });
    },
  });
  const response = await handle(new Request("https://app.test/api/media?identity=apeuni%3Aquestion%3A04-rl%3A123&role=audio", { headers: { Range: "bytes=10-20" } }));
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.equal(response.headers.get("content-range"), "bytes 10-20/100");
  assert.equal(response.headers.get("cache-control").includes("no-store"), true);
  assert.equal(response.headers.has("location"), false);
  const body = await response.text();
  assert.equal(body, "01234567890");
  assert.equal(body.includes("do-not-leak"), false);
  assert.match(upstreamUrl, /\/video\/authenticated\/s--[A-Za-z0-9_-]{8}--\/v1791883865\//);
  for (const value of response.headers.values()) assert.equal(value.includes("do-not-leak"), false);
});

test("HEAD returns verified media headers without buffering a response body", async () => {
  let upstreamMethod = "";
  const handle = endpoint.createAuthenticatedMediaHandler({
    authenticate: async () => true,
    resolve: async () => ({ cloudName: "example-cloud", format: "png", publicId: "pte/data/03-DI/images/q1", remoteBytes: 12, resourceType: "image", version: 1791883865 }),
    cloudinaryUrl: () => "cloudinary://api-key:do-not-leak@example-cloud",
    fetcher: async (_input, init) => {
      upstreamMethod = init.method;
      return new Response(null, { status: 200, headers: { "Content-Length": "12", "Accept-Ranges": "bytes" } });
    },
  });
  const response = await handle(new Request("https://app.test/api/media?identity=apeuni%3Aquestion%3A03-di%3A1&role=image", { method: "HEAD" }));
  assert.equal(response.status, 200);
  assert.equal(upstreamMethod, "HEAD");
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-length"), "12");
  assert.equal(await response.text(), "");
  assert.equal(response.headers.has("location"), false);
  for (const value of response.headers.values()) assert.equal(value.includes("do-not-leak"), false);
});

test("invalid multiple ranges are rejected and upstream partial metadata is not fabricated", async () => {
  let fetches = 0;
  const asset = { cloudName: "example-cloud", format: "mp3", publicId: "p/a", remoteBytes: 100, resourceType: "video", version: 1 };
  const handle = endpoint.createAuthenticatedMediaHandler({
    authenticate: async () => true,
    resolve: async () => asset,
    cloudinaryUrl: () => "cloudinary://key:secret@example-cloud",
    fetcher: async () => { fetches += 1; return new Response("", { status: 206 }); },
  });
  const invalid = await handle(new Request("https://app.test/api/media?identity=apeuni%3Aquestion%3A04-rl%3A123&role=audio", { headers: { Range: "bytes=0-1,5-8" } }));
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get("content-range"), "bytes */100");
  const malformedUpstream = await handle(new Request("https://app.test/api/media?identity=apeuni%3Aquestion%3A04-rl%3A123&role=audio", { headers: { Range: "bytes=0-1" } }));
  assert.equal(malformedUpstream.status, 502);
  assert.equal(await malformedUpstream.text(), "Media is unavailable.");
  assert.equal(fetches, 1);
  assert.equal(cloudinary.isSingleByteRange("bytes=0-1,5-8"), false);
});

privateDataTest("actual verified canonical media associations map to private local endpoints", async () => {
  const resolved = await resolver.resolveQuestionMedia("03-di", { id: 1, image: "images/q1.png" });
  assert.equal(resolved.imageUrl, "/api/media?identity=apeuni%3Aquestion%3A03-di%3A1&role=image");
  const asset = await resolver.resolveAuthenticatedQuestionMedia("apeuni:question:03-di:1", "image");
  assert.equal(asset?.resourceType, "image");
  assert.equal(asset?.cloudName, "diasihdzg");
});
