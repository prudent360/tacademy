export const MIN_PASSWORD_LENGTH = 10;

/** Returns a problem with a password, or null if it is acceptable. */
export function passwordProblem(password: string, label = "Password"): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `${label} must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 200) return `${label} is too long.`;
  if (/^(.)\1+$/.test(password)) return `${label} must not repeat a single character.`;
  return null;
}
