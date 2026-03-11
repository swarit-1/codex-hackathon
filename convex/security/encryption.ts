import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { validationError } from "../lib/errors";
import type { JsonObject, JsonValue } from "../types/contracts";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export interface EncryptedPayload {
  algorithm: typeof ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
}

function getEncryptionKey(): Buffer {
  const configuredKey = process.env.BACKEND_ENCRYPTION_KEY;

  if (!configuredKey) {
    throw validationError("BACKEND_ENCRYPTION_KEY is required to encrypt credential vault data");
  }

  return createHash("sha256").update(configuredKey).digest().subarray(0, KEY_LENGTH);
}

export function encryptJsonValue(value: JsonValue): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const plaintext = JSON.stringify(value);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptJsonValue(payload: EncryptedPayload): JsonValue {
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

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

export function encryptCredentialVaultInProfileData(
  profileData?: JsonObject
): JsonObject | undefined {
  if (!profileData) {
    return undefined;
  }

  const cloned: JsonObject = { ...profileData };
  const credentialVault = cloned.credentialVault;

  if (credentialVault !== undefined) {
    cloned._encryptedCredentialVault = encryptJsonValue(credentialVault);
    delete cloned.credentialVault;
  }

  return cloned;
}
