import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: { emailVerified: true, reload: vi.fn() },
  remove: vi.fn(),
  callable: vi.fn(),
  appCheck: vi.fn(),
}));
vi.mock("firebase/app", () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: mocks.user }),
  connectAuthEmulator: vi.fn(),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserSessionPersistence: {},
  deleteUser: mocks.remove,
}));
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: mocks.callable,
}));
vi.mock("firebase/app-check", () => ({
  initializeAppCheck: mocks.appCheck,
  ReCaptchaEnterpriseProvider: vi.fn(),
}));
import { call, configured, freeDeployment } from "../src/services/firebase.js";
const input = {
  requestId: "3a265a77-c79c-4d99-b052-fb4d63e42396",
  text: "Urgent! Send your password immediately or your account will be suspended.",
  source: "message",
  language: "en",
  interaction: "none",
  confirmed: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.emailVerified = true;
});
describe("browser-based free deployment", () => {
  it("uses public configuration without App Check or server setup", () => {
    expect(configured).toBe(true);
    expect(freeDeployment).toBe(true);
    expect(mocks.appCheck).not.toHaveBeenCalled();
  });
  it("checks text locally with real rules and no callable", async () => {
    const result = await call("analyzeMessage", input);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(mocks.callable).not.toHaveBeenCalled();
  });
  it("rejects unverified accounts in app flow", async () => {
    mocks.user.emailVerified = false;
    await expect(call("analyzeMessage", input)).rejects.toMatchObject({
      details: { code: "EMAIL_NOT_VERIFIED" },
    });
  });
  it("validates local input", async () => {
    await expect(
      call("analyzeMessage", { ...input, text: "short" }),
    ).rejects.toMatchObject({ details: { code: "INVALID_INPUT" } });
  });
  it("does not create server profiles", async () => {
    await expect(call("ensureProfile", {})).resolves.toEqual({
      status: "active",
    });
    expect(mocks.callable).not.toHaveBeenCalled();
  });
  it("deletes the current Firebase account through its authenticated client", async () => {
    await expect(call("deleteAccount", {})).resolves.toEqual({
      status: "deleted",
    });
    expect(mocks.remove).toHaveBeenCalledWith(mocks.user);
  });
});
