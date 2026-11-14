import { FORMATIONS, STARTERS_COUNT } from '../data/database';
import type {
  FormationDef,
  FormationName,
  LeagueState,
  LineupPlayer,
  PitchRow,
  Player,
  Position,
  Team,
} from '../types/game';

export function getFormationDef(formName?: FormationName): FormationDef {
  return (formName && FORMATIONS[formName]) || FORMATIONS['4-3-3'];
}

export function isPlayerUnavailableInCareer(
  playerId: number,
  lg: LeagueState | null | undefined,
  isCareerMode = true
): boolean {
  return !!(isCareerMode && lg && lg.injuries && lg.injuries[playerId] > 0);
}

export function isPlayerSuspendedInCareer(
  playerId: number,
  lg: LeagueState | null | undefined,
  isCareerMode = true
): boolean {
  return !!(
    isCareerMode &&
    lg &&
    lg.injuries &&
    lg.injuries[playerId] > 0 &&
    lg.suspensions &&
    lg.suspensions[playerId] > 0
  );
}

export function getEffectivePlayerRating(p: Player | undefined, slotPos?: Position): number {
  if (!p) return 70;
  const baseR = p.r || 75;
  if (slotPos && p.pos !== slotPos) {
    return Math.max(40, baseR - 10);
  }
  return baseR;
}

export function getStarterSlotPosMap(formName: FormationName = '4-3-3'): Position[] {
  const fDef = getFormationDef(formName);
  const slotPositions: Position[] = [];
  fDef.rows.forEach((rDef) => {
    for (let i = 0; i < rDef.count; i++) slotPositions.push(rDef.pos);
  });
  return slotPositions;
}

/**
 * Enforces that injured or red-card suspended players in Career Mode are benched
 * for BOTH human AND AI teams (fixing the bug where AI teams played red-carded players).
 */
export function enforceHealthyStartersForTeam(
  t: Team,
  lg?: LeagueState | null,
  isCareer = true
): void {
  if (!isCareer || !lg || !lg.injuries || !t) return;
  if (!t.starters || !t.bench) return;

  const slotPositions = getStarterSlotPosMap(t.formation || '4-3-3');
  for (let i = 0; i < t.starters.length; i++) {
    const sp = t.starters[i];
    if (sp && lg.injuries[sp.id] > 0) {
      const targetPos = slotPositions[i] || sp.pos;
      let bIdx = t.bench.findIndex(
        (bp) => bp && !(lg.injuries[bp.id] > 0) && bp.pos === targetPos
      );
      if (bIdx < 0) {
        bIdx = t.bench.findIndex((bp) => bp && !(lg.injuries[bp.id] > 0));
      }
      if (bIdx >= 0) {
        const healthySub = t.bench[bIdx];
        t.starters[i] = healthySub;
        t.bench[bIdx] = sp;
      }
    }
  }
}

export function autoBuildLineupForTeam(
  t: Team,
  formName: FormationName = '4-3-3',
  lg?: LeagueState | null,
  isCareer = false
): void {
  t.formation = formName;
  const fDef = getFormationDef(formName);
  const checkUnavailable = !!(isCareer && lg && lg.injuries);
  const sorted = [...t.picks].sort((a, b) => {
    if (checkUnavailable) {
      const unavailA = lg!.injuries[a.id] > 0 ? 1 : 0;
      const unavailB = lg!.injuries[b.id] > 0 ? 1 : 0;
      if (unavailA !== unavailB) return unavailA - unavailB;
    }
    return b.r - a.r;
  });
  const used = new Set<number>();

  const rowBuckets = fDef.rows.map((rDef) => {
    const matched = sorted
      .filter(
        (p) =>
          p.pos === rDef.pos &&
          !used.has(p.id) &&
          (!checkUnavailable || !(lg!.injuries[p.id] > 0))
      )
      .slice(0, rDef.count);
    matched.forEach((p) => used.add(p.id));
    return { count: rDef.count, players: matched };
  });

  rowBuckets.forEach((b) => {
    while (b.players.length < b.count) {
      let nextP = sorted.find(
        (p) => !used.has(p.id) && (!checkUnavailable || !(lg!.injuries[p.id] > 0))
      );
      if (!nextP) nextP = sorted.find((p) => !used.has(p.id));
      if (!nextP) break;
      used.add(nextP.id);
      b.players.push(nextP);
    }
  });

  t.starters = rowBuckets.flatMap((b) => b.players);
  t.bench = t.picks.filter((p) => !used.has(p.id));
}

export function ensureTeamLineup(
  t: Team,
  lg?: LeagueState | null,
  isCareer = false
): void {
  if (
    t.starters &&
    t.starters.length === STARTERS_COUNT &&
    t.bench &&
    t.bench.length === t.picks.length - STARTERS_COUNT
  ) {
    if (isCareer && lg) {
      enforceHealthyStartersForTeam(t, lg, true);
    }
    return;
  }
  autoBuildLineupForTeam(t, t.formation || '4-3-3', lg, isCareer);
}

export function buildPitchRowsForTeam(
  t: Team,
  lg?: LeagueState | null,
  isCareer = false
): PitchRow[] {
  ensureTeamLineup(t, lg, isCareer);
  const fDef = getFormationDef(t.formation || '4-3-3');
  let cursor = 0;
  return fDef.rows.map((rDef) => {
    const slice = (t.starters || []).slice(cursor, cursor + rDef.count);
    cursor += rDef.count;
    return {
      label: rDef.label,
      pos: rDef.pos,
      count: rDef.count,
      players: slice,
    };
  });
}

export function groupStartersForPitch(
  t: Team,
  lg?: LeagueState | null,
  isCareer = false
): Record<Position, LineupPlayer[]> {
  const rows = buildPitchRowsForTeam(t, lg, isCareer);
  const L: Record<Position, LineupPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  rows.forEach((r) => {
    r.players.forEach((p) => {
      const effR = getEffectivePlayerRating(p, r.pos);
      L[r.pos].push({
        ...p,
        effR,
        outOfPos: p.pos !== r.pos,
        slotPos: r.pos,
      });
    });
  });
  return L;
}

export function swapTeamPlayers(
  t: Team,
  id1: number,
  id2: number,
  lg?: LeagueState | null,
  isCareer = false
): { swapped: boolean; error: string } {
  ensureTeamLineup(t, lg, isCareer);
  const starters = [...(t.starters || [])];
  const bench = [...(t.bench || [])];

  const sIdx1 = starters.findIndex((p) => p.id === id1);
  const sIdx2 = starters.findIndex((p) => p.id === id2);
  const bIdx1 = bench.findIndex((p) => p.id === id1);
  const bIdx2 = bench.findIndex((p) => p.id === id2);

  if (
    t.me &&
    isCareer &&
    lg &&
    ((sIdx1 >= 0 && bIdx2 >= 0 && isPlayerUnavailableInCareer(id2, lg, true)) ||
      (bIdx1 >= 0 && sIdx2 >= 0 && isPlayerUnavailableInCareer(id1, lg, true)))
  ) {
    const injId = isPlayerUnavailableInCareer(id1, lg, true) ? id1 : id2;
    const pObj = t.picks.find((x) => x.id === injId);
    const wLeft = lg.injuries[injId] || 1;
    const isSusp = !!(lg.suspensions && lg.suspensions[injId]);
    return {
      swapped: false,
      error: isSusp
        ? `Ceza Engeli: ${pObj ? pObj.n : 'Oyuncu'} kırmızı kart cezalı (${wLeft} maç) olduğu için İlk 11 kadrosuna koyulamaz!`
        : `Sakatlık Engeli: ${pObj ? pObj.n : 'Oyuncu'} sakat olduğu için (${wLeft} hafta) İlk 11 kadrosuna koyulamaz!`,
    };
  }

  if (sIdx1 >= 0 && bIdx2 >= 0) {
    const temp = starters[sIdx1];
    starters[sIdx1] = bench[bIdx2];
    bench[bIdx2] = temp;
  } else if (bIdx1 >= 0 && sIdx2 >= 0) {
    const temp = bench[bIdx1];
    bench[bIdx1] = starters[sIdx2];
    starters[sIdx2] = temp;
  } else if (sIdx1 >= 0 && sIdx2 >= 0) {
    const temp = starters[sIdx1];
    starters[sIdx1] = starters[sIdx2];
    starters[sIdx2] = temp;
  } else if (bIdx1 >= 0 && bIdx2 >= 0) {
    const temp = bench[bIdx1];
    bench[bIdx1] = bench[bIdx2];
    bench[bIdx2] = temp;
  }

  t.starters = starters;
  t.bench = bench;
  return { swapped: true, error: '' };
}
