// Offline harness: drives the real handleChatTurn (legacy Gemini path) with the
// network-touching modules (Gemini, prompt store, instruction cache, flow
// registry) replaced by node:test module mocks. Requires
// `node --test --experimental-test-module-mocks`.
import { mock } from "node:test";

const DEFAULT_ROOT = new URL("../../", import.meta.url);

/** Scripted model replies, consumed one per turn. */
const script = [];

export function queueModelReply(text) {
  script.push(text);
}

export async function loadOrchestrator(root = DEFAULT_ROOT) {
  const at = (p) => new URL(p, root).href;

  mock.module(at("src/utils/promptManager.js"), {
    namedExports: { readPromptFile: async () => "SYSTEM PROMPT (test)" },
  });
  mock.module(at("src/chat/geminiInstructionCache.js"), {
    namedExports: {
      isInstructionCacheEnabled: () => false,
      getOrCreateInstructionCache: async () => null,
    },
  });
  mock.module(at("src/flow/flowRegistry.js"), {
    namedExports: {
      isFlowOrchestratorEnabled: async () => false,
      loadFlowBundle: async () => null,
    },
  });
  mock.module(at("src/chat/guestSignupOffer.js"), {
    namedExports: { buildGuestGeminiSystemInstruction: async () => "GUEST (test)" },
  });
  mock.module(at("src/chat/geminiChat.js"), {
    namedExports: {
      buildFinalGenerationUserMessage: (_s, m) => m,
      buildLegacyGeminiContents: ({ userMessage }) => [
        { role: "user", parts: [{ text: userMessage }] },
      ],
      buildGeminiHistory: () => [],
      streamGeminiChat: async ({ onChunk }) => {
        const text = script.shift();
        if (text === undefined) throw new Error("no scripted model reply");
        let full = "";
        for (let i = 0; i < text.length; i += 64) {
          const piece = text.slice(i, i + 64);
          full += piece;
          if (typeof onChunk === "function") onChunk(piece, full);
        }
        return full;
      },
    },
  });

  return import(at("src/chat/chatOrchestrator.js"));
}

export const MARRIAGE_ASSISTANT = {
  key: "marriage-gift-planning",
  config: { systemInstructionAsset: "assets/prompts/marrige_planning.txt" },
};

export const DEFAULT_JSON =
  '{"session_terminated": false, "termination_message": null, "payment_required": false, "batch_form": false, "multi_select": false, "upload_required": false, "upload_type": null, "upload_reason": null}';
export const PAYMENT_JSON = DEFAULT_JSON.replace(
  '"payment_required": false',
  '"payment_required": true'
);

export const DOCUMENT_BODY = `<strong>GIFT DECLARATION</strong><br>${"I, the undersigned, declare that the gift described below was made voluntarily and without any demand. ".repeat(18)}`;

/** Session state right after the paid advice (cycle 0) was produced and saved. */
export function sessionAfterDeliverable(phase = "final_output_generated") {
  return {
    _id: "sess-test",
    assistantKey: "marriage-gift-planning",
    price: 499,
    additionalPrice: 199,
    isPaid: true,
    paymentGateShown: true,
    paymentCycle: 0,
    qaPhase: phase,
    finalDocumentData: { title: "advice" },
    selectedLanguage: "en",
    languageConfirmedByUser: true,
    messages: [
      { role: "assistant", content: "<strong>SIMPLE SUMMARY</strong> ... advice ..." },
    ],
  };
}

/** One turn; returns { result, chunks } with every SSE token the client would see. */
export async function runTurn(orch, { session, userMessage, modelReply, assistant = MARRIAGE_ASSISTANT }) {
  queueModelReply(modelReply);
  const chunks = [];
  const result = await orch.handleChatTurn({
    session,
    assistant,
    userMessage,
    onStreamChunk: (_c, display) => chunks.push(display),
  });
  return { result, chunks };
}
