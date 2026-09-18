import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
initializeApp({ projectId: "demo-scam-shield" });
await getFirestore().doc("runtimeConfig/service").set({
  enabled: true,
  ocrEnabled: true,
  dailyOcrCap: 100,
  quotaPolicyVersion: "quota-1.0",
});
console.log("Seeded demo-scam-shield emulator policy only.");
