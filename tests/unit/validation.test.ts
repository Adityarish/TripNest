import { describe, expect, it } from "vitest";
import { categoryForMime, extractDriveFolderId, filePatchInput, tripInput } from "@/lib/validation/schemas";

describe("Drive root parsing", () => {
  it("extracts a folder id without confusing it with a shared-drive type", () => {
    expect(extractDriveFolderId("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr")).toBe("1AbCdEfGhIjKlMnOpQr");
  });
  it("rejects arbitrary URLs", () => expect(() => extractDriveFolderId("https://example.com/folders/1AbCdEfGhIjKlMnOpQr")).toThrow());
});

describe("trip validation", () => {
  it("accepts omitted optional values from a browser form", () => expect(tripInput.parse({ name: "Ooty", startDate: "2026-10-19", endDate: "", location: "" }).endDate).toBeNull());
  it("rejects backwards date ranges", () => expect(() => tripInput.parse({ name: "Goa", startDate: "2026-12-10", endDate: "2026-12-01" })).toThrow());
});

describe("media categories", () => {
  it.each([["image/heic", "PHOTOS"], ["video/mp4", "VIDEOS"], ["application/pdf", "DOCUMENTS"], ["application/octet-stream", "OTHER"]])("maps %s", (mime, expected) => expect(categoryForMime(mime)).toBe(expected));
  it("accepts an explicit file favorite update", () => expect(filePatchInput.parse({ isFavorite: true })).toEqual({ isFavorite: true }));
});
