import { describe, it, expect } from "vitest";
import { ApiError, retryUnlessForbidden } from "./api-client";

describe("retryUnlessForbidden", () => {
  it("does not retry 403 or 404", () => {
    expect(retryUnlessForbidden(0, new ApiError(403, "forbidden"))).toBe(false);
    expect(retryUnlessForbidden(0, new ApiError(404, "not found"))).toBe(false);
  });

  it("retries other errors within the budget", () => {
    expect(retryUnlessForbidden(0, new ApiError(500, "boom"))).toBe(true);
    expect(retryUnlessForbidden(2, new ApiError(500, "boom"))).toBe(true);
    expect(retryUnlessForbidden(3, new ApiError(500, "boom"))).toBe(false);
  });
});
