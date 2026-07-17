export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function toClientMessage(error: unknown, fallback: string) {
  if (error instanceof UserFacingError) {
    return error.message;
  }

  console.error(error);
  return fallback;
}
