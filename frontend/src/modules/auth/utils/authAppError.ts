// src/common/auth/utils/authAppError.ts
export class AuthAppError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AuthAppError";
    this.code = code;
  }
}
