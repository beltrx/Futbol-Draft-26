import test from 'node:test';
import assert from 'node:assert/strict';
import { MODERN_LEAGUES, PLAYERS_POOL } from '../data/database';
import type { Player, SideEvaluation, TeamTactics } from '../types/game';
import { buildDraftState } from './draftLogic';
import {
  DEFAULT_TACTICS,
  evaluateSquadTraitProfile,
  evaluateTacticalFit,
  evaluateTacticalMatchup,
  PRESS_OPTIONS,
  DEFENSIVE_LINE_OPTIONS,
  TACKLING_OPTIONS,
  COUNTER_PRESS_OPTIONS,
  BUILDUP_OPTIONS,
  TEMPO_OPTIONS,
  WIDTH_OPTIONS,
  FINAL_THIRD_OPTIONS,
} from './tacticsLogic';

function makeStarter(overrides: Partial<Player> & { id: number }): Player {
  return {
    n: `Player ${overrides.id}`,
    c: 'Test FC',
    lg: 'Premier Lig',
    r: 84,
    pos: 'MID',
    price: 20,
    nat: 'İspanya',
    trait: 'Pasör',
    role: 'Oyun Kurucu',
    ...overrides,
  };
}

function makeSideEval(starters: Player[]): SideEvaluation {
  const toLineup = (p: Player) => ({ ...p, effR: p.r, outOfPos: false, slotPos: p.pos });
  const gk = starters.filter((p) => p.pos === 'GK').map(toLineup);
  const def = starters.filter((p) => p.pos === 'DEF').map(toLineup);
  const mid = starters.filter((p) => p.pos === 'MID').map(toLineup);
  const fwd = starters.filter((p) => p.pos === 'FWD').map(toLineup);
  return {
    L: { GK: gk, DEF: def, MID: mid, FWD: fwd },
    pitchRows: [
      { label: 'FV', pos: 'FWD', count: fwd.length, players: fwd },
      { label: 'OS', pos: 'MID', count: mid.length, players: mid },
      { label: 'DEF', pos: 'DEF', count: def.length, players: def },
      { label: 'KL', pos: 'GK', count: gk.length, players: gk },
    ],
    avg: 84,
    att: 84,
    def: 84,
    mid: 84,
  };
}

test('database includes enriched nationality, trait, role and 79 national icons', () => {
  const icons = PLAYERS_POOL.filter((p) => p.lg === 'Milli İkonlar');
  assert.equal(icons.length, 79);
  const pele = icons.find((p) => p.n === 'Pele');
  assert.ok(pele);
  assert.equal(pele.nat, 'Brezilya');
  assert.equal(pele.c, '20. YY Efsaneleri');
  assert.equal(pele.trait, 'All-Around');
  assert.equal(pele.role, 'Komple Forvet');

  const haaland = PLAYERS_POOL.find((p) => p.n === 'Erling Haaland' && p.c === 'Manchester City');
  assert.ok(haaland);
  assert.equal(haaland.nat, 'Norveç');
  assert.ok(haaland.trait);
  assert.ok(haaland.role);
});

test('all 8 tactical option groups exist and contain zero emojis', () => {
  const allGroups = [
    PRESS_OPTIONS,
    DEFENSIVE_LINE_OPTIONS,
    TACKLING_OPTIONS,
    COUNTER_PRESS_OPTIONS,
    BUILDUP_OPTIONS,
    TEMPO_OPTIONS,
    WIDTH_OPTIONS,
    FINAL_THIRD_OPTIONS,
  ];
  assert.equal(allGroups.length, 8);
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const grp of allGroups) {
    assert.ok(grp.length >= 2);
    for (const opt of grp) {
      assert.equal(emojiRegex.test(opt.label), false);
      assert.equal(emojiRegex.test(opt.hint), false);
    }
  }
});

test('20. YY Efsaneleri forms a single unified 79-player pool excluded from modern career leagues', () => {
  assert.equal(MODERN_LEAGUES.includes('Milli İkonlar'), false);
  assert.equal(MODERN_LEAGUES.includes('İkonik Takımlar'), false);

  const legends = PLAYERS_POOL.filter((p) => p.lg === 'Milli İkonlar');
  assert.equal(legends.length, 79);
  assert.ok(legends.every((p) => p.c === '20. YY Efsaneleri'));

  const { state, error } = buildDraftState({
    mode: 'classic',
    leagues: new Set(['Milli İkonlar']),
    clubs: new Set(),
    opp: 1,
    humanCount: 1,
    format: 'snake',
    strictPos: true,
  });
  assert.equal(error, '');
  assert.ok(state);
  assert.equal(state.pool.length, 79);
});

test('tactical matchup modifies red card risk and counter-attack effectiveness', () => {
  const fastSquad = [
    makeStarter({ id: 1, pos: 'GK', trait: 'Refleks', role: 'Çizgi Kalecisi' }),
    ...Array.from({ length: 4 }, (_, i) => makeStarter({ id: 2 + i, pos: 'DEF', trait: 'Hızlı' })),
    ...Array.from({ length: 3 }, (_, i) => makeStarter({ id: 6 + i, pos: 'MID', trait: 'Dayanıklı' })),
    ...Array.from({ length: 3 }, (_, i) => makeStarter({ id: 9 + i, pos: 'FWD', trait: 'Patlayıcı' })),
  ];
  const sA = makeSideEval(fastSquad);
  const sB = makeSideEval(fastSquad);

  const aggressiveHighLine: TeamTactics = {
    ...DEFAULT_TACTICS,
    defensiveLine: 'high',
    tackling: 'aggressive',
    pressIntensity: 'high',
    counterPress: 'on',
  };
  const cautiousCounter: TeamTactics = {
    ...DEFAULT_TACTICS,
    defensiveLine: 'deep',
    tackling: 'cautious',
    buildUp: 'direct',
    tempo: 'fast',
    finalThird: 'counter',
  };

  const matchup = evaluateTacticalMatchup(sA, sB, aggressiveHighLine, cautiousCounter);
  assert.ok(matchup.redProbA > matchup.redProbB * 2);
  assert.ok(matchup.cardProbA > matchup.cardProbB);
  // Counter side should gain attack edge against high line
  assert.ok(matchup.attModB > 0);
  // Trait profile detects speed & stamina
  const prof = evaluateSquadTraitProfile(fastSquad);
  assert.ok(prof.speed >= 7);
  assert.ok(prof.stamina >= 3);
  const fit = evaluateTacticalFit(fastSquad, cautiousCounter);
  assert.ok(fit.fitRating > 0);
});
