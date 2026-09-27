import { NotFoundError, ValidationError } from '../../core/errors.js';
import { detectBrand, digitsOnly, validateCardNumber, validateCardholder, validateCvv, validateExpiry } from '../../core/validators.js';
import { db } from '../sources/local/local-db.js';
import { latency, requireUser, stripHidden } from './helpers.js';

const sortCards = (a, b) => Number(b.is_default) - Number(a.is_default) || b.id - a.id;

export function checkNewCard(card) {
  const brand = detectBrand(card?.number);
  const fields = {};
  const numberError = validateCardNumber(card?.number);
  const expiryError = validateExpiry(card?.expiry);
  const cvvError = validateCvv(card?.cvv, brand);
  const nameError = validateCardholder(card?.name);
  if (numberError) fields.number = numberError;
  if (expiryError) fields.expiry = expiryError;
  if (cvvError) fields.cvv = cvvError;
  if (nameError) fields.name = nameError;
  if (Object.keys(fields).length) throw new ValidationError('Invalid card', { fields });
  return {
    cardholder_name: String(card.name).trim(),
    card_last_four: digitsOnly(card.number).slice(-4),
    expiry_date: String(card.expiry).replace(/\s/g, ''),
    brand,
  };
}

export function storeCard(userId, safe, makeDefault = false) {
  const existing = db.filter('payment_cards', (c) => c.user_id === userId);
  const isDefault = makeDefault || existing.length === 0;
  if (isDefault) for (const c of existing) if (c.is_default) db.update('payment_cards', c.id, { is_default: false });
  return db.insert('payment_cards', { user_id: userId, ...safe, is_default: isDefault });
}

export const cardsRepo = {
  async mine() {
    const user = requireUser();
    return db.filter('payment_cards', (c) => c.user_id === user.id).sort(sortCards).map(stripHidden);
  },

  async add(card) {
    const user = requireUser();
    const safe = checkNewCard(card);
    await latency(400);
    return stripHidden(storeCard(user.id, safe, Boolean(card.make_default)));
  },

  async setDefault(id) {
    const user = requireUser();
    const card = db.find('payment_cards', (c) => c.id === Number(id) && c.user_id === user.id);
    if (!card) throw new NotFoundError('Card not found');
    for (const c of db.filter('payment_cards', (x) => x.user_id === user.id)) {
      if (c.is_default !== (c.id === card.id)) db.update('payment_cards', c.id, { is_default: c.id === card.id });
    }
    await latency();
  },

  async remove(id) {
    const user = requireUser();
    const card = db.find('payment_cards', (c) => c.id === Number(id) && c.user_id === user.id);
    if (!card) throw new NotFoundError('Card not found');
    db.remove('payment_cards', card.id);
    if (card.is_default) {
      const next = db.filter('payment_cards', (c) => c.user_id === user.id).sort((a, b) => b.id - a.id)[0];
      if (next) db.update('payment_cards', next.id, { is_default: true });
    }
    await latency();
  },
};
