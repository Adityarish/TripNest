import { describe, expect, it } from "vitest";
import { humanBytes, safeFilename, tripFolderName } from "@/lib/storage-utils";

describe("storage naming", () => {
  it("never places path separators in provider names", () => expect(safeFilename("../../Goa/video.mov")).toBe(".._.._Goa_video.mov"));
  it("uses the required human-readable trip folder format", () => expect(tripFolderName("Ooty", new Date("2026-10-19T00:00:00Z"))).toBe("Ooty — 2026-10-19"));
  it("formats original byte sizes", () => expect(humanBytes(1048576n)).toBe("1.0 MB"));
});
