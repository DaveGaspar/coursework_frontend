import { ValidationError } from '../../core/errors.js';
import { db } from '../sources/local/local-db.js';
import { latency, markEdited, mustGet, requireAdmin, stripHidden } from './helpers.js';

export const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

function clean(input, existing = null) {
  const out = {};
  const fields = {};
  if ('team_id' in input) {
    out.team_id = Number(input.team_id);
    if (!db.get('teams', out.team_id)) fields.team_id = 'validation.required';
  }
  if ('full_name' in input) {
    out.full_name = String(input.full_name ?? '').trim();
    if (!out.full_name) fields.full_name = 'validation.required';
    else if (out.full_name.length > 100) fields.full_name = 'validation.tooLong';
  }
  if ('position' in input) {
    out.position = input.position;
    if (!POSITIONS.includes(out.position)) fields.position = 'validation.required';
  }
  if ('jersey_number' in input) {
    const raw = String(input.jersey_number ?? '').trim();
    out.jersey_number = raw === '' ? null : Number(raw);
    if (out.jersey_number !== null && (!Number.isInteger(out.jersey_number) || out.jersey_number < 1 || out.jersey_number > 99)) {
      fields.jersey_number = 'validation.jerseyNumber';
    }
  }
  const teamId = out.team_id ?? existing?.team_id;
  if (out.jersey_number != null && teamId) {
    const clash = db.find('players', (p) => p.team_id === teamId && p.jersey_number === out.jersey_number && p.id !== existing?.id);
    if (clash) fields.jersey_number = 'validation.jerseyTaken';
  }
  if (Object.keys(fields).length) throw new ValidationError('Invalid player', { fields });
  return out;
}

export const playersRepo = {
  async create(data) {
    requireAdmin();
    const values = clean({ team_id: data.team_id, full_name: data.full_name, position: data.position, jersey_number: data.jersey_number });
    const row = db.insert('players', { ...values, _ext: null, _edited: Object.keys(values) });
    await latency();
    return stripHidden(row);
  },

  async update(id, data) {
    requireAdmin();
    const existing = mustGet('players', id);
    const values = clean(data, existing);
    const row = db.update('players', existing.id, { ...values, _edited: markEdited(existing, values) });
    await latency();
    return stripHidden(row);
  },

  async remove(id) {
    requireAdmin();
    const existing = mustGet('players', id);
    db.remove('players', existing.id);
    db.addTombstone(existing._ext?.key ?? null);
    await latency();
  },
};
