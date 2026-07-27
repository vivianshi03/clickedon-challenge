import { describe, it, expect } from "vitest";
import { generate } from "../lib/pipeline";

describe("Bonus — an edge case worth guarding", () => {
  it("does not hand off to the next stage when review never passes", async () => {
    let handoffCalled = false;

    const res = await generate({
      behavior: "ok",
      advanceToNextStage: async () => {
        handoffCalled = true;
      },
      reviewPasses: () => false,
    });

    expect(res.status).toBe("error");
    expect(handoffCalled).toBe(false);
  });
});
