import { createBadge } from '../../components/Badge/Badge.js';
import { createCardForm } from '../../components/CardForm/CardForm.js';
import { createEmptyState } from '../../components/EmptyState/EmptyState.js';
import { createErrorState } from '../../components/ErrorState/ErrorState.js';
import { createQuantityStepper } from '../../components/QuantityStepper/QuantityStepper.js';
import { createNewCardOption, createSavedCardOption } from '../../components/SavedCard/SavedCard.js';
import { mountStepper } from '../../components/Stepper/Stepper.js';
import { boot } from '../../scripts/app.js';
import { h } from '../../scripts/core/dom.js';
import { formatCurrency, formatNumber } from '../../scripts/core/format.js';
import { clearErrors, setBusy, showError, validateForm, validateOnBlur } from '../../scripts/core/forms.js';
import { getParam } from '../../scripts/core/url.js';
import { MAX_TICKETS_PER_ORDER, cardsRepo, matchesRepo, ticketsRepo } from '../../scripts/data/index.js';
import { applyTranslations, hasKey, onLanguageChange, t } from '../../scripts/i18n/i18n.js';
import { kickoffLabel, matchTitle } from '../../scripts/services/match-display.js';

await boot({ page: 'checkout', access: 'user' });

const $ = (id) => document.getElementById(id);
const form = $('checkout-form');
const payButton = $('pay');
const setStep = mountStepper($('stepper'), ['checkout.steps.match', 'checkout.steps.payment', 'checkout.steps.confirmation']);
setStep(1);

let match;
let order = null;
let quantity;
let cardForm;

const maxQuantity = () => Math.min(MAX_TICKETS_PER_ORDER, match.tickets_left);

function showProblem(content) {
  $('checkout-loading').remove();
  $('checkout-problem').replaceChildren(content);
  $('checkout-problem').hidden = false;
}

function problemState(titleKey, textKey, iconName) {
  const action = h('a', { class: 'btn btn--primary', 'data-route': 'tickets', 'data-i18n': 'checkout.chooseMatch' });
  return createEmptyState({ icon: iconName, titleKey, textKey, action });
}

function fillMatchInfo(prefix, m) {
  $(`${prefix}-match`).textContent = matchTitle(m);
  $(`${prefix}-date`).textContent = kickoffLabel(m, 'full');
  if (m.venue) $(`${prefix}-venue`).textContent = m.venue;
  else $(`${prefix}-venue-row`).hidden = true;
}

function renderSummary() {
  $('summary-league').replaceChildren(createBadge({ kind: 'league', text: match.league }));
  fillMatchInfo('summary', match);
}

function renderTotals() {
  const qty = quantity.value;
  const total = formatCurrency(qty * match.ticket_price);
  $('unit-line').textContent = t('checkout.unitLine', { count: formatNumber(qty), price: formatCurrency(match.ticket_price) });
  $('subtotal').textContent = total;
  $('total').textContent = total;
  $('max-note').textContent = t('checkout.maxNote', { count: maxQuantity() });
  $('pay-label').dataset.i18nParams = JSON.stringify({ amount: total });
  applyTranslations($('pay-label'));
}

function renderConfirmation() {
  const { ticket, match: m, total, card } = order;
  const brandKey = `cards.brands.${card.brand}`;
  $('confirm-order').textContent = t('checkout.orderNumber', { id: ticket.id });
  fillMatchInfo('confirm', m);
  $('confirm-quantity').textContent = t('checkout.quantityLine', { count: ticket.quantity });
  $('confirm-card').textContent = t('checkout.paidWith', {
    brand: t(hasKey(brandKey) ? brandKey : 'cards.brands.other'),
    last4: card.card_last_four,
  });
  $('confirm-total').textContent = formatCurrency(total);
}

function renderCards(cards) {
  const list = $('saved-cards');
  list.replaceChildren(
    ...cards.map((card, index) => createSavedCardOption(card, { name: 'card', checked: index === 0 })),
    createNewCardOption({ name: 'card', checked: cards.length === 0 }),
  );
  cardForm = createCardForm();
  $('new-card').append(cardForm.element);
  validateOnBlur(form, cardForm.rules);
  const sync = () => { $('new-card').hidden = form.elements.namedItem('card').value !== 'new'; };
  list.addEventListener('change', () => {
    sync();
    if (!$('new-card').hidden) cardForm.focus();
  });
  sync();
}

async function refreshStock() {
  match = await matchesRepo.get(match.id);
  quantity.setMax(maxQuantity());
  renderTotals();
}

async function pay(event) {
  event.preventDefault();
  if (payButton.disabled) return;
  clearErrors(form);
  const choice = form.elements.namedItem('card').value;
  if (choice === 'new' && !validateForm(form, cardForm.rules)) return;
  setBusy(payButton, true, 'checkout.paying');
  try {
    order = await ticketsRepo.buy({
      match_id: match.id,
      quantity: quantity.value,
      card: choice === 'new' ? cardForm.values() : { saved_card_id: choice },
    });
  } catch (error) {
    setBusy(payButton, false);
    showError(form, error);
    if (error.code === 'not_enough_tickets') refreshStock().catch(() => {});
    return;
  }
  renderConfirmation();
  form.remove();
  $('confirmation').hidden = false;
  setStep(2);
  $('confirm-title').focus();
}

async function load() {
  const id = getParam('match');
  if (!id) return showProblem(problemState('checkout.notFoundTitle', 'checkout.notFoundText', 'ticket'));
  let cards;
  try {
    [match, cards] = await Promise.all([matchesRepo.get(id), cardsRepo.mine()]);
  } catch (error) {
    if (error.code === 'not_found') return showProblem(problemState('checkout.notFoundTitle', 'checkout.notFoundText', 'ticket'));
    return showProblem(createErrorState({ error, onRetry: () => location.reload() }));
  }
  if (match.status !== 'upcoming' || match.tickets_left <= 0) {
    return showProblem(problemState('checkout.unavailableTitle', 'checkout.unavailableText', 'ban'));
  }

  quantity = createQuantityStepper({ value: 1, max: maxQuantity(), labelledBy: 'qty-label', onChange: renderTotals });
  $('qty').append(quantity.element);
  $('pay-label').dataset.i18n = 'checkout.pay';
  renderSummary();
  renderTotals();
  renderCards(cards);
  form.addEventListener('submit', pay);
  $('checkout-loading').remove();
  form.hidden = false;

  onLanguageChange(() => {
    if (order) return renderConfirmation();
    renderSummary();
    renderTotals();
  });
}

await load();
