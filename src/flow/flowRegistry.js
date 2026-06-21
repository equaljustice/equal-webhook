import fs from "fs/promises";
import path from "path";
import { validateFlow } from "./flowValidator.js";

const flowCache = new Map();
const contentCache = new Map();

function flowsDir() {
  return path.resolve(process.cwd(), "assets", "flows");
}

function flowFilePath(assistantKey, version = 1) {
  return path.join(flowsDir(), `${assistantKey}_v${version}.flow.json`);
}

function contentFilePath(assistantKey, version = 1) {
  return path.join(flowsDir(), `${assistantKey}_v${version}.content.json`);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

/**
 * Load manifest of assistants enabled for flow orchestration.
 * @returns {Promise<string[]>}
 */
export async function loadFlowManifest() {
  try {
    const manifestPath = path.join(flowsDir(), "manifest.json");
    const data = await readJson(manifestPath);
    return Array.isArray(data.enabled) ? data.enabled : [];
  } catch {
    return [];
  }
}

/**
 * Whether this assistant should use the flow orchestrator.
 */
export async function isFlowOrchestratorEnabled(assistant) {
  if (assistant?.config?.useFlowOrchestrator === true) return true;
  if (assistant?.config?.useFlowOrchestrator === false) return false;
  if (process.env.FLOW_ORCHESTRATOR_ENABLED === "true") {
    const manifest = await loadFlowManifest();
    return manifest.includes(assistant?.key);
  }
  return false;
}

/**
 * @returns {Promise<{ flow: object, content: object } | null>}
 */
export async function loadFlowBundle(assistantKey, version = 1) {
  const cacheKey = `${assistantKey}:v${version}`;
  if (flowCache.has(cacheKey)) {
    return flowCache.get(cacheKey);
  }

  const flowPath = flowFilePath(assistantKey, version);
  const contentPath = contentFilePath(assistantKey, version);

  try {
    const [flow, content] = await Promise.all([
      readJson(flowPath),
      readJson(contentPath),
    ]);
    const { valid, errors } = validateFlow(flow);
    if (!valid) {
      console.error(
        `[FlowRegistry] Invalid flow ${assistantKey} v${version}:`,
        errors
      );
      return null;
    }
    const bundle = { flow, content };
    flowCache.set(cacheKey, bundle);
    return bundle;
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`[FlowRegistry] Failed to load flow for ${assistantKey}:`, err.message);
    }
    return null;
  }
}

export function clearFlowCache() {
  flowCache.clear();
  contentCache.clear();
}
