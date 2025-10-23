import { ComputationController } from "../src/controllers/Computation";

describe("ComputationController.calculateQualityScore", () => {
  it("should give higher score for well-structured, professional text", () => {
    const text =
      "Our innovative and professional solution offers an efficient experience. It is seamless and effective!";
    const score = ComputationController.calculateQualityScore(text);

    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should reduce score for very short text", () => {
    const score = ComputationController.calculateQualityScore("Too short!");
    expect(score).toBeLessThan(70);
  });

  it("should reduce score for all-caps shouting", () => {
    const score = ComputationController.calculateQualityScore("HELLO WORLD");
    expect(score).toBeLessThan(70);
  });

  it("should penalize for too many exclamation marks", () => {
    const text = "This is amazing!!! Incredible!!! Wow!!! Unbelievable!!!";
    const score = ComputationController.calculateQualityScore(text);
    expect(score).toBeLessThan(70);
  });

  it("should handle empty string", () => {
    const score = ComputationController.calculateQualityScore("");
    expect(score).toBe(60);
  });

  it("should cap the score at 100 and not exceed it", () => {
    const longProText =
      "Our innovative professional seamless efficient experience solution is perfect. ".repeat(
        20
      );
    const score = ComputationController.calculateQualityScore(longProText);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should floor the score at 0 and not go negative", () => {
    const badText = "!!!!!!!".repeat(100);
    const score = ComputationController.calculateQualityScore(badText);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
