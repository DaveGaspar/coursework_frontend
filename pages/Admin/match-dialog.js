import { openDialog } from '../../components/Dialog/Dialog.js';
import { h } from '../../scripts/core/dom.js';
import { toDateTimeInputValue } from '../../scripts/core/format.js';
import { MATCH_STATUSES, matchesRepo } from '../../scripts/data/index.js';
import { applyTranslations, t } from '../../scripts/i18n/i18n.js';
import { field, formValues } from './admin.js';

const RESULT_FIELDS = [
  ['home_score', 'admin.matches.homeScore'], ['away_score', 'admin.matches.awayScore'],
  ['attendance', 'admin.matches.attendance'], ['total_fouls', 'admin.matches.fouls'],
  ['yellow_cards', 'admin.matches.yellowCards'], ['red_cards', 'admin.matches.redCards'],
  ['revenue_tickets', 'admin.matches.revenueTickets', 0.01], ['revenue_merchandise', 'admin.matches.revenueMerchandise', 0.01],
  ['revenue_sponsorship', 'admin.matches.revenueSponsorship', 0.01], ['revenue_concessions', 'admin.matches.revenueConcessions', 0.01],
];

const section = (titleKey, ...fields) => h('fieldset', { class: 'form-section' },
  h('legend', { class: 'form-section__title', 'data-i18n': titleKey }),
  h('div', { class: 'form-grid' }, fields));

// Create (match = null) or edit a match. Result fields only apply to finished matches;
// while disabled they are left out of the form data, so existing values are kept.
export async function matchDialog({ match = null, teams, leagues }) {
  const teamOptions = [{ value: '', labelKey: 'admin.matches.chooseTeam' }, ...teams.map((team) => ({ value: team.id, text: team.name }))];
  const number = (name, value, step = 1) => ({ name, type: 'number', value, attrs: { min: 0, step, inputmode: step === 1 ? 'numeric' : 'decimal' } });

  const fixture = section('admin.matches.fixture',
    field({ name: 'home_team_id', labelKey: 'admin.matches.home', value: match?.home_team_id, options: teamOptions }),
    field({ name: 'away_team_id', labelKey: 'admin.matches.away', value: match?.away_team_id, options: teamOptions }),
    field({ name: 'league', labelKey: 'admin.matches.league', value: match?.league, attrs: { list: 'admin-leagues', maxlength: 100 } }),
    field({ name: 'venue', labelKey: 'admin.matches.venue', value: match?.venue, attrs: { maxlength: 100 } }),
    field({ name: 'scheduled_at', labelKey: 'admin.matches.dateTime', type: 'datetime-local', value: match ? toDateTimeInputValue(match.scheduled_at) : '' }),
    field({ name: 'status', labelKey: 'admin.matches.status', value: match?.status ?? 'upcoming', options: MATCH_STATUSES.map((value) => ({ value, labelKey: `status.${value}` })) }),
    field({ labelKey: 'admin.matches.price', ...number('ticket_price', match?.ticket_price, 0.01) }),
    field({ labelKey: 'admin.matches.capacity', ...number('ticket_capacity', match?.ticket_capacity) }),
    field({ name: 'stream_url', labelKey: 'admin.matches.streamUrl', type: 'url', value: match?.stream_url, full: true, attrs: { placeholder: 'https://' } }),
    field({ name: 'referee', labelKey: 'admin.matches.referee', value: match?.referee, full: true, attrs: { maxlength: 100 } }),
    h('datalist', { id: 'admin-leagues' }, leagues.map(({ name }) => h('option', { value: name }))));
  const result = section('admin.matches.result',
    ...RESULT_FIELDS.map(([name, labelKey, step]) => field({ labelKey, ...number(name, match?.[name], step) })));
  const status = fixture.querySelector('[name="status"]');
  const sync = () => { result.disabled = status.value !== 'finished'; };
  status.addEventListener('change', sync);
  sync();

  const content = h('div', { class: 'match-dialog' }, fixture, result);
  applyTranslations(content);
  return openDialog({
    title: t(match ? 'admin.matches.editTitle' : 'admin.matches.addTitle'),
    submitLabel: t(match ? 'common.saveChanges' : 'admin.matches.add'),
    wide: true,
    content,
    onSubmit: (form) => (match ? matchesRepo.update(match.id, formValues(form)) : matchesRepo.create(formValues(form))),
  });
}
