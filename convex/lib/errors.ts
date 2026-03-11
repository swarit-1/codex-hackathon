import type { BackendErrorCode, JsonObject } from "../types/contracts";

export class BackendContractError extends Error {
  code: BackendErrorCode;
  metadata?: JsonObject;

  constructor(code: BackendErrorCode, message: string, metadata?: JsonObject) {
    super(message);
    this.name = "BackendContractError";
    this.code = code;
    this.metadata = metadata;
  }
}

export function createBackendError(
  code: BackendErrorCode,
  message: string,
  metadata?: JsonObject
): BackendContractError {
  return new BackendContractError(code, message, metadata);
}

export function validationError(
  message: string,
  metadata?: JsonObject
): BackendContractError {
  return createBackendError("VALIDATION_ERROR", message, metadata);
}

export function invalidStateError(
  message: string,
  metadata?: JsonObject
): BackendContractError {
  return createBackendError("INVALID_STATE", message, metadata);
}

export function forbiddenError(
  message: string,
  metadata?: JsonObject
): BackendContractError {
  return createBackendError("FORBIDDEN", message, metadata);
}

export function notFoundError(
  message: string,
  metadata?: JsonObject
): BackendContractError {
  return createBackendError("NOT_FOUND", message, metadata);
}

export function rateLimitError(
  message: string,
  metadata?: JsonObject
): BackendContractError {
  return createBackendError("RATE_LIMITED", message, metadata);
}

export function phaseNotImplementedError(
  functionName: string,
  phase: number
): BackendContractError {
  return createBackendError(
    "PHASE_2_NOT_IMPLEMENTED",
    `${functionName} is scaffolded and scheduled for implementation in Phase ${phase}.`,
    {
      functionName,
      phase,
    }
  );
}
