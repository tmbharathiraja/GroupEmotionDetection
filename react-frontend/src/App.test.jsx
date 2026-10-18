import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { validateFile } from "./App.jsx";

const noFaces = {
  image: { width: 400, height: 300 },
  group: { emotion: "no_faces", agreement: 0, counts: {}, tied: false },
  faces: [],
  elapsed_ms: 50,
  warnings: [],
};
const result = {
  ...noFaces,
  group: {
    emotion: "happy",
    agreement: 1,
    tied: false,
    counts: {
      happy: 1,
      neutral: 0,
      sad: 0,
      angry: 0,
      fear: 0,
      surprise: 0,
      disgust: 0,
    },
  },
  faces: [
    {
      id: 1,
      box: [10, 20, 90, 100],
      emotion: "happy",
      score: 0.87,
      scores: { happy: 0.87 },
    },
  ],
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ status: "ready" }) })),
  );
});

it("requires a valid photo before allowing inference", async () => {
  render(<App />);
  await screen.findByText("Models ready");
  expect(
    screen.getByRole("button", { name: /Analyze group emotion/ }),
  ).toBeDisabled();
  expect(
    validateFile(new File(["x"], "bad.pdf", { type: "application/pdf" })),
  ).toMatch(/JPEG/);
  expect(validateFile({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(
    /10 MB/,
  );
});

it("uploads the chosen file and displays real response fields", async () => {
  const user = userEvent.setup();
  fetch.mockImplementation(async (url) => ({
    ok: true,
    json: async () => (url === "/api/health" ? { status: "ready" } : result),
  }));
  render(<App />);
  await screen.findByText("Models ready");
  const file = new File(["image"], "team.jpg", { type: "image/jpeg" });
  await user.upload(screen.getByLabelText("Upload a group photo"), file);
  await user.click(
    screen.getByRole("button", { name: /Analyze group emotion/ }),
  );
  await screen.findByText("100% of detected faces share this label");
  expect(
    screen.getByRole("button", { name: "Person 1: Happy" }),
  ).toBeInTheDocument();
  const call = fetch.mock.calls.find(([url]) => url === "/api/predict");
  expect(call[1].body.get("file")).toBe(file);
  await user.click(screen.getByLabelText("Remove photo"));
  expect(
    screen.queryByText("100% of detected faces share this label"),
  ).not.toBeInTheDocument();
});

it("shows the no-face state without inventing a group label", async () => {
  fetch.mockImplementation(async (url) => ({
    ok: true,
    json: async () => (url === "/api/health" ? { status: "ready" } : noFaces),
  }));
  render(<App />);
  await screen.findByText("Models ready");
  await userEvent.upload(
    screen.getByLabelText("Upload a group photo"),
    new File(["x"], "photo.png", { type: "image/png" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: /Analyze group emotion/ }),
  );
  expect(
    await screen.findByText("No faces found this time."),
  ).toBeInTheDocument();
});

it("displays backend errors and enables retry", async () => {
  fetch.mockImplementation(async (url) => ({
    ok: url === "/api/health",
    json: async () =>
      url === "/api/health"
        ? { status: "ready" }
        : { detail: "Another photo is being analyzed." },
  }));
  render(<App />);
  await screen.findByText("Models ready");
  await userEvent.upload(
    screen.getByLabelText("Upload a group photo"),
    new File(["x"], "photo.png", { type: "image/png" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: /Analyze group emotion/ }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Another photo is being analyzed.",
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /Analyze group emotion/ }),
    ).toBeEnabled(),
  );
});
