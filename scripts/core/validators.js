export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function detectBrand(number) {
  const d = digitsOnly(number);
  if (/^4/.test(d)) return 'visa';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(d)) return 'mastercard';
  return 'other';
}

export function luhn(number) {
  const d = digitsOnly(number);
  if (!d) return false;
  let sum = 0;
  let double = false;
  for (let i = d.length - 1; i >= 0; i -= 1) {
    let n = Number(d[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

const LENGTHS = { visa: [13, 16, 19], mastercard: [16], amex: [15], other: [12, 13, 14, 15, 16, 17, 18, 19] };

export function formatCardNumber(value) {
  const brand = detectBrand(value);
  const d = digitsOnly(value).slice(0, brand === 'amex' ? 15 : 19);
  if (brand === 'amex') return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(' ');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function validateCardNumber(value) {
  const d = digitsOnly(value);
  if (!d) return 'validation.cardNumberRequired';
  if (!LENGTHS[detectBrand(d)].includes(d.length)) return 'validation.cardNumberLength';
  if (!luhn(d)) return 'validation.cardNumberInvalid';
  return null;
}

export function formatExpiry(value) {
  const d = digitsOnly(value).slice(0, 4);
  if (d.length === 1 && Number(d) > 1) return `0${d}/`;
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function parseExpiry(value) {
  const m = /^\s*(\d{2})\s*\/\s*(\d{2})\s*$/.exec(String(value ?? ''));
  return m ? { month: Number(m[1]), year: 2000 + Number(m[2]) } : null;
}

export function validateExpiry(value, now = new Date()) {
  if (!String(value ?? '').trim()) return 'validation.expiryRequired';
  const parsed = parseExpiry(value);
  if (!parsed) return 'validation.expiryFormat';
  if (parsed.month < 1 || parsed.month > 12) return 'validation.expiryMonth';
  const endOfMonth = new Date(parsed.year, parsed.month, 1);
  if (endOfMonth <= now) return 'validation.expiryPast';
  if (parsed.year > now.getFullYear() + 20) return 'validation.expiryFormat';
  return null;
}

export function validateCvv(value, brand) {
  const d = digitsOnly(value);
  if (!d) return 'validation.cvvRequired';
  const expected = brand === 'amex' ? 4 : 3;
  if (d.length !== expected || d.length !== String(value).trim().length) return brand === 'amex' ? 'validation.cvvAmex' : 'validation.cvvLength';
  return null;
}

export function validateCardholder(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'validation.cardholderRequired';
  if (v.length < 2 || v.length > 60 || !/^[\p{L}][\p{L}\s'.-]*$/u.test(v)) return 'validation.cardholderInvalid';
  return null;
}

export function validateUsername(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'validation.usernameRequired';
  if (v.length < 3 || v.length > 30) return 'validation.usernameLength';
  if (!/^[A-Za-z0-9_.]+$/.test(v)) return 'validation.usernameChars';
  return null;
}

export function validateEmail(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'validation.emailRequired';
  if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'validation.emailInvalid';
  return null;
}

export function validatePassword(value) {
  const v = String(value ?? '');
  if (!v) return 'validation.passwordRequired';
  if (v.length < 8) return 'validation.passwordLength';
  return null;
}

export function validateRequired(value) {
  return String(value ?? '').trim() ? null : 'validation.required';
}

export function validateOptionalUrl(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  try {
    const url = new URL(v);
    return ['http:', 'https:'].includes(url.protocol) ? null : 'validation.urlInvalid';
  } catch {
    return 'validation.urlInvalid';
  }
}

export function validateInteger(value, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  const v = String(value ?? '').trim();
  if (!v) return optional ? null : 'validation.required';
  if (!/^-?\d+$/.test(v)) return 'validation.wholeNumber';
  const n = Number(v);
  if (n < min || n > max) return 'validation.outOfRange';
  return null;
}

export function validateMoney(value, { optional = false } = {}) {
  const v = String(value ?? '').trim();
  if (!v) return optional ? null : 'validation.required';
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return 'validation.money';
  return null;
}
