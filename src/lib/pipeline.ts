import { extractJson } from "./extract-json";
import { mockStream, type MockBehavior, type MockState } from "./anthropic-mock";

export interface GenerateInput {
  /** Drives the mock streaming client (see anthropic-mock.ts). */
  behavior: MockBehavior;
  /** Hands the finished draft to the next pipeline stage. May reject. */
  advanceToNextStage: () => Promise<void>;
  /** Returns true once the draft passes review. Scripted by callers/tests. */
  reviewPasses: (attempt: number) => boolean;
}

export interface GenerateResult {
  status: "ok" | "error";
  attempts: number;
}

const MAX_REVISIONS = 3;

/**
 * Runs one content-generation pass: stream a draft, extract it, revise until it
 * passes review, then hand off to the next stage.
 *
 * This is a faithful (stripped-down) reproduction of the real pipeline — and it
 * ships with three real bugs from that pipeline. Your job is to fix them so the
 * test suite passes. See the README for the symptoms. (Do not edit the tests.)
 */
export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const state: MockState = { calls: 0 };

  // The model call can fail transiently (rate limits) or return a truncated
  // stream. Recover from a small number of such failures before giving up.
  let text: string | undefined;
  for (let streamAttempt = 0; streamAttempt < MAX_REVISIONS; streamAttempt += 1) {
    try {
      text = await mockStream(input.behavior, state);
      extractJson(text);
      break;
    } catch {
      if (streamAttempt === MAX_REVISIONS - 1) {
        return { status: "error", attempts: 0 };
      }
    }
  }

  if (!text) {
    return { status: "error", attempts: 0 };
  }

  // Revise until the draft passes review, but stop after a bounded number of
  // attempts so a stale draft does not spin forever.
  let attempt = 0;
  let reviewPassed = false;
  while (attempt < MAX_REVISIONS) {
    reviewPassed = input.reviewPasses(attempt);
    if (reviewPassed) {
      break;
    }
    attempt += 1;
  }

  if (!reviewPassed) {
    return { status: "error", attempts: attempt };
  }

  try {
    await input.advanceToNextStage();
    return { status: "ok", attempts: attempt };
  } catch {
    return { status: "error", attempts: attempt };
  }
}

export { MAX_REVISIONS };
