import { createClient } from "redis";

let client;
let connectPromise;
let connectedLogged = false;

/**
 * @returns {Promise<import("redis").RedisClientType | null>}
 */
export async function getRedisClient() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!client) {
    client = createClient({
      url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 20) {
            console.error("[redis] max reconnect attempts reached");
            return false;
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });
    client.on("error", (err) => {
      console.error("[redis] client error:", err.message);
    });
    client.on("ready", () => {
      if (!connectedLogged) {
        connectedLogged = true;
        console.info("[redis] connected");
      }
    });
    connectPromise = client.connect();
  }
  await connectPromise;
  return client;
}
