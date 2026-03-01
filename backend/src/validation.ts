const VALID_PRONOUNS = ['he/him', 'she/her', 'they/them'];

/**
 * Validates the request body for the /api/generate endpoint.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateGenerateRequest(body: any): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 100) {
    return 'Invalid or missing "name": must be a string with max length 100';
  }
  if (typeof body.traits !== 'string' || body.traits.length === 0 || body.traits.length > 50) {
    return 'Invalid or missing "traits": must be a string with max length 50';
  }
  if (typeof body.petty_level !== 'number' || body.petty_level < 1 || body.petty_level > 10 || !Number.isFinite(body.petty_level)) {
    return 'Invalid or missing "petty_level": must be a number between 1 and 10';
  }
  if (body.pronouns !== undefined) {
    if (typeof body.pronouns !== 'string' || !VALID_PRONOUNS.includes(body.pronouns)) {
      return 'Invalid "pronouns": must be one of "he/him", "she/her", "they/them"';
    }
  }
  return null;
}

/**
 * Validates the request body for the /api/escalate endpoint.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateEscalateRequest(body: any): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (!Array.isArray(body.history)) {
    return 'Invalid or missing "history": must be an array';
  }
  if (typeof body.drama_level !== 'number' || !Number.isFinite(body.drama_level)) {
    return 'Invalid or missing "drama_level": must be a number';
  }
  return null;
}
