import { validationError } from "../lib/errors";

const PASSWORD_HASH_ITERATIONS = 210_000;
const PASSWORD_HASH_LENGTH = 32;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function assertPasswordStrength(password: string): void {
  if (password.trim().length < 8) {
    throw validationError("password must be at least 8 characters long");
  }
}

export function generatePasswordSalt(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  assertPasswordStrength(password);
  const saltBytes = base64ToBytes(salt);

  const importedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: PASSWORD_HASH_ITERATIONS,
    },
    importedKey,
    PASSWORD_HASH_LENGTH * 8
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password, salt);
  return passwordHash === expectedHash;
}

export function generateSessionToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(sessionToken: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sessionToken)
  );

  return bytesToBase64(new Uint8Array(digest));
}
