/**
 * Biometric (WebAuthn) helpers.
 *
 * Strategy
 * ────────
 * We use the platform authenticator (Face ID / Touch ID / Windows Hello /
 * Android biometric) as a *local unlock gate* on top of the Supabase session
 * that is already persisted in localStorage.
 *
 *  • Enrollment: after a successful password sign-in we create a discoverable
 *    platform credential and remember its id + email locally.
 *  • Unlock: on the auth page, if a credential exists we offer "Login with
 *    Biometrics". A successful `navigator.credentials.get()` proves the user
 *    is the device owner — we then trust the existing persisted session.
 *  • Fallback: any failure (no platform auth, user cancels, session expired)
 *    falls back to the normal email + password flow.
 *
 * We deliberately do NOT store passwords or secret tokens beyond what Supabase
 * already persists. The biometric assertion is the second factor that
 * authorises using the locally stored session.
 */

const STORAGE_KEY = "hd.biometric.v1";
const RP_NAME = "HypeData";

type StoredCredential = {
  credentialId: string; // base64url
  email: string;
  userId: string;
  createdAt: number;
};

function bufToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBuf(s: string): ArrayBuffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function randomChallenge(): ArrayBuffer {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr.buffer;
}

export function biometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials
  );
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!biometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function getStoredCredential(): StoredCredential | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCredential;
  } catch {
    return null;
  }
}

export function clearStoredCredential() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}

export async function enrollBiometric(opts: {
  userId: string;
  email: string;
  displayName?: string;
}): Promise<StoredCredential> {
  if (!biometricSupported()) throw new Error("Biometric authentication is not supported on this device.");

  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(opts.userId),
        name: opts.email,
        displayName: opts.displayName || opts.email,
      },
      challenge: randomChallenge(),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Biometric enrollment was cancelled.");

  const stored: StoredCredential = {
    credentialId: bufToBase64Url(cred.rawId),
    email: opts.email,
    userId: opts.userId,
    createdAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export async function verifyBiometric(): Promise<StoredCredential> {
  const stored = getStoredCredential();
  if (!stored) throw new Error("No biometric credential is set up on this device.");
  if (!biometricSupported()) throw new Error("Biometric authentication is not supported on this device.");

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [
        {
          id: base64UrlToBuf(stored.credentialId),
          type: "public-key",
          transports: ["internal"],
        },
      ],
      userVerification: "required",
      timeout: 60_000,
      rpId: window.location.hostname,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Biometric verification failed.");
  return stored;
}
