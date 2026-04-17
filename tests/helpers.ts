import { type } from "arktype";

export function isValid(result: unknown): boolean {
  return !(result instanceof type.errors);
}

export function isInvalid(result: unknown): boolean {
  return result instanceof type.errors;
}
