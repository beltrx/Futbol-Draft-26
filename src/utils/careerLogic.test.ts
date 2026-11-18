import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptPressConference,
  advanceCareerStatusOneWeek,
  answerPressConferenceQuestion,
  buildCareerEventsCatalog,
  buildClubTeamObject,
  calcClubStrength,
  closeCompletedPressConference,
  declinePressConference,
  finalizeCareerWeekAfterUserMatch,
  generateDoubleRoundRobinSchedule,
  getSortedStandings,
  initCareerLeague,
  modifyRivalPlayerRating,
  PREMIER_STAR_NEWS_TEMPLATES,
  resolveTeamCareerEventChoice,
  selectPremierLeagueAiClubs,
  simulateSingleCareerWeek,
  suspendPlayerForRedCard,
  triggerPressConferenceForTeam,
  triggerWeeklyCareerEvent,
  WORLD_FOOTBALL_NEWS_TEMPLATES,
} from './careerLogic';
import { CLUB_STADIUMS, CLUB_TO_LEAGUE, DATA, MODES } from '../data/database';
import { CUSTOM_CLUB_LOGOS, LEAGUE_LOGOS, UCL_BRAND_LOGOS } from '../data/logos';
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

  assert.equal(MODES.length, 4);
  const modeIds = new Set(MODES.map((m) => m.id));
  assert.equal(modeIds.has('career'), true);
  assert.equal(modeIds.has('classic'), true);
  assert.equal(modeIds.has('wheel'), true);
  assert.equal(modeIds.has('budget'), true);
  assert.equal((modeIds as Set<string>).has('club'), false);
  assert.equal((modeIds as Set<string>).has('iconic'), false);

  const expectedCustomLogoClubs = [
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
    'Stuttgart',
    'Hoffenheim',
    'Eintracht Frankfurt',
    'Augsburg',
    'Mainz',
    'Koln',
    'Hamburg',
    'Gladbach',
    'Werder Bremen',
    'Union Berlin',
    'Schalke',
    'Elversberg',
    'Paderborn',
    'Bologna',
    'Sassuolo',
    'Torino',
    'Genoa',
    'Udinese',
    'Parma',
    'Cagliari',
    'Venezia',
    'Frosinone',
    'Monza',
    'Lecce',
    'Strasbourg',
  ];
  for (const club of expectedCustomLogoClubs) {
    assert.ok(
      CUSTOM_CLUB_LOGOS[club]?.startsWith('data:image/'),
      `Expected embedded logo for ${club}`
    );
  }
});

test('Bundesliga Career mode builds 18 teams / 34 weeks, drops Paderborn (1P) & Elversberg (2P), and keeps Bologna in Serie A', () => {
  assert.equal(CLUB_TO_LEAGUE['Bologna'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Stuttgart'], 'Bundesliga');
  assert.equal(CLUB_TO_LEAGUE['Paderborn'], 'Bundesliga');
  assert.equal(CLUB_TO_LEAGUE['Elversberg'], 'Bundesliga');

  const { state } = buildDraftState({
    mode: 'career',
    leagues: new Set(['Bundesliga']),
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
    state.teams[0].spent += cost(p);
    state.taken.add(p.id);
    state.k++;
  }

  const { teams, league } = initCareerLeague(state.teams, 360, 'Bundesliga');
  assert.equal(league.leagueName, 'Bundesliga');
  assert.equal(teams.length, 18);
  assert.equal(league.maxWeeks, 34);
  assert.equal(league.schedule.length, 34);
  assert.equal(teams.some((t) => t.name === 'Bologna'), false);
  assert.equal(teams.some((t) => t.name === 'Paderborn'), false);
  assert.equal(teams.some((t) => t.name === 'Bayern Munchen'), true);
});

test('Serie A Career mode builds 20 teams / 38 weeks, drops Frosinone (1P), and keeps Strasbourg in Ligue 1', () => {
  assert.equal(CLUB_TO_LEAGUE['Strasbourg'], 'Ligue 1');
  assert.equal(CLUB_TO_LEAGUE['Sassuolo'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Torino'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Genoa'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Udinese'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Parma'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Cagliari'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Venezia'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Frosinone'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Monza'], 'Serie A');
  assert.equal(CLUB_TO_LEAGUE['Lecce'], 'Serie A');

  const { state } = buildDraftState({
    mode: 'career',
    leagues: new Set(['Serie A']),
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
    state.teams[0].spent += cost(p);
    state.taken.add(p.id);
    state.k++;
  }

  const { teams, league } = initCareerLeague(state.teams, 360, 'Serie A');
  assert.equal(league.leagueName, 'Serie A');
  assert.equal(teams.length, 20);
  assert.equal(league.maxWeeks, 38);
  assert.equal(league.schedule.length, 38);
  assert.equal(teams.some((t) => t.name === 'Strasbourg'), false);
  assert.equal(teams.some((t) => t.name === 'Frosinone'), false);
  assert.equal(teams.some((t) => t.name === 'Inter'), true);
  assert.equal(teams.some((t) => t.name === 'Sassuolo'), true);
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

test('2-player Career mode maintains independent teamCareer events, funds, morale, and history per human player', () => {
  const { state } = buildDraftState({
    mode: 'career',
    leagues: new Set(['Premier Lig', 'La Liga']),
    clubs: new Set(),
    opp: 1,
    humanCount: 2,
    format: 'snake',
    strictPos: true,
  });
  assert.ok(state);
  while (state.k < state.order.length) {
    const ti = state.order[state.k];
    const p = chooseCpuPlayer(state, state.teams[ti], true)!;
    state.teams[ti].picks.push(p);
    state.teams[ti].spent += cost(p);
    state.taken.add(p.id);
    state.k++;
  }

  const { teams, league } = initCareerLeague(state.teams, state.m.budget, 'Premier Lig');
  assert.ok(league.teamCareer?.[0]);
  assert.ok(league.teamCareer?.[1]);

  // Force event generation on week 2
  league.week = 2;
  triggerWeeklyCareerEvent(league, teams, true);

  // Simulate PeerJS JSON roundtrip on league
  const roundtrippedLeague = JSON.parse(
    JSON.stringify({
      ...league,
      usedEventIds: [...league.usedEventIds],
      usedNewsIds: [...league.usedNewsIds],
    })
  );
  roundtrippedLeague.usedEventIds = new Set(roundtrippedLeague.usedEventIds);
  roundtrippedLeague.usedNewsIds = new Set(roundtrippedLeague.usedNewsIds);

  assert.ok(roundtrippedLeague.teamCareer[0].activeEvent, 'Team 0 should have an active event');
  assert.ok(roundtrippedLeague.teamCareer[1].activeEvent, 'Team 1 should have an active event');

  const team1FundsBefore = roundtrippedLeague.teamCareer[1].clubFunds;
  const team1MoraleBefore = roundtrippedLeague.teamCareer[1].moraleMod;
  const team1SponsorBefore = roundtrippedLeague.teamCareer[1].sponsorName;

  // Resolve choice 0 for Team 0 (Admin) on roundtrippedLeague (even after JSON serialization stripped functions!)
  const outcome0 = resolveTeamCareerEventChoice(roundtrippedLeague, teams, 0, 0);
  assert.ok(outcome0.length > 0, 'Team 0 choice should return a non-empty outcome message');
  assert.equal(roundtrippedLeague.teamCareer[0].eventHistory.length, 1);

  // Team 1 (Guest) must NOT have its eventHistory, funds, morale, or sponsor altered by Team 0's choice!
  assert.equal(roundtrippedLeague.teamCareer[1].eventHistory.length, 0);
  assert.equal(roundtrippedLeague.teamCareer[1].clubFunds, team1FundsBefore);
  assert.equal(roundtrippedLeague.teamCareer[1].moraleMod, team1MoraleBefore);
  assert.equal(roundtrippedLeague.teamCareer[1].sponsorName, team1SponsorBefore);

  // Now Team 1 resolves its own event independently
  const outcome1 = resolveTeamCareerEventChoice(roundtrippedLeague, teams, 1, 0);
  assert.ok(outcome1.length > 0, 'Team 1 choice should return a non-empty outcome message');
  assert.equal(roundtrippedLeague.teamCareer[1].eventHistory.length, 1);
});

test('UEFA Champions League (Şampiyonlar Ligi) Career mode builds 36 teams, 8 league matches, two-legged knockouts (Weeks 9-16) + single-leg Final (Week 17), and triggers Press Conferences every 5 matches', () => {
  const newUclClubs = [
    'Slovan Bratislava',
    'Real Betis',
    'LASK',
    'Shakhtar Donetsk',
    'Viking',
    'AEK Atina',
    'Sabah',
    'Lens',
    'Slavia Prag',
    'Lille',
  ];
  for (const club of newUclClubs) {
    assert.ok(CUSTOM_CLUB_LOGOS[club]?.startsWith('data:image/'), `Missing logo for ${club}`);
    assert.ok((DATA[club]?.length || 0) >= 11, `Club ${club} should have full squad in DATA`);
    assert.ok(CLUB_STADIUMS[club], `Missing stadium for ${club}`);
  }
  assert.ok(LEAGUE_LOGOS['Şampiyonlar Ligi']?.startsWith('data:image/'));
  assert.ok(UCL_BRAND_LOGOS.starballWhite.startsWith('data:image/'));
  assert.ok(UCL_BRAND_LOGOS.heinekenWhite.startsWith('data:image/'));
  assert.equal(UCL_BRAND_LOGOS.sponsors.length, 4);

  const { state } = buildDraftState({
    mode: 'career',
    leagues: new Set(['Premier Lig', 'La Liga']),
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
    state.teams[0].spent += cost(p);
    state.taken.add(p.id);
    state.k++;
  }

  const { teams, league } = initCareerLeague(state.teams, 360, 'Şampiyonlar Ligi');
  assert.equal(league.isUcl, true);
  assert.equal(league.leagueName, 'Şampiyonlar Ligi');
  assert.equal(teams.length, 36);
  assert.equal(league.maxWeeks, 17);
  assert.equal(league.schedule.length, 17);
  const uclPots = league.uclPots || [];
  assert.equal(uclPots.length, 36);

  // Verify 4 pots of 9 teams each
  for (const potNum of [1, 2, 3, 4] as const) {
    const countInPot = uclPots.filter((p) => p.pot === potNum).length;
    assert.equal(countInPot, 9, `Pot ${potNum} must have 9 teams`);
  }

  // Verify weeks 1..8 have 18 matches per week and each team plays 2 opponents from each pot
  const potMap = new Map<number, number>();
  uclPots.forEach((p) => potMap.set(p.teamIdx, p.pot));

  const oppPotsByTeam: Record<number, number[]> = {};
  for (let i = 0; i < 36; i++) oppPotsByTeam[i] = [0, 0, 0, 0, 0];

  for (let w = 0; w < 8; w++) {
    const round = league.schedule[w];
    assert.equal(round.length, 18, `League phase week ${w + 1} must have 18 matches`);
    const seen = new Set<number>();
    for (const m of round) {
      assert.equal(seen.has(m.a), false);
      assert.equal(seen.has(m.b), false);
      seen.add(m.a);
      seen.add(m.b);
      oppPotsByTeam[m.a][potMap.get(m.b)!]++;
      oppPotsByTeam[m.b][potMap.get(m.a)!]++;
    }
    assert.equal(seen.size, 36);
  }

  for (let i = 0; i < 36; i++) {
    assert.deepEqual(
      oppPotsByTeam[i].slice(1),
      [2, 2, 2, 2],
      `Team ${i} must play exactly 2 opponents from each of Pots 1, 2, 3, 4`
    );
  }

  // Simulate weeks 1..5 and verify Press Conference triggers after Week 5
  for (let w = 1; w <= 5; w++) {
    simulateSingleCareerWeek(league, teams);
  }
  assert.equal(league.week, 6);
  const pcWeek5 = league.teamCareer?.[0]?.activePressConference;
  assert.ok(pcWeek5, 'Press conference should trigger after Week 5 in UCL');
  assert.equal(pcWeek5.week, 5);
  assert.equal(pcWeek5.status, 'invited');
  assert.equal(pcWeek5.questions.length, 3);

  // Accept press conference and answer 3 questions
  acceptPressConference(league, 0);
  assert.equal(league.teamCareer![0].activePressConference!.status, 'in_progress');
  answerPressConferenceQuestion(league, 0, 0);
  answerPressConferenceQuestion(league, 0, 1);
  answerPressConferenceQuestion(league, 0, 0);
  assert.equal(league.teamCareer![0].activePressConference!.status, 'completed');
  assert.equal(league.teamCareer![0].activePressConference!.answers.length, 3);
  closeCompletedPressConference(league, 0);
  assert.equal(league.teamCareer![0].activePressConference, null);

  // Test declining after a loss gives -1 morale
  league.teamCareer![0].lastResult = { userGoals: 0, oppGoals: 2, oppName: 'Real Madrid' };
  const moraleBeforeDecline = league.teamCareer![0].moraleMod;
  triggerPressConferenceForTeam(league, teams, 0, 5);
  declinePressConference(league, 0);
  assert.equal(league.teamCareer![0].activePressConference!.status, 'declined');
  assert.equal(league.teamCareer![0].moraleMod, moraleBeforeDecline - 1);
  closeCompletedPressConference(league, 0);

  // Simulate weeks 6..8
  for (let w = 6; w <= 8; w++) {
    simulateSingleCareerWeek(league, teams);
  }
  assert.equal(league.week, 9);

  // Check Week 9 (Play-Off 1. Maç) & Week 10 (Play-Off Rövanş)
  const sortedStandings = getSortedStandings(league);
  const rankTeam = (r: number) => sortedStandings[r - 1].teamIdx;
  const playOffLeg1 = league.schedule[8];
  assert.equal(playOffLeg1.length, 8, 'Play-Off 1st leg (Week 9) must have 8 matches');
  assert.equal(playOffLeg1[0].a, rankTeam(9));
  assert.equal(playOffLeg1[0].b, rankTeam(23));

  // Simulate Play-Off Leg 1 (Week 9) -> populates Leg 2 (Week 10)
  simulateSingleCareerWeek(league, teams);
  assert.equal(league.week, 10);
  const playOffLeg2 = league.schedule[9];
  assert.equal(playOffLeg2.length, 8, 'Play-Off 2nd leg (Week 10) must have 8 matches');
  assert.equal(playOffLeg2[0].a, rankTeam(23));
  assert.equal(playOffLeg2[0].b, rankTeam(9));
  assert.ok(playOffLeg2[0].firstLegSc, '2nd leg fixture must have firstLegSc populated after Leg 1');

  // Simulate Play-Off Leg 2 (Week 10) -> populates R16 Leg 1 (Week 11)
  simulateSingleCareerWeek(league, teams);
  assert.equal(league.week, 11);
  assert.equal(league.schedule[10].length, 8, 'Round of 16 1st leg (Week 11) must have 8 matches');

  // Simulate R16 Leg 1 (Week 11) & Leg 2 (Week 12)
  simulateSingleCareerWeek(league, teams);
  assert.equal(league.schedule[11].length, 8, 'Round of 16 2nd leg (Week 12) must have 8 matches');
  simulateSingleCareerWeek(league, teams);
  assert.equal(league.week, 13);
  assert.equal(league.schedule[12].length, 4, 'Quarter-Finals 1st leg (Week 13) must have 4 matches');

  // Simulate QF Leg 1 (Week 13) & Leg 2 (Week 14)
  simulateSingleCareerWeek(league, teams);
  assert.equal(league.schedule[13].length, 4, 'Quarter-Finals 2nd leg (Week 14) must have 4 matches');
  simulateSingleCareerWeek(league, teams);
  assert.equal(league.week, 15);
  assert.equal(league.schedule[14].length, 2, 'Semi-Finals 1st leg (Week 15) must have 2 matches');

  // Simulate SF Leg 1 (Week 15) & Leg 2 (Week 16)
  simulateSingleCareerWeek(league, teams);
  assert.equal(league.schedule[15].length, 2, 'Semi-Finals 2nd leg (Week 16) must have 2 matches');
  simulateSingleCareerWeek(league, teams);
  assert.equal(league.week, 17);
  assert.equal(league.schedule[16].length, 1, 'Final (Week 17) must be a single match');

  // Simulate Final (Week 17)
  simulateSingleCareerWeek(league, teams);
  assert.equal(league.week, 18);
  assert.equal(typeof league.uclChampionTeamIdx, 'number');
});



