import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftState, chooseCpuPlayer, cost } from './draftLogic';
import { ensureTeamLineup, getEffectivePlayerRating } from './lineupLogic';
import { createInitialMatchState, generateMatchPlan, side, stepMatchMinute } from './matchEngine';

test('out-of-position players receive -10 effective rating penalty', () => {
  const { state } = buildDraftState({
    mode: 'classic',
    leagues: new Set(['Premier Lig']),
    clubs: new Set(),
    opp: 1,
    humanCount: 1,
    format: 'snake',
    strictPos: true,
  });
  assert.ok(state);

  const striker = state.pool.find((p) => p.pos === 'FWD')!;
  assert.equal(getEffectivePlayerRating(striker, 'FWD'), striker.r);
  assert.equal(getEffectivePlayerRating(striker, 'DEF'), Math.max(40, striker.r - 10));
});

test('match engine simulates 90 minutes and steps stats cleanly', () => {
  const { state } = buildDraftState({
    mode: 'classic',
    leagues: new Set(['Premier Lig']),
    clubs: new Set(['Manchester City', 'Arsenal', 'Liverpool', 'Real Madrid']),
    opp: 1,
    humanCount: 1,
    format: 'snake',
    strictPos: true,
  });
  assert.ok(state);

  while (state.k < state.order.length) {
    const idx = state.order[state.k];
    const tm = state.teams[idx];
    const pick = chooseCpuPlayer(state, tm, true)!;
    tm.picks.push(pick);
    tm.spent += cost(pick);
    state.taken.add(pick.id);
    state.k++;
  }
  state.teams.forEach((tm) => ensureTeamLineup(tm));

  const sA = side(state.teams[0]);
  const sB = side(state.teams[1]);
  const plan = generateMatchPlan(state.teams[0], state.teams[1], sA, sB, false);
  assert.equal(plan.maxMin, 90);

  const mState = createInitialMatchState(0, 1, null, plan, state.teams, null, false);
  for (let min = 1; min <= plan.maxMin; min++) {
    stepMatchMinute(mState, min, state.teams);
  }
  assert.ok(mState.log.length > 0);
});
