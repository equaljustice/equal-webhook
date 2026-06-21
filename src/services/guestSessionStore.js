import { getRedisClient } from "../lib/redisClient.js";

const KEY_PREFIX = "ej:guest:session:";
const INDEX_PREFIX = "ej:guest:index:";

/** Guest sessions are kept for 24 hours. */
export const GUEST_SESSION_TTL_SEC = 24 * 60 * 60;
export const GUEST_SESSION_TTL_MS = GUEST_SESSION_TTL_SEC * 1000;

/** @type {Map<string, { state: object, expiresAt: number }>} */
const memoryStore = new Map();
/** @type {Map<string, { entries: object[], expiresAt: number }>} */
const memoryIndex = new Map();
let memoryFallbackLogged = false;

function sessionKey(id) {
  return KEY_PREFIX + id;
}

function indexKey(anonymousId, assistantKey) {
  return `${INDEX_PREFIX}${anonymousId}:${assistantKey}`;
}

function useMemoryFallback() {
  if (process.env.REDIS_URL?.trim()) return false;
  if (process.env.GUEST_REQUIRE_REDIS === "true") return false;
  return true;
}

function logMemoryFallbackOnce() {
  if (memoryFallbackLogged) return;
  memoryFallbackLogged = true;
  const env = process.env.NODE_ENV || "development";
  console.warn(
    `[guest] REDIS_URL not set — using in-memory guest sessions (${env}). ` +
      "Set REDIS_URL for production persistence."
  );
}

export async function isGuestStorageAvailable() {
  const redis = await getRedisClient();
  if (redis) return true;
  return useMemoryFallback();
}

function pruneExpiredMemory() {
  const now = Date.now();
  for (const [id, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(id);
  }
  for (const [id, entry] of memoryIndex) {
    if (entry.expiresAt <= now) memoryIndex.delete(id);
  }
}

function memoryGet(guestSessionId) {
  pruneExpiredMemory();
  const entry = memoryStore.get(guestSessionId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(guestSessionId);
    return null;
  }
  return entry.state;
}

function memoryPut(guestSessionId, state) {
  logMemoryFallbackOnce();
  memoryStore.set(guestSessionId, {
    state,
    expiresAt: Date.now() + GUEST_SESSION_TTL_MS,
  });
}

function memoryDelete(guestSessionId) {
  memoryStore.delete(guestSessionId);
}

function memoryTouch(guestSessionId) {
  const entry = memoryStore.get(guestSessionId);
  if (entry) {
    entry.expiresAt = Date.now() + GUEST_SESSION_TTL_MS;
  }
}

function memoryGetIndex(anonymousId, assistantKey) {
  pruneExpiredMemory();
  const entry = memoryIndex.get(indexKey(anonymousId, assistantKey));
  if (!entry) return [];
  if (entry.expiresAt <= Date.now()) {
    memoryIndex.delete(indexKey(anonymousId, assistantKey));
    return [];
  }
  return entry.entries;
}

function memorySetIndex(anonymousId, assistantKey, entries) {
  logMemoryFallbackOnce();
  memoryIndex.set(indexKey(anonymousId, assistantKey), {
    entries,
    expiresAt: Date.now() + GUEST_SESSION_TTL_MS,
  });
}

function indexEntryFromSession(session, guestSessionId) {
  return {
    guestSessionId,
    title: session.title || "Guest chat",
    startedOn: session.startedOn,
    endedOn: session.endedOn,
    updatedAt: session.updatedAt || session.startedOn,
  };
}

async function readIndex(anonymousId, assistantKey) {
  const redis = await getRedisClient();
  const iKey = indexKey(anonymousId, assistantKey);
  if (redis) {
    const raw = await redis.get(iKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (!useMemoryFallback()) return [];
  return memoryGetIndex(anonymousId, assistantKey);
}

async function writeIndex(anonymousId, assistantKey, entries) {
  const redis = await getRedisClient();
  const iKey = indexKey(anonymousId, assistantKey);
  if (redis) {
    await redis.set(iKey, JSON.stringify(entries), {
      EX: GUEST_SESSION_TTL_SEC,
    });
    return;
  }
  if (!useMemoryFallback()) {
    throw new Error("REDIS_URL is not configured");
  }
  memorySetIndex(anonymousId, assistantKey, entries);
}

/**
 * Register or update a session in the per-user per-assistant index.
 */
export async function registerGuestSessionInIndex(guestSessionId, session) {
  if (!session?.anonymousId || !session?.assistantKey) return;
  const entries = await readIndex(session.anonymousId, session.assistantKey);
  const next = indexEntryFromSession(session, guestSessionId);
  const filtered = entries.filter((e) => e.guestSessionId !== guestSessionId);
  filtered.push(next);
  filtered.sort(
    (a, b) =>
      new Date(b.updatedAt || b.startedOn || 0).getTime() -
      new Date(a.updatedAt || a.startedOn || 0).getTime()
  );
  await writeIndex(session.anonymousId, session.assistantKey, filtered);
}

async function removeGuestSessionFromIndex(guestSessionId, session) {
  if (!session?.anonymousId || !session?.assistantKey) return;
  const entries = await readIndex(session.anonymousId, session.assistantKey);
  const filtered = entries.filter((e) => e.guestSessionId !== guestSessionId);
  await writeIndex(session.anonymousId, session.assistantKey, filtered);
}

/**
 * Rebuild index entries from stored session documents when the index is missing
 * (e.g. legacy sessions or index TTL drift).
 */
async function discoverGuestSessionsForUser(anonymousId, assistantKey) {
  const discovered = [];
  const redis = await getRedisClient();

  if (redis) {
    try {
      for await (const key of redis.scanIterator({
        MATCH: `${KEY_PREFIX}*`,
        COUNT: 100,
      })) {
        const guestSessionId = String(key).replace(KEY_PREFIX, "");
        const full = await getGuestSessionFromRedis(redis, guestSessionId);
        if (
          !full ||
          full.anonymousId !== anonymousId ||
          full.assistantKey !== assistantKey
        ) {
          continue;
        }
        discovered.push(indexEntryFromSession(full, guestSessionId));
      }
    } catch (err) {
      console.warn("[guest] session discovery scan failed:", err.message);
    }
  } else if (useMemoryFallback()) {
    pruneExpiredMemory();
    for (const [guestSessionId, entry] of memoryStore) {
      const full = entry.state;
      if (
        full?.anonymousId === anonymousId &&
        full?.assistantKey === assistantKey
      ) {
        discovered.push(indexEntryFromSession(full, guestSessionId));
      }
    }
  }

  if (discovered.length > 0) {
    discovered.sort(
      (a, b) =>
        new Date(b.updatedAt || b.startedOn || 0).getTime() -
        new Date(a.updatedAt || a.startedOn || 0).getTime()
    );
    await writeIndex(anonymousId, assistantKey, discovered);
  }

  return discovered;
}

async function getGuestSessionFromRedis(redis, guestSessionId) {
  const raw = await redis.get(sessionKey(guestSessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * All guest sessions for this browser guest (any use-case), newest first.
 * @returns {Promise<object[]>}
 */
export async function listAllGuestSessionsForAnonymous(anonymousId) {
  const discovered = [];
  const seen = new Set();
  const redis = await getRedisClient();

  if (redis) {
    try {
      for await (const key of redis.scanIterator({
        MATCH: `${KEY_PREFIX}*`,
        COUNT: 100,
      })) {
        const guestSessionId = String(key).replace(KEY_PREFIX, "");
        if (seen.has(guestSessionId)) continue;
        const full = await getGuestSessionFromRedis(redis, guestSessionId);
        if (!full || full.anonymousId !== anonymousId) continue;
        seen.add(guestSessionId);
        discovered.push(indexEntryFromSession(full, guestSessionId));
        registerGuestSessionInIndex(guestSessionId, full).catch(() => {});
      }
    } catch (err) {
      console.warn("[guest] list-all scan failed:", err.message);
    }
  } else if (useMemoryFallback()) {
    pruneExpiredMemory();
    for (const [guestSessionId, entry] of memoryStore) {
      const full = entry.state;
      if (full?.anonymousId === anonymousId) {
        if (!seen.has(guestSessionId)) {
          seen.add(guestSessionId);
          discovered.push(indexEntryFromSession(full, guestSessionId));
        }
      }
    }
  }

  const results = [];
  for (const entry of discovered) {
    const full = await getGuestSession(entry.guestSessionId);
    if (!full || full.anonymousId !== anonymousId) continue;
    results.push({
      guestSessionId: entry.guestSessionId,
      assistantKey: full.assistantKey,
      title: full.title || entry.title,
      startedOn: full.startedOn,
      endedOn: full.endedOn,
      updatedAt: full.updatedAt || full.startedOn,
      isPaid: !!full.isPaid,
    });
  }

  results.sort(
    (a, b) =>
      new Date(b.updatedAt || b.startedOn || 0).getTime() -
      new Date(a.updatedAt || a.startedOn || 0).getTime()
  );
  return results;
}

/**
 * List non-expired guest session summaries for sidebar.
 * @returns {Promise<object[]>}
 */
export async function listGuestSessionsForUser(anonymousId, assistantKey) {
  let entries = await readIndex(anonymousId, assistantKey);
  if (entries.length === 0) {
    entries = await discoverGuestSessionsForUser(anonymousId, assistantKey);
  }

  const results = [];
  const seen = new Set();

  for (const entry of entries) {
    const full = await getGuestSession(entry.guestSessionId);
    if (!full) continue;
    if (full.anonymousId !== anonymousId || full.assistantKey !== assistantKey) {
      continue;
    }
    seen.add(entry.guestSessionId);
    results.push({
      guestSessionId: entry.guestSessionId,
      title: full.title || entry.title,
      startedOn: full.startedOn,
      endedOn: full.endedOn,
      updatedAt: full.updatedAt || full.startedOn,
      isPaid: !!full.isPaid,
    });
    await registerGuestSessionInIndex(entry.guestSessionId, full);
  }

  if (results.length === 0) {
    const discovered = await discoverGuestSessionsForUser(
      anonymousId,
      assistantKey
    );
    for (const entry of discovered) {
      if (seen.has(entry.guestSessionId)) continue;
      const full = await getGuestSession(entry.guestSessionId);
      if (!full) continue;
      seen.add(entry.guestSessionId);
      results.push({
        guestSessionId: entry.guestSessionId,
        title: full.title || entry.title,
        startedOn: full.startedOn,
        endedOn: full.endedOn,
        updatedAt: full.updatedAt || full.startedOn,
        isPaid: !!full.isPaid,
      });
    }
  }

  results.sort(
    (a, b) =>
      new Date(b.updatedAt || b.startedOn || 0).getTime() -
      new Date(a.updatedAt || a.startedOn || 0).getTime()
  );
  return results;
}

/**
 * @param {string} guestSessionId
 * @param {object} state Serializable guest session document
 */
export async function putGuestSession(guestSessionId, state) {
  const now = new Date().toISOString();
  state.updatedAt = now;
  if (!state.guestSessionId) {
    state.guestSessionId = guestSessionId;
  }

  const redis = await getRedisClient();
  if (redis) {
    await redis.set(sessionKey(guestSessionId), JSON.stringify(state), {
      EX: GUEST_SESSION_TTL_SEC,
    });
    await registerGuestSessionInIndex(guestSessionId, state);
    return;
  }
  if (!useMemoryFallback()) {
    throw new Error("REDIS_URL is not configured");
  }
  memoryPut(guestSessionId, state);
  await registerGuestSessionInIndex(guestSessionId, state);
}

/**
 * @param {string} guestSessionId
 * @returns {Promise<object | null>}
 */
export async function getGuestSession(guestSessionId) {
  const redis = await getRedisClient();
  let session = null;
  if (redis) {
    session = await getGuestSessionFromRedis(redis, guestSessionId);
  } else if (useMemoryFallback()) {
    session = memoryGet(guestSessionId);
  }
  if (session?.anonymousId && session?.assistantKey) {
    registerGuestSessionInIndex(guestSessionId, session).catch((err) => {
      console.warn("[guest] index repair failed:", err.message);
    });
  }
  return session;
}

export async function touchGuestSessionTtl(guestSessionId) {
  const redis = await getRedisClient();
  if (redis) {
    await redis.expire(sessionKey(guestSessionId), GUEST_SESSION_TTL_SEC);
    return;
  }
  if (useMemoryFallback()) memoryTouch(guestSessionId);
}

export async function deleteGuestSession(guestSessionId) {
  const existing = await getGuestSession(guestSessionId);
  const redis = await getRedisClient();
  if (redis) {
    await redis.del(sessionKey(guestSessionId));
    if (existing) {
      await removeGuestSessionFromIndex(guestSessionId, existing);
    }
    return;
  }
  if (useMemoryFallback()) {
    memoryDelete(guestSessionId);
    if (existing) {
      await removeGuestSessionFromIndex(guestSessionId, existing);
    }
  }
}

/** @returns {Promise<boolean>} */
export async function markGuestSessionPaid(guestSessionId) {
  const session = await getGuestSession(guestSessionId);
  if (!session) return false;
  session.isPaid = true;
  await putGuestSession(guestSessionId, session);
  return true;
}
