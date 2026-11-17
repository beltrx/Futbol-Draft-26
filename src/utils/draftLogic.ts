import {
  ALL_CLUBS,
  CLUB_TO_LEAGUE,
  FORMATION_QUOTA,
  MODES,
  PLAYERS_BY_ID,
  PLAYERS_POOL,
  POSITIONS,
  ROUNDS,
} from '../data/database';
import type {
  DraftState,
  GameModeDef,
  GameModeId,
  Player,
  Position,
  Team,
} from '../types/game';

export function cost(p: Player): number {
  return p ? (p.price || 10) : 10;
}

export function posCountsOf(team: Pick<Team, 'picks'>): Record<Position, number> {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  team.picks.forEach((p) => {
    const k = p.pos || 'MID';
    counts[k] = (counts[k] || 0) + 1;
  });
  return counts;
}

export function canTeamPickPos(
  team: Pick<Team, 'picks'>,
  pos: Position,
  pool: Player[],
  taken: Set<number>,
  strictPos = true
): boolean {
  if (!strictPos) return true;
  const counts = posCountsOf(team);
  const k = pos || 'MID';
  const remSlots = ROUNDS - team.picks.length;

  const missingByPos: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  let totalMandatoryMissing = 0;
  for (const posKey of POSITIONS) {
    const miss = Math.max(0, FORMATION_QUOTA[posKey] - (counts[posKey] || 0));
    missingByPos[posKey] = miss;
    totalMandatoryMissing += miss;
  }

  if (missingByPos[k] > 0) return true;

  if (remSlots <= totalMandatoryMissing) {
    const anyNeededAvailable = pool.some((p) => !taken.has(p.id) && missingByPos[p.pos] > 0);
    return !anyNeededAvailable;
  }

  if (k === 'GK' && counts.GK >= 2) {
    const nonGkAvail = pool.some((p) => !taken.has(p.id) && p.pos !== 'GK');
    if (nonGkAvail) return false;
  }

  return true;
}

export function calcMinReserveAfterPick(
  g: Pick<DraftState, 'pool' | 'taken'>,
  t: Pick<Team, 'picks'>,
  candidateP: { id: number; pos?: Position },
  strictPos = true
): number {
  const remSlots = ROUNDS - t.picks.length - 1;
  if (remSlots <= 0) return 0;

  const untaken = g.pool.filter((x) => !g.taken.has(x.id) && x.id !== candidateP.id);
  if (!untaken.length) return 0;

  if (!strictPos) {
    const sortedCosts = untaken.map(cost).sort((a, b) => a - b);
    let sum = 0;
    for (let i = 0; i < remSlots && i < sortedCosts.length; i++) sum += sortedCosts[i];
    return sum;
  }

  const counts = posCountsOf(t);
  const candPos = candidateP.pos || 'MID';
  counts[candPos] = (counts[candPos] || 0) + 1;

  let reserve = 0;
  let slotsLeft = remSlots;
  const usedIds = new Set<number>();

  for (const posKey of POSITIONS) {
    const need = Math.max(0, FORMATION_QUOTA[posKey] - (counts[posKey] || 0));
    if (need > 0) {
      const posCheapest = untaken
        .filter((x) => x.pos === posKey)
        .sort((a, b) => cost(a) - cost(b));
      for (let i = 0; i < need && slotsLeft > 0; i++) {
        if (posCheapest[i]) {
          reserve += cost(posCheapest[i]);
          usedIds.add(posCheapest[i].id);
          slotsLeft--;
        }
      }
    }
  }

  if (slotsLeft > 0) {
    const restCheapest = untaken
      .filter((x) => !usedIds.has(x.id))
      .sort((a, b) => cost(a) - cost(b));
    for (let i = 0; i < slotsLeft && i < restCheapest.length; i++) {
      reserve += cost(restCheapest[i]);
    }
  }
  return reserve;
}

export function checkBudgetStatus(
  g: Pick<DraftState, 'm' | 'pool' | 'taken'>,
  t: Pick<Team, 'picks' | 'spent'>,
  p: Player,
  strictPos = true
): { ok: boolean; reason: string } {
  if (!g || !g.m.budget) return { ok: true, reason: '' };
  const remBudget = g.m.budget - t.spent;
  const price = cost(p);
  const remSlots = ROUNDS - t.picks.length - 1;

  if (price > remBudget) {
    return {
      ok: false,
      reason: `Satın Alma İptal Edildi: ${p.n} (${price} M€) için kalan bütçen (${remBudget} M€) yetersiz.`,
    };
  }

  if (remSlots > 0) {
    const minReserve = calcMinReserveAfterPick(g, t, p, strictPos);
    if (remBudget - price < minReserve) {
      return {
        ok: false,
        reason: `Bütçe Uyarısı — Alım İptal Edildi: ${p.n} (${price} M€) alınırsa kalan ${remSlots} oyuncu için ${remBudget - price} M€ kalır; ancak kalan boş mevkilerdeki en ucuz oyuncuları tamamlayabilmek için en az ${minReserve} M€ gerekiyor.`,
      };
    }
  }

  return { ok: true, reason: '' };
}

export function afford(
  g: Pick<DraftState, 'm' | 'pool' | 'taken'>,
  t: Pick<Team, 'picks' | 'spent'>,
  p: Player,
  strictPos = true
): boolean {
  return checkBudgetStatus(g, t, p, strictPos).ok;
}

export function canPickPlayer(
  g: Pick<DraftState, 'm' | 'pool' | 'taken'>,
  t: Pick<Team, 'picks' | 'spent'>,
  p: Player,
  strictPos = true
): boolean {
  if (!g || g.taken.has(p.id)) return false;
  if (!canTeamPickPos(t, p.pos, g.pool, g.taken, strictPos)) return false;
  if (!afford(g, t, p, strictPos)) return false;
  return true;
}

export function nameKey(n: string): string {
  return String(n || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function siblingIds(g: DraftState, p: Player): number[] {
  if (!p) return [];
  if (!g.nameGroups) {
    g.nameGroups = {};
    g.pool.forEach((q) => {
      const k = nameKey(q.n);
      (g.nameGroups![k] = g.nameGroups![k] || []).push(q);
    });
  }
  const grp = g.nameGroups[nameKey(p.n)] || [p];
  const hasIconic = grp.some((q) => q.lg === 'İkonik Takımlar');
  return hasIconic ? grp.map((q) => q.id) : [p.id];
}

export function getModeDef(modeId: GameModeId): GameModeDef {
  return MODES.find((m) => m.id === modeId) || MODES[0];
}

export interface BuildDraftParams {
  mode: GameModeId;
  leagues: Set<string>;
  clubs: Set<string>;
  opp: number;
  humanCount: number;
  format: 'snake' | 'linear';
  strictPos: boolean;
  netConnected?: boolean;
  myTeamIdx?: number;
}

export function buildDraftState(
  params: BuildDraftParams
): { state: DraftState | null; error: string; effectiveLeagues: Set<string> } {
  const m = getModeDef(params.mode);
  const leagues = new Set(params.leagues);
  if (params.clubs.size) {
    params.clubs.forEach((c) => {
      const lg = CLUB_TO_LEAGUE[c];
      if (lg) leagues.add(lg);
    });
  }

  let pool = PLAYERS_POOL.filter((p) => leagues.has(p.lg));
  if (params.clubs.size) {
    pool = pool.filter((p) => params.clubs.has(p.c));
  }
  pool = [...pool].sort((a, b) => a.n.localeCompare(b.n, 'tr'));
  if (m.clubs === 'required' && params.clubs.size < 2) {
    return {
      state: null,
      error: 'Kulüp Draftı için en az 2 kulüp seçmelisin.',
      effectiveLeagues: leagues,
    };
  }

  const effectiveHumans = params.netConnected ? 2 : params.humanCount;
  const n = m.career ? effectiveHumans : params.opp + 1;
  if (pool.length < n * ROUNDS) {
    return {
      state: null,
      error: `Seçili havuzda 14 kişilik (11 Asil + 3 Yedek) kadrolar için yeterli oyuncu yok (${pool.length} mevcut, en az ${n * ROUNDS} gerekli). Daha fazla kulüp veya lig seçin.`,
      effectiveLeagues: leagues,
    };
  }

  if (params.strictPos) {
    for (const posKey of POSITIONS) {
      const availInPos = pool.filter((p) => p.pos === posKey).length;
      const neededTotal = n * FORMATION_QUOTA[posKey];
      if (availInPos < neededTotal) {
        return {
          state: null,
          error: `Seçili havuzda yeterli ${posKey === 'GK' ? 'Kaleci' : posKey === 'DEF' ? 'Defans' : posKey === 'MID' ? 'Orta Saha' : 'Forvet'} yok (${availInPos} mevcut, en az ${neededTotal} gerekli). Daha fazla kulüp veya lig seçin.`,
          effectiveLeagues: leagues,
        };
      }
    }
  }

  let activeBudget: number | null = m.budget || null;
  if (activeBudget) {
    const cheapestPool = pool.map(cost).sort((a, b) => a - b);
    const min14Cost = cheapestPool.slice(0, n * ROUNDS).reduce((s, c) => s + c, 0) / n;
    if (min14Cost + 40 > activeBudget) {
      activeBudget = Math.ceil((min14Cost + 60) / 10) * 10;
    }
  }

  const cpuNames = ['Avrupa Elit XI', 'Kuzey Yıldızları XI', 'Akdeniz & Boğaz XI'];
  const cpuClubs = ['Real Madrid', 'Bayern Munchen', 'Inter'];
  const defaultPalette: { c1: string; c2: string; shape: 'shield' | 'circle' | 'stripes' | 'diamond' }[] = [
    { c1: '#166534', c2: '#eab308', shape: 'shield' },
    { c1: '#1e3a8a', c2: '#38bdf8', shape: 'circle' },
    { c1: '#7f1d1d', c2: '#fbbf24', shape: 'stripes' },
    { c1: '#3b0764', c2: '#f472b6', shape: 'diamond' },
  ];

  const teams: Team[] = [];
  for (let i = 0; i < n; i++) {
    const isHuman = i < effectiveHumans;
    let tName: string;
    if (params.netConnected) {
      if (i === 0) tName = '1. Oyuncu';
      else if (i === 1) tName = '2. Oyuncu';
      else tName = cpuNames[i - 1] || `CPU ${i}`;
    } else {
      tName = isHuman
        ? m.career && effectiveHumans === 1
          ? 'Senin Kulübün'
          : `${i + 1}. Oyuncu`
        : cpuNames[i - 1] || `CPU ${i}`;
    }

    const isMeLocal = params.netConnected ? i === (params.myTeamIdx ?? 0) : isHuman;
    const pal = defaultPalette[i % defaultPalette.length];
    teams.push({
      name: tName,
      me: isMeLocal ? 1 : 0,
      isHuman,
      identityDone: !isHuman,
      customIdentity: isHuman
        ? { type: 'custom', shape: pal.shape, c1: pal.c1, c2: pal.c2, club: 'Real Madrid' }
        : { type: 'club', shape: 'shield', c1: pal.c1, c2: pal.c2, club: cpuClubs[(i - 1) % cpuClubs.length] },
      picks: [],
      starters: null,
      bench: null,
      formation: '4-3-3',
      spent: 0,
    });
  }

  const order: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const o = teams.map((_, i) => i);
    order.push(...(params.format === 'snake' && r % 2 === 1 ? [...o].reverse() : o));
  }

  return {
    state: {
      m: { ...m, budget: activeBudget },
      pool,
      teams,
      order,
      k: 0,
      taken: new Set<number>(),
      history: [],
      budgetWarning: '',
    },
    error: '',
    effectiveLeagues: leagues,
  };
}

export function getWheelClubsForTurn(
  g: DraftState,
  t: Team,
  strictPos = true
): string[] {
  const validPlayers = g.pool.filter((p) => canPickPlayer(g, t, p, strictPos));
  const clubs = [...new Set(validPlayers.map((p) => p.c))];
  return clubs.length
    ? clubs
    : [...new Set(g.pool.filter((p) => !g.taken.has(p.id)).map((p) => p.c))];
}

export function pickRandomWheelPlayersForClub(
  g: DraftState,
  t: Team,
  club: string,
  strictPos = true,
  count = 4
): Player[] {
  const eligible = g.pool
    .filter((pl) => pl.c === club && !g.taken.has(pl.id))
    .filter((pl) => canPickPlayer(g, t, pl, strictPos));
  const source =
    eligible.length > 0
      ? [...eligible]
      : g.pool.filter((pl) => pl.c === club && !g.taken.has(pl.id));

  for (let i = source.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = source[i];
    source[i] = source[j];
    source[j] = tmp;
  }

  return source
    .slice(0, count)
    .sort((a, b) => a.n.localeCompare(b.n, 'tr'));
}

export function chooseCpuPlayer(
  g: DraftState,
  t: Team,
  strictPos = true
): Player | null {
  const av = g.pool.filter((p) => canPickPlayer(g, t, p, strictPos));
  if (!av.length && g.m.budget) {
    const validPos = g.pool
      .filter((p) => !g.taken.has(p.id) && canTeamPickPos(t, p.pos, g.pool, g.taken, strictPos))
      .sort((a, b) => cost(a) - cost(b));
    if (validPos.length && cost(validPos[0]) <= g.m.budget - t.spent) {
      return validPos[0];
    }
  }
  if (!av.length) return null;

  if (g.m.id === 'wheel') {
    const clubs = getWheelClubsForTurn(g, t, strictPos);
    const landedClub = clubs[(Math.random() * clubs.length) | 0];
    const clubValid = av.filter((p) => p.c === landedClub);
    if (clubValid.length) {
      const shuffled = clubValid.slice().sort(() => Math.random() - 0.5).slice(0, 2);
      shuffled.sort((a, b) => b.r - a.r);
      return shuffled[0];
    }
    return av[(Math.random() * av.length) | 0];
  }

  const lgCounts: Record<string, number> = {};
  const clubCounts: Record<string, number> = {};
  t.picks.forEach((pk) => {
    lgCounts[pk.lg] = (lgCounts[pk.lg] || 0) + 1;
    clubCounts[pk.c] = (clubCounts[pk.c] || 0) + 1;
  });

  let candidates = av;
  if (g.m.budget) {
    const remBudget = g.m.budget - t.spent;
    const remSlots = ROUNDS - t.picks.length;
    const targetAvg = (remBudget / Math.max(1, remSlots)) * 1.4;
    const balanced = av.filter((p) => cost(p) <= targetAvg);
    if (balanced.length) candidates = balanced;
  }

  const scored = candidates
    .map((p) => {
      const lgPen = (lgCounts[p.lg] || 0) * 1.6;
      const clubPen = (clubCounts[p.c] || 0) * 2.5;
      const noise = (Math.random() - 0.5) * 6.5;
      return { p, score: p.r - lgPen - clubPen + noise };
    })
    .sort((a, b) => b.score - a.score);

  const poolSize = Math.min(12, scored.length);
  const topCandidates = scored.slice(0, poolSize);
  const weights = topCandidates.map((_, idx) => Math.pow(poolSize - idx, 1.3));
  let rnd = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < topCandidates.length; i++) {
    if ((rnd -= weights[i]) <= 0) return topCandidates[i].p;
  }
  return topCandidates[0].p;
}

export function cloneDraftState(g: DraftState): DraftState {
  return {
    ...g,
    taken: new Set(g.taken),
    history: [...g.history],
    teams: g.teams.map((tm) => ({
      ...tm,
      customIdentity: { ...tm.customIdentity },
      picks: [...tm.picks],
      starters: tm.starters ? [...tm.starters] : null,
      bench: tm.bench ? [...tm.bench] : null,
    })),
  };
}

export function getActiveModernClubsByLeagues(leagues: Set<string>): string[] {
  return ALL_CLUBS.filter((c) => leagues.has(CLUB_TO_LEAGUE[c] || 'Diğer Takımlar'));
}

export function getPlayerById(id: number): Player | undefined {
  return PLAYERS_BY_ID[id];
}
