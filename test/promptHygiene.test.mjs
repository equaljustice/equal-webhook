// Prompt hygiene: rebrand, today's date, no-leak rule; off unless the flag is set.
// Run: node --test test/promptHygiene.test.mjs
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { applyPromptHygiene, rebrandPromptText, todayInIndia } from "../src/chat/promptHygiene.js";

const prev = process.env.JOLLYJI_PROMPT_HYGIENE;
afterEach(() => {
  if (prev === undefined) delete process.env.JOLLYJI_PROMPT_HYGIENE;
  else process.env.JOLLYJI_PROMPT_HYGIENE = prev;
});

test("flag off: prompt is returned untouched", () => {
  delete process.env.JOLLYJI_PROMPT_HYGIENE;
  const t = "Write to equal@equaljustice.ai";
  assert.equal(applyPromptHygiene(t), t);
});

test("rebrand: emails, links and the name", () => {
  const out = rebrandPromptText(
    "Write to equal@equaljustice.ai or employment@equaljustice.ai. Visit www.equaljustice.ai. " +
      "Draft at https://www.equaljustice.ai/dashboard/draft-will]. Your EqualJustice account. EqualJustice.ai"
  );
  assert.doesNotMatch(out, /equaljustice/i);
  assert.match(out, /askjolly@jollyji\.in or askjolly@jollyji\.in/);
  assert.match(out, /Visit www\.jollyji\.in\./);
  assert.match(out, /https:\/\/jollyji\.in\/chat\/create_my_will\]/);
  assert.match(out, /Your JollyJi account/);
});

test("flag on: today's date (India) and the no-leak rule are appended", () => {
  process.env.JOLLYJI_PROMPT_HYGIENE = "true";
  const now = new Date("2026-10-30T20:00:00Z"); // 31 Oct in India
  const out = applyPromptHygiene("Base prompt", { now });
  assert.equal(todayInIndia(now), "31 October 2026");
  assert.match(out, /^Base prompt/);
  assert.match(out, /Today's date is 31 October 2026/);
  assert.match(out, /Never show it to the user/);
});

test("every shipped prompt is fully rebranded", () => {
  const dir = path.resolve("assets/prompts");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".txt"))) {
    const out = rebrandPromptText(fs.readFileSync(path.join(dir, f), "utf-8"));
    assert.doesNotMatch(out, /equal\s?justice/i, f);
  }
});
