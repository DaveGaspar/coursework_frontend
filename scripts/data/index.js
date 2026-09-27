// Pages only use these repositories. DATA_SOURCE decides where the data comes from.
import { DATA_SOURCE } from '../core/config.js';
import { backend } from './sources/backend/backend.js';
import { startHybrid } from './sources/local/seed.js';
import { authRepo as hybridAuth } from './repositories/users.js';
import { cardsRepo as hybridCards } from './repositories/cards.js';
import { matchesRepo as hybridMatches } from './repositories/matches.js';
import { playersRepo as hybridPlayers, POSITIONS } from './repositories/players.js';
import { reportsRepo as hybridReports } from './repositories/reports.js';
import { teamsRepo as hybridTeams } from './repositories/teams.js';
import { ticketsRepo as hybridTickets, MAX_TICKETS_PER_ORDER } from './repositories/tickets.js';

const useBackend = DATA_SOURCE === 'backend';

export const authRepo = useBackend ? backend.auth : hybridAuth;
export const matchesRepo = useBackend ? backend.matches : hybridMatches;
export const teamsRepo = useBackend ? backend.teams : hybridTeams;
export const playersRepo = useBackend ? backend.players : hybridPlayers;
export const ticketsRepo = useBackend ? backend.tickets : hybridTickets;
export const cardsRepo = useBackend ? backend.cards : hybridCards;
export const reportsRepo = useBackend ? backend.reports : hybridReports;

export const PLAYER_POSITIONS = POSITIONS;
export const MATCH_STATUSES = ['upcoming', 'live', 'finished'];
export const USER_ROLES = ['viewer', 'admin'];
export { MAX_TICKETS_PER_ORDER };

export function startDataSource() {
  if (!useBackend) startHybrid();
}
