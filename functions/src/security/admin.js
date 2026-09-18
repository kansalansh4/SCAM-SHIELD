// Tests and runtime share the same Admin SDK instance and Firestore value types.
export { initializeApp, deleteApp } from "firebase-admin/app";
export { getAuth } from "firebase-admin/auth";
export { getFirestore, Timestamp } from "firebase-admin/firestore";
