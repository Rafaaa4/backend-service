/**
 * Content filter to detect and mask contact info (phones, emails, external links)
 * before booking confirmation to prevent platform bypass.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
// Matches international and Tunisian phone patterns (8 digits, +216, spaced digits, spelled-out numbers)
const PHONE_REGEX = /(\+?216[ -]?)?[2-9][0-9]{7}|(\d[ -]?){8,11}/g;
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|tn|org|net|io|me|fr)[^\s]*)/gi;

/**
 * Filter and mask contact information from chat text
 * @param {string} content 
 * @returns {{ sanitized: string, hasContactInfo: boolean }}
 */
export const filterChatContent = (content) => {
  if (!content || typeof content !== 'string') {
    return { sanitized: '', hasContactInfo: false };
  }

  let hasContactInfo = false;
  let sanitized = content;

  if (EMAIL_REGEX.test(sanitized)) {
    hasContactInfo = true;
    sanitized = sanitized.replace(EMAIL_REGEX, '[CONTACT MASQUÉ]');
  }

  if (PHONE_REGEX.test(sanitized)) {
    hasContactInfo = true;
    sanitized = sanitized.replace(PHONE_REGEX, '[NUMÉRO MASQUÉ]');
  }

  if (URL_REGEX.test(sanitized)) {
    hasContactInfo = true;
    sanitized = sanitized.replace(URL_REGEX, '[LIEN MASQUÉ]');
  }

  return { sanitized, hasContactInfo };
};
