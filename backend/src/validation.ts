const VALID_PRONOUNS = ['he', 'she', 'they', 'he/him', 'she/her', 'they/them'];

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
  // traits can be an array of 3 strings or a single string
  if (Array.isArray(body.traits)) {
    if (body.traits.length !== 3 || !body.traits.every((t: unknown) => typeof t === 'string' && t.length > 0 && t.length <= 50)) {
      return 'Invalid "traits": must be an array of exactly 3 non-empty strings (max 50 chars each)';
    }
  } else if (typeof body.traits !== 'string' || body.traits.length === 0 || body.traits.length > 50) {
    return 'Invalid or missing "traits": must be 3 strings (max 50 chars each) or a single string';
  }
  if (typeof body.petty_level !== 'number' || body.petty_level < 1 || body.petty_level > 10 || !Number.isFinite(body.petty_level)) {
    return 'Invalid or missing "petty_level": must be a number between 1 and 10';
  }
  if (body.pronouns !== undefined) {
    if (typeof body.pronouns !== 'string' || !VALID_PRONOUNS.includes(body.pronouns)) {
      return 'Invalid "pronouns": must be one of "he", "she", "they"';
    }
  }
  return null;
}

const VALID_AGENT_IDS = ['clive', 'frontperson', 'journalist', 'ex_member'];

/**
 * Validates the request body for the /api/escalate endpoint.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateEscalateRequest(body: any): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  // history: required array, max 200 items
  if (!Array.isArray(body.history)) {
    return 'Invalid or missing "history": must be an array';
  }
  if (body.history.length > 200) {
    return 'Invalid "history": max 200 items';
  }
  for (let i = 0; i < body.history.length; i++) {
    const item = body.history[i];
    if (!item || typeof item !== 'object') {
      return `Invalid "history[${i}]": must be an object`;
    }
    if (typeof item.agent !== 'string' || !VALID_AGENT_IDS.includes(item.agent)) {
      return `Invalid "history[${i}].agent": must be a valid agent id`;
    }
    if (typeof item.content !== 'string' || item.content.length === 0 || item.content.length > 2000) {
      return `Invalid "history[${i}].content": must be a non-empty string with max length 2000`;
    }
    if (typeof item.agent_display_name !== 'string' || item.agent_display_name.length === 0) {
      return `Invalid "history[${i}].agent_display_name": must be a non-empty string`;
    }
  }

  // drama_level: required, 1-100
  if (typeof body.drama_level !== 'number' || !Number.isFinite(body.drama_level) || body.drama_level < 1 || body.drama_level > 100) {
    return 'Invalid or missing "drama_level": must be a number between 1 and 100';
  }

  // session_id: required string, max 100 chars
  if (typeof body.session_id !== 'string' || body.session_id.length === 0 || body.session_id.length > 100) {
    return 'Invalid or missing "session_id": must be a non-empty string with max length 100';
  }

  // band_metadata: optional, but if present validate structure
  if (body.band_metadata !== undefined) {
    if (!body.band_metadata || typeof body.band_metadata !== 'object') {
      return 'Invalid "band_metadata": must be an object';
    }
    if (typeof body.band_metadata.band_name !== 'string') {
      return 'Invalid "band_metadata.band_name": must be a string';
    }
    if (typeof body.band_metadata.genre !== 'string') {
      return 'Invalid "band_metadata.genre": must be a string';
    }
    if (typeof body.band_metadata.pitch !== 'string') {
      return 'Invalid "band_metadata.pitch": must be a string';
    }
  }

  return null;
}
