import { NODE_TYPES, PAYMENT_MODES } from "./flowConstants.js";

/**
 * Validate a flow definition before publish/runtime use.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFlow(flow) {
  const errors = [];

  if (!flow?.flowKey) errors.push("flowKey is required");
  if (!flow?.version) errors.push("version is required");
  if (!flow?.startNodeId) errors.push("startNodeId is required");
  if (!flow?.nodes || typeof flow.nodes !== "object") {
    errors.push("nodes map is required");
    return { valid: false, errors };
  }

  if (!flow.nodes[flow.startNodeId]) {
    errors.push(`startNodeId "${flow.startNodeId}" not found in nodes`);
  }

  if (
    flow.paymentMode &&
    !Object.values(PAYMENT_MODES).includes(flow.paymentMode)
  ) {
    errors.push(`invalid paymentMode: ${flow.paymentMode}`);
  }

  for (const [nodeId, node] of Object.entries(flow.nodes)) {
    if (!node?.type) {
      errors.push(`node "${nodeId}" missing type`);
      continue;
    }

    if (!Object.values(NODE_TYPES).includes(node.type)) {
      errors.push(`node "${nodeId}" has unknown type "${node.type}"`);
    }

    const targets = collectEdgeTargets(node);
    for (const target of targets) {
      if (!flow.nodes[target]) {
        errors.push(`node "${nodeId}" references missing target "${target}"`);
      }
    }

    if (node.type === NODE_TYPES.TERMINATE && (node.next || node.edges)) {
      errors.push(`terminate node "${nodeId}" must not have outgoing edges`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function collectEdgeTargets(node) {
  const targets = new Set();
  if (node.next) targets.add(node.next);
  if (node.edges) {
    for (const v of Object.values(node.edges)) targets.add(v);
  }
  if (node.routes) {
    for (const r of node.routes) {
      if (r.next) targets.add(r.next);
    }
  }
  if (node.defaultNext) targets.add(node.defaultNext);
  return targets;
}
