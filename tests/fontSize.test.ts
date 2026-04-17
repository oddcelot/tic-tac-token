import { describe, expect, it } from "vitest";
import * as schema from "../schema.ts";

describe("fontSize token — deviation from DTCG 2025.10", () => {
  it.fails(
    "gap: the DTCG spec has no `fontSize` type (use `dimension`); schema.ts:75-78 defines one anyway",
    () => {
      expect("FontSize" in schema).toBe(false);
    },
  );
});
