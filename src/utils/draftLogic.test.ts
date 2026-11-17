import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_CLUBS,
  DATA,
  PLAYERS_POOL,
  PS,
  ROUNDS,
} from '../data/database';
import {
  buildDraftState,
  canTeamPickPos,
  checkBudgetStatus,
  chooseCpuPlayer,
  cost,
  pickRandomWheelPlayersForClub,
} from './draftLogic';

const NEW_13_CLUBS = [
  'Villarreal',
  'Atalanta',
  'Napoli',
  'Fiorentina',
  'Lazio',
  'Bodo Glimt',
  'Olympiacos',
  'Celtic',
  'Rangers',
  'Freiburg',
  'West Ham United',
  'Flamengo',
  'River Plate',
];

test('every club in DATA has matching PS length and appears in PLAYERS_POOL', () => {
  for (const [club, players] of Object.entries(DATA)) {
    const posStr = PS[club];
    assert.ok(posStr, `PS missing for ${club}`);
    assert.equal(
      posStr.length,
      players.length,
      `PS length mismatch for ${club}: ${posStr.length} vs ${players.length}`
    );
  }
  for (const club of NEW_13_CLUBS) {
    assert.ok(ALL_CLUBS.includes(club), `Missing new club ${club}`);
    const clubPlayers = PLAYERS_POOL.filter((p) => p.c === club);
    assert.ok(clubPlayers.length >= 11, `Expected >=11 players for ${club}`);
  }
});

test('Mohamed Salah is in Trabzonspor with rating 88 and NOT in Liverpool', () => {
  const salahMatches = PLAYERS_POOL.filter((p) => p.n.toLowerCase().includes('salah'));
  assert.ok(salahMatches.some((p) => p.c === 'Trabzonspor' && p.r === 88));
  assert.equal(
    salahMatches.some((p) => p.c === 'Liverpool'),
    false
  );
});

test('buildDraftState completes full 14-round draft respecting budget and quotas', () => {
  const { state, error } = buildDraftState({
    mode: 'career',
    leagues: new Set(['Premier Lig', 'La Liga', 'Serie A', 'Bundesliga']),
    clubs: new Set(),
    opp: 1,
    humanCount: 1,
    format: 'snake',
    strictPos: true,
  });

  assert.equal(error, '');
  assert.ok(state);
  assert.equal(state.teams.length, 1);
  assert.equal(state.order.length, ROUNDS);

  // Verify draft pool is sorted alphabetically, not by rating
  for (let i = 1; i < state.pool.length; i++) {
    assert.ok(
      state.pool[i - 1].n.localeCompare(state.pool[i].n, 'tr') <= 0,
      `Expected alphabetical order: ${state.pool[i - 1].n} <= ${state.pool[i].n}`
    );
  }

  const userTeam = state.teams[0];
  while (state.k < state.order.length) {
    const p = chooseCpuPlayer(state, userTeam, true);
    assert.ok(p, `No valid pick found at round ${state.k + 1}`);
    assert.equal(canTeamPickPos(userTeam, p.pos, state.pool, state.taken, true), true);
    assert.equal(checkBudgetStatus(state, userTeam, p, true).ok, true);
    userTeam.picks.push(p);
    userTeam.spent += cost(p);
    state.taken.add(p.id);
    state.k++;
  }

  assert.equal(userTeam.picks.length, ROUNDS);
  assert.ok(userTeam.spent <= (state.m.budget || 360));
});

test('pickRandomWheelPlayersForClub returns 4 random players from club sorted alphabetically', () => {
  const { state } = buildDraftState({
    mode: 'wheel',
    leagues: new Set(['Premier Lig', 'Serie A', 'Bundesliga']),
    clubs: new Set(),
    opp: 1,
    humanCount: 2,
    format: 'snake',
    strictPos: true,
  });
  assert.ok(state);
  const offered = pickRandomWheelPlayersForClub(state, state.teams[0], 'Inter', true, 4);
  assert.equal(offered.length, 4);
  assert.ok(offered.every((p) => p.c === 'Inter'));
  for (let i = 1; i < offered.length; i++) {
    assert.ok(offered[i - 1].n.localeCompare(offered[i].n, 'tr') <= 0);
  }
});

