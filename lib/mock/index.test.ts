import { describe, it, expect } from "vitest";
import { mockApi } from "./index";

describe("mockApi.listVenues", () => {
  it("returns the seeded venues", async () => {
    const venues = await mockApi.listVenues();
    expect(venues).toHaveLength(4);
  });
});
