// @vitest-environment jsdom
import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { Checker, Report } from "../src/features/Checker.jsx";
import { analyze } from "../functions/src/analysis/engine.js";
const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  clearSession: vi.fn(),
  logout: vi.fn(async () => {}),
}));
vi.mock("../src/app/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: { emailVerified: true },
    clearSession: mocks.clearSession,
    logout: mocks.logout,
  }),
}));
vi.mock("../src/services/firebase.js", () => ({
  call: mocks.call,
  errorMessage: () => "A recoverable error",
  emulator: false,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const setup = () =>
  render(
    <MemoryRouter>
      <Checker />
    </MemoryRouter>,
  );
it("discards a response after clear", async () => {
  let resolve;
  mocks.call.mockImplementation(() => new Promise((r) => (resolve = r)));
  setup();
  fireEvent.change(
    screen.getByLabelText("Suspicious message", { exact: false }),
    { target: { value: "Urgent: send your OTP immediately." } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Check message" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear", exact: true }));
  resolve(
    analyze({
      requestId: "11111111-1111-4111-8111-111111111111",
      text: "Urgent: send your OTP immediately.",
      language: "en",
      interaction: "none",
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Check message" })).toBeEnabled(),
  );
  expect(
    screen.queryByRole("region", { name: "Check results" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("");
});
it("invalidates a result on edit and focuses result heading", async () => {
  mocks.call.mockImplementation(async (name, data) => analyze(data));
  setup();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Urgent: send your OTP immediately." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check message" }));
  const title = await screen.findByRole("heading", {
    name: "Significant warning signs",
  });
  expect(title).toHaveFocus();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Team meeting tomorrow at 10 am." },
  });
  expect(
    screen.queryByRole("heading", { name: "Significant warning signs" }),
  ).not.toBeInTheDocument();
});
it("renders user HTML as text", () => {
  const text = "Please share your OTP <img src=x onerror=alert(1)> now";
  const report = analyze({
    requestId: "11111111-1111-4111-8111-111111111111",
    text,
    language: "en",
    interaction: "none",
  });
  report.warnings[0].evidence[0].quote = "<img src=x onerror=alert(1)>";
  const { container } = render(
    <Report
      report={report}
      interaction="none"
      onInteraction={() => {}}
      onClear={() => {}}
    />,
  );
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
});
it("requires screenshot text confirmation", () => {
  setup();
  fireEvent.click(screen.getByRole("tab", { name: "Upload screenshot" }));
  expect(screen.getByRole("button", { name: "Check message" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Urgent: send your OTP immediately." },
  });
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "I reviewed this text and confirmed its language.",
    }),
  );
  expect(screen.getByRole("button", { name: "Check message" })).toBeEnabled();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "New message tomorrow at 10 am." },
  });
  expect(screen.getByRole("button", { name: "Check message" })).toBeDisabled();
});

it("clears sensitive state and signs out an expired session", async () => {
  mocks.call.mockRejectedValue({ details: { code: "UNAUTHENTICATED" } });
  setup();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Urgent: send your OTP immediately." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check message" }));
  await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
  expect(mocks.clearSession).toHaveBeenCalledOnce();
});
