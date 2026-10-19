// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FileManager } from "@/components/file-manager";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  cleanup();
  refresh.mockClear();
  vi.unstubAllGlobals();
});

describe("FileManager favorites", () => {
  it("replaces the eye action with a persistent favorite and shows it in the trip Favorites tab", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ isFavorite: true }) });
    vi.stubGlobal("fetch", request);

    render(<FileManager
      tripId="11111111-1111-4111-8111-111111111111"
      tripName="Ooty"
      trips={[{ id: "11111111-1111-4111-8111-111111111111", name: "Ooty" }]}
      initialFiles={[{
        id: "22222222-2222-4222-8222-222222222222",
        tripId: "11111111-1111-4111-8111-111111111111",
        name: "lake.jpg",
        mimeType: "image/jpeg",
        sizeBytes: "1024",
        category: "PHOTOS",
        isFavorite: false,
        createdAt: "2026-10-19T00:00:00.000Z",
      }]}
    />);

    expect(screen.queryByTitle("Open file")).toBeNull();
    fireEvent.click(screen.getByTitle("Add to favorites"));

    await waitFor(() => expect(request).toHaveBeenCalledWith(
      "/api/files/22222222-2222-4222-8222-222222222222",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ isFavorite: true }) }),
    ));
    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(screen.getByText("lake.jpg")).toBeTruthy();
    expect(screen.getByTitle("Remove from favorites")).toBeTruthy();
  });
});
