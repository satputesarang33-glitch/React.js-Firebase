import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ES modules (import.meta.url = this file's path)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the parent folder (Firebase-1/.env)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

export function connectFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Step 2: read secrets from .env
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  // Step 3: stop early if anything is missing
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase credentials in .env");
    console.error(
      "Need: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
    process.exit(1);
  }

  // Step 4: connect
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log(`Connected to Firebase (${projectId})`);
    return admin.app();
  } catch (error) {
    console.error("Error connecting to Firebase:", error.message);
    process.exit(1);
  }
}

/** Auth service (users, tokens) — call after connectFirebase() */
export const auth = () => admin.auth();

/** Firestore database — call after connectFirebase() */
export const db = () => admin.firestore();


