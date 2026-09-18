// Live emulator-only callable rejection smoke. Never accepts a production host.
const base = "http://127.0.0.1:5001/demo-scam-shield/us-central1";
for (const name of [
  "analyzeMessage",
  "extractScreenshot",
  "ensureProfile",
  "deleteAccount",
]) {
  const response = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: {} }),
  });
  const body = await response.json();
  if (body.error?.status !== "UNAUTHENTICATED")
    throw Error(`${name}: expected auth rejection`);
  console.log(`${name}: unauthenticated request rejected`);
}
