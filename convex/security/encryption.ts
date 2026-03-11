import { validationError } from "../lib/errors";
import type { JsonObject, JsonValue } from "../types/contracts";

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

export interface EncryptedPayload {
  algorithm: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

function base64Encode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(): Promise<CryptoKey> {
  const configuredKey = process.env.BACKEND_ENCRYPTION_KEY;

  if (!configuredKey) {
    throw validationError(
      "BACKEND_ENCRYPTION_KEY is required to encrypt credential vault data"
    );
  }

  const keyData = new TextEncoder().encode(configuredKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);

  return crypto.subtle.importKey("raw", hashBuffer, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptJsonValue(
  value: JsonValue
): Promise<EncryptedPayload> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    plaintext
  );

  // AES-GCM appends 16-byte auth tag to ciphertext
  const fullBytes = new Uint8Array(ciphertextBuffer);
  const cipherBytes = fullBytes.slice(0, fullBytes.length - 16);
  const authTag = fullBytes.slice(fullBytes.length - 16);

  return {
    algorithm: ALGORITHM,
    iv: base64Encode(iv),
    authTag: base64Encode(authTag),
    ciphertext: base64Encode(cipherBytes),
  };
}

export async function decryptJsonValue(
  payload: EncryptedPayload
): Promise<JsonValue> {
  const key = await deriveKey();
  const iv = base64Decode(payload.iv);
  const cipherBytes = base64Decode(payload.ciphertext);
  const authTag = base64Decode(payload.authTag);

  // Reconstruct the combined buffer (ciphertext + authTag) that AES-GCM expects
  const combined = new Uint8Array(cipherBytes.length + authTag.length);
  combined.set(cipherBytes);
  combined.set(authTag, cipherBytes.length);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    combined
  );

  const plaintext = new TextDecoder().decode(plainBuffer);
  return JSON.parse(plaintext) as JsonValue;
}

export function sanitizeProfileDataForRead(
  profileData?: JsonObject
): JsonObject | undefined {
  if (!profileData) {
    return undefined;
  }

  const sanitized: JsonObject = { ...profileData };
  const encryptedVault = sanitized._encryptedCredentialVault;

  delete sanitized._encryptedCredentialVault;

  if (encryptedVault) {
    sanitized.hasCredentialVault = true;
  }

  return sanitized;
}

export async function encryptCredentialVaultInProfileData(
  profileData?: JsonObject
): Promise<JsonObject | undefined> {
  if (!profileData) {
    return undefined;
  }

  const cloned: JsonObject = { ...profileData };
  const credentialVault = cloned.credentialVault;

  if (credentialVault !== undefined) {
    delete cloned.credentialVault;
    const encrypted = await encryptJsonValue(credentialVault);
    cloned._encryptedCredentialVault = encrypted as unknown as JsonValue;
  }

  return cloned;
}
