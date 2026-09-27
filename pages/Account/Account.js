import { createAvatar } from '../../components/Avatar/Avatar.js';
import { createBadge, createStatusBadge } from '../../components/Badge/Badge.js';
import { createCardForm } from '../../components/CardForm/CardForm.js';
import { confirmDialog, openDialog } from '../../components/Dialog/Dialog.js';
import { createEmptyState } from '../../components/EmptyState/EmptyState.js';
import { createErrorState } from '../../components/ErrorState/ErrorState.js';
import { createSavedCardItem } from '../../components/SavedCard/SavedCard.js';
import { toast } from '../../components/Toast/Toast.js';
import { boot } from '../../scripts/app.js';
import { h, icon } from '../../scripts/core/dom.js';
import { debounce, on } from '../../scripts/core/events.js';
import { formatCurrency, formatNumber } from '../../scripts/core/format.js';
import { validateForm, validateOnBlur } from '../../scripts/core/forms.js';
import { getParam, replaceParams } from '../../scripts/core/url.js';
import { cardsRepo, ticketsRepo } from '../../scripts/data/index.js';
import { applyTranslations, onLanguageChange, t } from '../../scripts/i18n/i18n.js';
import { kickoffLabel, liveUrl, matchTitle } from '../../scripts/services/match-display.js';

const user = await boot({ page: 'account', access: 'user' });

const $ = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll('[role="tab"]')];

$('avatar').replaceWith(createAvatar(user.username, 'lg'));
$('username').textContent = user.username;
$('email').textContent = user.email;

function selectTab(tab, { focus = false } = {}) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    $(item.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
  replaceParams({ tab: tab.dataset.tab === 'tickets' ? null : tab.dataset.tab });
}

tabs[0].parentElement.addEventListener('keydown', (event) => {
  const index = tabs.indexOf(document.activeElement);
  const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
  if (index < 0 || next === undefined) return;
  event.preventDefault();
  selectTab(tabs[(next + tabs.length) % tabs.length], { focus: true });
});
for (const tab of tabs) tab.addEventListener('click', () => selectTab(tab));
selectTab(tabs.find((tab) => tab.dataset.tab === getParam('tab')) ?? tabs[0]);

function showList(list, items, empty) {
  list.removeAttribute('aria-busy');
  list.replaceChildren(...(items.length ? items : [h('li', null, empty)]));
  applyTranslations(list);
}

function ticketItem({ quantity, price_per_ticket: price, match }) {
  return h('li', { class: 'card ticket-item' },
    h('div', { class: 'ticket-item__main' },
      h('div', { class: 'cluster' }, createStatusBadge(match.status), createBadge({ kind: 'league', text: match.league })),
      h('a', { class: 'h3 ticket-item__title', href: liveUrl(match) }, matchTitle(match)),
      h('ul', { class: 'meta-list', role: 'list' },
        h('li', null, icon('calendar'), kickoffLabel(match, 'full')),
        match.venue && h('li', null, icon('map-pin'), match.venue))),
    h('div', { class: 'ticket-item__side' },
      h('span', { class: 'muted text-sm' }, t('checkout.unitLine', { count: formatNumber(quantity), price: formatCurrency(price) })),
      h('span', { class: 'ticket-item__total num' }, formatCurrency(quantity * price))));
}

async function loadTickets() {
  const list = $('tickets');
  try {
    const tickets = await ticketsRepo.mine();
    const action = h('a', { class: 'btn btn--primary', 'data-route': 'tickets', 'data-i18n': 'nav.buyTickets' });
    showList(list, tickets.map(ticketItem),
      createEmptyState({ icon: 'ticket', titleKey: 'account.noTicketsTitle', textKey: 'account.noTicketsText', action }));
  } catch (error) {
    showList(list, [], createErrorState({ error, onRetry: loadTickets }));
  }
}

async function removeCard(card) {
  const confirmed = await confirmDialog({
    title: t('account.removeTitle'),
    message: t('account.removeText', { last4: card.card_last_four }),
    confirmLabel: t('account.remove'),
  });
  if (!confirmed) return;
  await cardsRepo.remove(card.id);
  toast('account.cardRemoved', { type: 'success' });
  loadCards();
}

async function makeDefault(card) {
  await cardsRepo.setDefault(card.id);
  toast('account.defaultSet', { type: 'success' });
  loadCards();
}

function cardItem(card) {
  const run = (action) => () => action(card).catch(() => toast('errors.unknown', { type: 'error' }));
  const actions = [
    !card.is_default && h('button', { class: 'btn btn--secondary btn--sm', type: 'button', on: { click: run(makeDefault) } },
      h('span', { 'data-i18n': 'account.setDefault' })),
    h('button', {
      class: 'btn btn--icon btn--sm btn--danger-ghost',
      type: 'button',
      'data-i18n-attr': 'aria-label:account.removeLabel',
      'data-i18n-params': JSON.stringify({ last4: card.card_last_four }),
      on: { click: run(removeCard) },
    }, icon('trash-2')),
  ].filter(Boolean);
  return h('li', null, createSavedCardItem(card, actions));
}

async function loadCards() {
  const list = $('cards');
  try {
    const cards = await cardsRepo.mine();
    showList(list, cards.map(cardItem),
      createEmptyState({ icon: 'credit-card', titleKey: 'account.noCardsTitle', textKey: 'account.noCardsText', compact: true }));
  } catch (error) {
    showList(list, [], createErrorState({ error, onRetry: loadCards }));
  }
}

async function addCard() {
  const cardForm = createCardForm({ withSave: false });
  const result = openDialog({
    title: t('account.addCardTitle'),
    content: cardForm.element,
    submitLabel: t('account.addCard'),
    onSubmit: (form) => (validateForm(form, cardForm.rules) ? cardsRepo.add(cardForm.values()) : false),
  });
  validateOnBlur(cardForm.element.closest('form'), cardForm.rules);
  if (await result) {
    toast('account.cardAdded', { type: 'success' });
    loadCards();
  }
}

$('add-card').addEventListener('click', addCard);
on('data:updated', debounce(loadTickets, 1500));
onLanguageChange(() => {
  loadTickets();
  loadCards();
});
await Promise.all([loadTickets(), loadCards()]);
