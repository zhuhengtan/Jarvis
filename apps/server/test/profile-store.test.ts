import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { type ProfileItem } from "@jarvis/shared";
import { ProfileStore } from "../src/profile-store.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

async function stores() {
  const root = await mkdtemp(join(tmpdir(), "jarvis-profile-writers-"));
  roots.push(root);
  const path = join(root, "profile.json");
  const first = new ProfileStore(path);
  const second = new ProfileStore(path);
  const item: ProfileItem = {
    id: "profile-test", category: "workflow", statement: "original", origin: "stated",
    confidence: 0.9, evidence: [], status: "pending", inject: true, count: 0,
    firstSeenAt: "2026-10-12T00:00:00Z", lastSeenAt: "2026-10-12T00:00:00Z",
    updatedAt: "2026-10-12T00:00:00Z", revision: 1,
  };
  await first.saveAll([item]);
  await second.initialize();
  return { first, second, item };
}

it("rejects stale revisions from another initialized store and refreshes reads", async () => {
  const { first, second, item } = await stores();
  await first.update(item.id, { statement: "new statement" }, 1);
  await expect(second.update(item.id, { status: "active" }, 1)).rejects.toThrow("revision conflict");
  expect(await second.get(item.id)).toMatchObject({ statement: "new statement", revision: 2, status: "pending" });
  await second.update(item.id, { status: "active" }, 2);
  expect(await first.list()).toMatchObject([{ statement: "new statement", revision: 3, status: "active" }]);
});

it("serializes mutations from independent stores without losing increments", async () => {
  const { first, second } = await stores();
  await Promise.all(Array.from({ length: 20 }, (_, index) => (index % 2 ? first : second).mutate(items =>
    items.map(item => ({ ...item, count: item.count + 1, revision: item.revision + 1 }))
  )));
  expect(await first.list()).toMatchObject([{ count: 20, revision: 21 }]);
  expect(await second.list()).toMatchObject([{ count: 20, revision: 21 }]);
});

it("does not resurrect a profile deleted by another store", async () => {
  const { first, second, item } = await stores();
  await first.delete(item.id);
  await expect(second.update(item.id, { status: "active" }, 1)).rejects.toThrow("not found");
  expect(await second.mutate(items => items)).toEqual([]);
  expect(await first.list()).toEqual([]);
});
