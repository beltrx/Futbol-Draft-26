import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCareerStatusOneWeek,
  buildCareerEventsCatalog,
  buildClubTeamObject,
  calcClubStrength,
  finalizeCareerWeekAfterUserMatch,
  generateDoubleRoundRobinSchedule,
  initCareerLeague,
  modifyRivalPlayerRating,
  PREMIER_STAR_NEWS_TEMPLATES,
  selectPremierLeagueAiClubs,
  suspendPlayerForRedCard,
  WORLD_FOOTBALL_NEWS_TEMPLATES,
} from './careerLogic';
import { CLUB_TO_LEAGUE, MODES } from '../data/database';
import { CUSTOM_CLUB_LOGOS } from '../data/logos';
import {
  buildPitchRowsForTeam,
  enforceHealthyStartersForTeam,
  ensureTeamLineup,
} from './lineupLogic';
import { buildDraftState, chooseCpuPlayer, cost } from './draftLogic';
import type { FormationName } from '../types/game';

test('generateDoubleRoundRobinSchedule produces 38 weeks x 10 matches with home/away pairs', () => {
  const schedule = generateDoubleRoundRobinSchedule(20);
  assert.equal(schedule.length, 38);

  const pairCounts = new Map<string, number>();
  const orderedPairCounts = new Map<string, number>();

  schedule.forEach((round, rIdx) => {
    assert.equal(round.length, 10, `Round ${rIdx + 1} should have 10 matches`);
    const seenTeams = new Set<number>();
    round.forEach((m) => {
      assert.notEqual(m.a, m.b);
      assert.equal(seenTeams.has(m.a), false);
      assert.equal(seenTeams.has(m.b), false);
      seenTeams.add(m.a);
      seenTeams.add(m.b);

      const minT = Math.min(m.a, m.b);
      const maxT = Math.max(m.a, m.b);
      const key = `${minT}-${maxT}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);

      const orderedKey = `${m.a}->${m.b}`;
      orderedPairCounts.set(orderedKey, (orderedPairCounts.get(orderedKey) || 0) + 1);
    });
    assert.equal(seenTeams.size, 20);
  });

  // 20*19/2 = 190 unordered pairs, each appears twice
  assert.equal(pairCounts.size, 190);
  for (const [, cnt] of pairCounts) {
    assert.equal(cnt, 2);
  }
  // 20*19 = 380 ordered home->away fixtures, each appears once
  assert.equal(orderedPairCounts.size, 380);
  for (const [, cnt] of orderedPairCounts) {
    assert.equal(cnt, 1);
  }
});

test('AI red card suspension removes Van Hecke from Tottenham next week lineup and clears after 1 match', () => {
  const { state } = buildDraftState({
    mode: 'career',
    leagues: new Set(['Premier Lig']),
    clubs: new Set(),
    opp: 1,
    humanCount: 1,
    format: 'snake',
    strictPos: true,
  });
  assert.ok(state);

  const userTeam = state.teams[0];
  while (state.k < state.order.length) {
    const pick = chooseCpuPlayer(state, userTeam, true)!;
    userTeam.picks.push(pick);
    userTeam.spent += cost(pick);
    state.taken.add(pick.id);
    state.k++;
  }

  const { teams, league } = initCareerLeague([userTeam], 360, 'Premier Lig');
  assert.equal(league.maxWeeks, 38);
  assert.equal(teams.length, 20);

  let tottIdx = teams.findIndex((t) => t.name === 'Tottenham');
  if (tottIdx < 0) {
    teams[1] = buildClubTeamObject('Tottenham');
    tottIdx = 1;
  }
  const tottenham = teams[tottIdx];
  ensureTeamLineup(tottenham, league, true);

  const vanHecke = tottenham.picks.find((p) => p.n.includes('van Hecke'));
  assert.ok(vanHecke, 'Jan Paul van Hecke should be in Tottenham squad');
  // Put Van Hecke in starting XI if not already
  if (!tottenham.starters!.some((p) => p.id === vanHecke.id)) {
    tottenham.starters![1] = vanHecke;
  }

  // Suspend Van Hecke for red card in Week 1
  suspendPlayerForRedCard(league, teams, tottIdx, vanHecke, 1);
  enforceHealthyStartersForTeam(tottenham, league, true);

  // Next week: Van Hecke MUST NOT be in Tottenham starting XI!
  assert.equal(league.suspensions[vanHecke.id], 1);
  assert.equal(league.injuries[vanHecke.id], 1);
  assert.equal(
    tottenham.starters!.some((p) => p.id === vanHecke.id),
    false,
    'Suspended AI player Van Hecke must not start next week'
  );
  assert.equal(
    tottenham.bench!.some((p) => p.id === vanHecke.id),
    true,
    'Suspended AI player Van Hecke should be moved to bench'
  );

  // After next week finishes, decrement prior bans
  advanceCareerStatusOneWeek(league);
  assert.equal(league.injuries[vanHecke.id], undefined);
  assert.equal(league.suspensions[vanHecke.id], undefined);
});

test('finalizeCareerWeekAfterUserMatch suspends red-carded opponent and clears previous week bans cleanly', () => {
  const { state } = buildDraftState({
    mode: 'career',
    leagues: new Set(['Premier Lig']),
    clubs: new Set(),
    opp: 1,
    humanCount: 1,
    format: 'snake',
    strictPos: true,
  });
  assert.ok(state);
  const userTeam = state.teams[0];
  while (state.k < state.order.length) {
    const pick = chooseCpuPlayer(state, userTeam, true)!;
    userTeam.picks.push(pick);
    userTeam.spent += cost(pick);
    state.taken.add(pick.id);
    state.k++;
  }

  const { teams, league } = initCareerLeague([userTeam], 360, 'Premier Lig');
  const w1UserMatch = league.schedule[0].find((m) => m.a === 0 || m.b === 0)!;
  const oppIdx = w1UserMatch.a === 0 ? w1UserMatch.b : w1UserMatch.a;
  const oppStarter = teams[oppIdx].starters![2];

  finalizeCareerWeekAfterUserMatch(
    league,
    teams,
    { a: w1UserMatch.a, b: w1UserMatch.b },
    2,
    1,
    [],
    [],
    { [oppStarter.id]: { goals: 0, assists: 0, red: true } }
  );

  assert.equal(league.week, 2);
  assert.equal(league.suspensions[oppStarter.id], 1);
  assert.equal(
    teams[oppIdx].starters!.some((p) => p.id === oppStarter.id),
    false,
    'Opponent player who got a red card against user must be benched for week 2'
  );
});

test('No news references Mohamed Salah at Liverpool/Anfield, and Trabzonspor Salah news exists', () => {
  const allTemplates = [...PREMIER_STAR_NEWS_TEMPLATES, ...WORLD_FOOTBALL_NEWS_TEMPLATES];
  for (const tpl of allTemplates) {
    const combined = `${tpl.club} ${tpl.title} ${tpl.body}`.toLowerCase();
    if (combined.includes('salah')) {
      assert.equal(
        combined.includes('liverpool') || combined.includes('anfield'),
        false,
        `Invalid Liverpool/Anfield Salah reference in template ${tpl.id}`
      );
    }
  }
  const tsNews = WORLD_FOOTBALL_NEWS_TEMPLATES.find((t) => t.id === 'world_trabzon_salah');
  assert.ok(tsNews);
  assert.equal(tsNews.club, 'Trabzonspor');
});

test('West Ham is in Diger Takimlar and Career Premier Lig replaces Hull City (1P) and Hull City + Ipswich Town (2P)', () => {
  assert.equal(CLUB_TO_LEAGUE['West Ham United'], 'Diğer Takımlar');

  const ai1P = selectPremierLeagueAiClubs(1, ['Senin Kulübün']);
  assert.equal(ai1P.length, 19);
  assert.equal(ai1P.includes('West Ham United'), false);
  assert.equal(ai1P.includes('Hull City'), false);
  assert.equal(ai1P.includes('Ipswich Town'), true);

  const ai2P = selectPremierLeagueAiClubs(2, ['1. Oyuncu', '2. Oyuncu']);
  assert.equal(ai2P.length, 18);
  assert.equal(ai2P.includes('West Ham United'), false);
  assert.equal(ai2P.includes('Hull City'), false);
  assert.equal(ai2P.includes('Ipswich Town'), false);
  assert.ok(calcClubStrength('Hull City') < calcClubStrength('Ipswich Town'));
});

test('2-player career builds 20 teams / 38 weeks and waits for both human matches before advancing week', () => {
  const { state, error } = buildDraftState({
    mode: 'career',
    leagues: new Set(['Premier Lig', 'La Liga']),
    clubs: new Set(),
    opp: 1,
    humanCount: 2,
    format: 'snake',
    strictPos: true,
  });
  assert.equal(error, '');
  assert.ok(state);
  assert.equal(state.teams.length, 2);

  while (state.k < state.order.length) {
    const ti = state.order[state.k];
    const p = chooseCpuPlayer(state, state.teams[ti], true)!;
    state.teams[ti].picks.push(p);
    state.teams[ti].spent += cost(p);
    state.taken.add(p.id);
    state.k++;
  }

  const { teams, league } = initCareerLeague(state.teams, state.m.budget, 'Premier Lig');
  assert.equal(teams.length, 20);
  assert.equal(league.maxWeeks, 38);
  assert.equal(teams[0].isHuman, true);
  assert.equal(teams[1].isHuman, true);

  // Find a round where P1 and P2 play different AI opponents
  const splitRoundIdx = league.schedule.findIndex((round) => {
    const m0 = round.find((m) => m.a === 0 || m.b === 0)!;
    return !(m0.a === 1 || m0.b === 1);
  });
  assert.ok(splitRoundIdx >= 0);
  league.week = splitRoundIdx + 1;
  const round = league.schedule[splitRoundIdx];
  const m0 = round.find((m) => m.a === 0 || m.b === 0)!;
  const m1 = round.find((m) => m.a === 1 || m.b === 1)!;

  finalizeCareerWeekAfterUserMatch(league, teams, { a: m0.a, b: m0.b }, 2, 0, [], [], {});
  assert.equal(league.week, splitRoundIdx + 1, 'Week must not advance until 2nd human match finishes');

  finalizeCareerWeekAfterUserMatch(league, teams, { a: m1.a, b: m1.b }, 1, 1, [], [], {});
  assert.equal(league.week, splitRoundIdx + 2, 'Week must advance after both human matches finish');
});

test('Ratings are hidden from all rival news badges and career event texts, and MODES/CUSTOM_CLUB_LOGOS match requirements', () => {
  const rival = buildClubTeamObject('Arsenal');
  const modRes = modifyRivalPlayerRating(rival, 'Bukayo Saka', 2);
  assert.ok(modRes);
  assert.equal(modRes.badge.toLowerCase().includes('reyting'), false);
  assert.equal(/\d{2}\s*→\s*\d{2}/.test(modRes.badge), false);

  const { state } = buildDraftState({
    mode: 'career',
    leagues: new Set(['Premier Lig']),
    clubs: new Set(),
    opp: 1,
    humanCount: 1,
    format: 'snake',
    strictPos: true,
  });
  assert.ok(state);
  while (state.k < state.order.length) {
    const p = chooseCpuPlayer(state, state.teams[0], true)!;
    state.teams[0].picks.push(p);
    state.k++;
  }
  const { teams, league } = initCareerLeague(state.teams, 360);
  const events = buildCareerEventsCatalog(league, teams[0]);
  for (const ev of events) {
    for (const ch of ev.choices) {
      assert.equal(ch.label.toLowerCase().includes('reyting'), false, `Choice label leaked rating: ${ch.label}`);
      const outcome = ch.effect({ lg: league, userTeam: teams[0] });
      assert.equal(outcome.toLowerCase().includes('reyting'), false, `Outcome leaked rating: ${outcome}`);
    }
  }

  assert.equal(MODES.length, 6);
  const modeIds = new Set(MODES.map((m) => m.id));
  assert.equal(modeIds.has('career'), true);
  assert.equal((modeIds as Set<string>).has('random'), false);
  assert.equal((modeIds as Set<string>).has('league'), false);

  const expectedSvgClubs = [
    'Flamengo',
    'West Ham United',
    'Freiburg',
    'Rangers',
    'Celtic',
    'Olympiacos',
    'Bodo Glimt',
    'Lazio',
    'Fiorentina',
    'Napoli',
    'Atalanta',
    'River Plate',
    'Benfica',
    'Villarreal',
  ];
  for (const club of expectedSvgClubs) {
    assert.ok(CUSTOM_CLUB_LOGOS[club]?.endsWith('.svg'), `Expected SVG logo for ${club}`);
  }
});

test('buildPitchRowsForTeam orders rows from FWD (top) down to GK (bottom) across all formations', () => {
  const arsenal = buildClubTeamObject('Arsenal');
  const expectedByFormation: Record<FormationName, string[]> = {
    '4-3-3': ['FWD', 'MID', 'DEF', 'GK'],
    '4-2-3-1': ['FWD', 'MID', 'MID', 'DEF', 'GK'],
    '4-4-2': ['FWD', 'MID', 'DEF', 'GK'],
    '3-5-2': ['FWD', 'MID', 'DEF', 'GK'],
  };
  for (const fn of Object.keys(expectedByFormation) as FormationName[]) {
    arsenal.formation = fn;
    arsenal.starters = null;
    arsenal.bench = null;
    const rows = buildPitchRowsForTeam(arsenal, null, false);
    assert.deepEqual(
      rows.map((r) => r.pos),
      expectedByFormation[fn],
      `Formation ${fn} must render FWD at top and GK at bottom`
    );
  }
});
