import type {
  AttackTempo,
  AttackWidth,
  BuildUpStyle,
  CounterPress,
  DefensiveLine,
  FinalThirdInstruction,
  Player,
  PressIntensity,
  SideEvaluation,
  TacklingApproach,
  Team,
  TeamTactics,
} from '../types/game';

export const DEFAULT_TACTICS: TeamTactics = {
  pressIntensity: 'mid',
  defensiveLine: 'standard',
  tackling: 'balanced',
  counterPress: 'off',
  buildUp: 'mixed',
  tempo: 'balanced',
  width: 'normal',
  finalThird: 'space',
};

export interface TacticOptionMeta<T extends string> {
  value: T;
  label: string;
  hint: string;
}

export const PRESS_OPTIONS: TacticOptionMeta<PressIntensity>[] = [
  { value: 'low', label: 'Düşük Blok', hint: 'Enerji korur, kendi yarı sahasında alan daraltır.' },
  { value: 'mid', label: 'Orta Blok', hint: 'Pas kanallarını kapatır, dengeli geçiş arar.' },
  { value: 'high', label: 'Yüksek Şiddetli Pres', hint: 'Rakibi hataya zorlar, kondisyon tüketimi yüksektir.' },
];

export const DEFENSIVE_LINE_OPTIONS: TacticOptionMeta<DefensiveLine>[] = [
  { value: 'deep', label: 'Derin', hint: 'Arkaya koşu riskini azaltır, ceza sahasını sıkılaştırır.' },
  { value: 'standard', label: 'Standart', hint: 'Orta mesafe kompaktlık sağlar.' },
  { value: 'high', label: 'Yüksek', hint: 'Önde sıkıştırır, hızlı forvetlere karşı alan bırakabilir.' },
];

export const TACKLING_OPTIONS: TacticOptionMeta<TacklingApproach>[] = [
  { value: 'cautious', label: 'Temkinli / Ayakta', hint: 'Faul ve kart riskini düşürür, pozisyonda kalır.' },
  { value: 'balanced', label: 'Dengeli', hint: 'Standart müdahale zamanlaması uygular.' },
  { value: 'aggressive', label: 'Agresif / Sert', hint: 'Top kapma şansını artırır, kart riskini yükseltir.' },
];

export const COUNTER_PRESS_OPTIONS: TacticOptionMeta<CounterPress>[] = [
  { value: 'on', label: 'Açık', hint: 'Kaybedilen topu ilk 5 saniyede geri almaya çalışır.' },
  { value: 'off', label: 'Kapalı', hint: 'Hızlıca savunma yerleşimine döner.' },
];

export const BUILDUP_OPTIONS: TacticOptionMeta<BuildUpStyle>[] = [
  { value: 'short', label: 'Kısa Pasla Çıkış', hint: 'Geriden pas kurar; yoğun preste risk taşıyabilir.' },
  { value: 'mixed', label: 'Karma / Akıcı', hint: 'Duruma göre kısa ve uzun pas dengesi kurar.' },
  { value: 'direct', label: 'Direkt / Uzun Top', hint: 'Baskıyı kırar, hızlı veya hedef oyunculara oynar.' },
];

export const TEMPO_OPTIONS: TacticOptionMeta<AttackTempo>[] = [
  { value: 'patient', label: 'Sabırlı / Düşük', hint: 'Topa sahip olur, kontrollü boşluk arar.' },
  { value: 'balanced', label: 'Dengeli', hint: 'Ritmi oyunun akışına göre ayarlar.' },
  { value: 'fast', label: 'Hızlı / Dikine', hint: 'Ani geçiş ve dikine paslarla kaleye iner.' },
];

export const WIDTH_OPTIONS: TacticOptionMeta<AttackWidth>[] = [
  { value: 'narrow', label: 'Dar', hint: 'Merkezde çoğalır, kısa kombinasyonları besler.' },
  { value: 'normal', label: 'Normal', hint: 'Sahayı dengeli genişlikte kullanır.' },
  { value: 'wide', label: 'Geniş', hint: 'Kanatları açar, çizgi ve bek bindirmelerini artırır.' },
];

export const FINAL_THIRD_OPTIONS: TacticOptionMeta<FinalThirdInstruction>[] = [
  { value: 'box', label: 'Ceza Sahasına Yıkıl', hint: 'Orta ve şut sıklığını artırır, kalabalık bitirir.' },
  { value: 'space', label: 'Boşluğu Ara', hint: 'Sabırlı paslarla en net pozisyonu kovalar.' },
  { value: 'counter', label: 'Hızlı Geçiş / Kontra', hint: 'Topu kapar kapmaz savunma arkasına sarkar.' },
];

export interface TacticPreset {
  id: string;
  label: string;
  tactics: TeamTactics;
}

export const TACTIC_PRESETS: TacticPreset[] = [
  {
    id: 'balanced',
    label: 'Dengeli',
    tactics: { ...DEFAULT_TACTICS },
  },
  {
    id: 'gegenpress',
    label: 'Yüksek Pres',
    tactics: {
      pressIntensity: 'high',
      defensiveLine: 'high',
      tackling: 'aggressive',
      counterPress: 'on',
      buildUp: 'mixed',
      tempo: 'fast',
      width: 'normal',
      finalThird: 'counter',
    },
  },
  {
    id: 'possession',
    label: 'Topa Sahip Olma',
    tactics: {
      pressIntensity: 'mid',
      defensiveLine: 'high',
      tackling: 'cautious',
      counterPress: 'on',
      buildUp: 'short',
      tempo: 'patient',
      width: 'narrow',
      finalThird: 'space',
    },
  },
  {
    id: 'counter',
    label: 'Kontra Atak',
    tactics: {
      pressIntensity: 'low',
      defensiveLine: 'deep',
      tackling: 'balanced',
      counterPress: 'off',
      buildUp: 'direct',
      tempo: 'fast',
      width: 'wide',
      finalThird: 'counter',
    },
  },
  {
    id: 'wingplay',
    label: 'Kanat & Orta',
    tactics: {
      pressIntensity: 'mid',
      defensiveLine: 'standard',
      tackling: 'balanced',
      counterPress: 'off',
      buildUp: 'mixed',
      tempo: 'balanced',
      width: 'wide',
      finalThird: 'box',
    },
  },
];

export function getTeamTactics(team?: Team | null): TeamTactics {
  if (!team?.tactics) return { ...DEFAULT_TACTICS };
  return { ...DEFAULT_TACTICS, ...team.tactics };
}

export interface SquadTraitProfile {
  speed: number;
  stamina: number;
  passing: number;
  finishing: number;
  aerial: number;
  crossing: number;
  leadership: number;
  aggressive: number;
  gkReflex: number;
  gkPenSpecialist: number;
  defTacklers: number;
}

const SPEED_TRAITS = new Set(['Hızlı', 'Patlayıcı', 'Hızlı Driblingci', 'Çeviklik']);
const STAMINA_TRAITS = new Set(['Dayanıklı', 'Çalışkan', 'All-Around']);
const PASSING_TRAITS = new Set(['Pasör', 'Teknik', 'Kreatif', 'Taktiksel', 'Dribling']);
const FINISHING_TRAITS = new Set(['Bitirici', 'Fırsatçı', 'Şut Gücü', 'Şutör', 'Frikik', 'Penaltı']);
const AERIAL_TRAITS = new Set(['Hava Uzmanı', 'Güçlü', 'Zıplama']);

export function evaluateSquadTraitProfile(starters: Player[]): SquadTraitProfile {
  const prof: SquadTraitProfile = {
    speed: 0,
    stamina: 0,
    passing: 0,
    finishing: 0,
    aerial: 0,
    crossing: 0,
    leadership: 0,
    aggressive: 0,
    gkReflex: 0,
    gkPenSpecialist: 0,
    defTacklers: 0,
  };

  for (const p of starters) {
    const tr = p.trait || '';
    const rl = p.role || '';

    if (SPEED_TRAITS.has(tr) || rl === 'Kanat Forvet' || rl === 'Kanat Oyuncusu') prof.speed++;
    if (STAMINA_TRAITS.has(tr) || rl === 'Çift Yönlü') prof.stamina++;
    if (
      PASSING_TRAITS.has(tr) ||
      rl === 'Derin Oyun Kurucu' ||
      rl === 'Oyun Kurucu' ||
      rl === 'Ofansif Oyun Kurucu' ||
      rl === 'Pasör Savunmacı' ||
      rl === 'Libero'
    ) {
      prof.passing++;
    }
    if (
      FINISHING_TRAITS.has(tr) ||
      rl === 'Ceza Sahası Golcüsü' ||
      rl === 'Fırsatçı Golcü' ||
      rl === 'Komple Forvet'
    ) {
      prof.finishing++;
    }
    if (AERIAL_TRAITS.has(tr) || rl === 'Pivot Forvet' || rl === 'Hava Uzmanı') prof.aerial++;
    if (tr === 'Orta Açma' || rl === 'Ofansif Savunmacı' || rl === 'Yardımcı Kanat') prof.crossing++;
    if (tr === 'Lider') prof.leadership++;
    if (tr === 'Agresif' || rl === 'Kesici' || rl === 'Savunmacı Orta Saha') prof.aggressive++;
    if (p.pos === 'GK' && (tr === 'Refleks' || tr === 'Akrobatik' || rl === 'Libero Kaleci')) {
      prof.gkReflex++;
    }
    if (p.pos === 'GK' && tr === 'Penaltı Kurtarma') prof.gkPenSpecialist++;
    if (p.pos === 'DEF' && (rl === 'Kesici' || rl === 'Klasik Savunmacı' || tr === 'Taktiksel')) {
      prof.defTacklers++;
    }
  }

  return prof;
}

export interface TacticalFitSummary {
  fitRating: number;
  staminaLevel: 'Düşük' | 'Dengeli' | 'Yüksek';
  cardRisk: 'Düşük' | 'Orta' | 'Yüksek';
  strengthNote: string;
}

export function evaluateTacticalFit(starters: Player[], tactics: TeamTactics): TacticalFitSummary {
  const prof = evaluateSquadTraitProfile(starters);

  let fit = 0;

  // Press & stamina fit
  if (tactics.pressIntensity === 'high') {
    fit += prof.stamina >= 3 ? 0.65 : -0.45;
  } else if (tactics.pressIntensity === 'low') {
    fit += prof.defTacklers >= 2 || prof.aerial >= 3 ? 0.45 : 0.1;
  } else {
    fit += 0.25;
  }

  if (tactics.counterPress === 'on') {
    fit += prof.stamina >= 3 || prof.aggressive >= 2 ? 0.4 : -0.3;
  }

  // Build-up fit
  if (tactics.buildUp === 'short') {
    fit += prof.passing >= 4 ? 0.7 : -0.4;
  } else if (tactics.buildUp === 'direct') {
    fit += prof.speed >= 3 || prof.aerial >= 3 ? 0.65 : -0.25;
  } else {
    fit += 0.25;
  }

  // Tempo & width fit
  if (tactics.tempo === 'fast') {
    fit += prof.speed >= 3 ? 0.5 : -0.2;
  } else if (tactics.tempo === 'patient') {
    fit += prof.passing >= 4 ? 0.5 : -0.15;
  }

  if (tactics.width === 'wide') {
    fit += prof.crossing >= 2 || prof.speed >= 3 ? 0.45 : -0.15;
  } else if (tactics.width === 'narrow') {
    fit += prof.passing >= 4 ? 0.45 : -0.15;
  }

  // Final third fit
  if (tactics.finalThird === 'box') {
    fit += prof.aerial >= 3 || prof.finishing >= 3 ? 0.55 : -0.15;
  } else if (tactics.finalThird === 'counter') {
    fit += prof.speed >= 3 ? 0.55 : -0.25;
  } else {
    fit += prof.passing >= 4 ? 0.45 : 0.1;
  }

  // Leadership bonus
  fit += Math.min(0.6, prof.leadership * 0.25);

  const highEnergyDemand =
    (tactics.pressIntensity === 'high' ? 2 : tactics.pressIntensity === 'mid' ? 1 : 0) +
    (tactics.counterPress === 'on' ? 1 : 0) +
    (tactics.tempo === 'fast' ? 1 : 0);

  const staminaLevel: TacticalFitSummary['staminaLevel'] =
    highEnergyDemand >= 3 ? (prof.stamina >= 4 ? 'Dengeli' : 'Yüksek') : highEnergyDemand <= 1 ? 'Düşük' : 'Dengeli';

  const cardRisk: TacticalFitSummary['cardRisk'] =
    tactics.tackling === 'aggressive'
      ? 'Yüksek'
      : tactics.tackling === 'cautious'
      ? 'Düşük'
      : prof.aggressive >= 4
      ? 'Yüksek'
      : 'Orta';

  let strengthNote = 'Dengeli kadro kurgusu';
  if (prof.speed >= 4 && (tactics.finalThird === 'counter' || tactics.tempo === 'fast')) {
    strengthNote = 'Hızlı geçişlerde yüksek tehdit';
  } else if (prof.passing >= 5 && (tactics.buildUp === 'short' || tactics.finalThird === 'space')) {
    strengthNote = 'Pas bağlantısı ve oyun kurma üstünlüğü';
  } else if (prof.aerial >= 3 && tactics.finalThird === 'box') {
    strengthNote = 'Ceza sahası ve hava toplarında etkinlik';
  } else if (prof.stamina >= 4 && tactics.pressIntensity === 'high') {
    strengthNote = 'Yüksek prese uygun dayanıklı kadro';
  }

  return {
    fitRating: Number(fit.toFixed(2)),
    staminaLevel,
    cardRisk,
    strengthNote,
  };
}

export interface TacticalMatchupModifiers {
  attModA: number;
  defModA: number;
  midModA: number;
  attModB: number;
  defModB: number;
  midModB: number;
  redProbA: number;
  redProbB: number;
  cardProbA: number;
  cardProbB: number;
  goalPaceMod: number;
  penBonusA: number;
  penBonusB: number;
}

export function evaluateTacticalMatchup(
  sA: SideEvaluation,
  sB: SideEvaluation,
  rawTacA?: TeamTactics,
  rawTacB?: TeamTactics
): TacticalMatchupModifiers {
  const tacA = rawTacA ? { ...DEFAULT_TACTICS, ...rawTacA } : DEFAULT_TACTICS;
  const tacB = rawTacB ? { ...DEFAULT_TACTICS, ...rawTacB } : DEFAULT_TACTICS;

  const startersA = sA.pitchRows.flatMap((r) => r.players);
  const startersB = sB.pitchRows.flatMap((r) => r.players);

  const profA = evaluateSquadTraitProfile(startersA);
  const profB = evaluateSquadTraitProfile(startersB);
  const fitA = evaluateTacticalFit(startersA, tacA);
  const fitB = evaluateTacticalFit(startersB, tacB);

  let attModA = fitA.fitRating * 0.45 + Math.min(1.0, profA.finishing * 0.2);
  let defModA = fitA.fitRating * 0.35 + profA.gkReflex * 0.45;
  let midModA = fitA.fitRating * 0.4;

  let attModB = fitB.fitRating * 0.45 + Math.min(1.0, profB.finishing * 0.2);
  let defModB = fitB.fitRating * 0.35 + profB.gkReflex * 0.45;
  let midModB = fitB.fitRating * 0.4;

  // Apply tactical rock-paper-scissors symmetrically
  const applyPair = (
    own: TeamTactics,
    opp: TeamTactics,
    ownProf: SquadTraitProfile,
    oppProf: SquadTraitProfile
  ): { att: number; def: number; mid: number; pace: number } => {
    let att = 0;
    let def = 0;
    let mid = 0;
    let pace = 0;

    // 1. Press intensity
    if (own.pressIntensity === 'high') {
      mid += 0.55;
      pace += 0.25;
      if (opp.buildUp === 'short' && oppProf.passing < 5) {
        att += 0.85;
        def += 0.25;
      }
      if (ownProf.stamina < 3) {
        def -= 0.65; // late fatigue vulnerability
      }
    } else if (own.pressIntensity === 'low') {
      def += 0.7;
      att -= 0.25;
      pace -= 0.25;
    } else {
      mid += 0.25;
    }

    // 2. Defensive line vs opponent direct/counter speed
    if (own.defensiveLine === 'high') {
      mid += 0.45;
      att += 0.25;
      if (opp.buildUp === 'direct' || opp.finalThird === 'counter') {
        def -= 0.55 + Math.min(0.65, oppProf.speed * 0.16);
        pace += 0.2;
      }
    } else if (own.defensiveLine === 'deep') {
      def += 0.65;
      mid -= 0.3;
      pace -= 0.2;
      if (opp.finalThird === 'box' && (oppProf.aerial >= 3 || oppProf.crossing >= 2)) {
        def -= 0.45; // deep block punished by aerial/crosses
      }
    }

    // 3. Tackling approach
    if (own.tackling === 'aggressive') {
      def += 0.5;
      mid += 0.3;
      if (opp.finalThird === 'space' && opp.tempo === 'patient') {
        def -= 0.4; // patient play draws fouls/gaps
      }
    } else if (own.tackling === 'cautious') {
      def -= 0.2;
      mid += 0.15;
    }

    // 4. Counter-press
    if (own.counterPress === 'on') {
      att += 0.45;
      mid += 0.35;
      pace += 0.15;
      if (ownProf.stamina < 3) def -= 0.35;
    } else {
      def += 0.3;
    }

    // 5. Build-up & Tempo & Width & Final Third
    if (own.buildUp === 'short' && opp.pressIntensity !== 'high') {
      mid += 0.55;
      att += 0.3;
    } else if (own.buildUp === 'direct' && opp.pressIntensity === 'high') {
      att += 0.65;
      pace += 0.15;
    }

    if (own.tempo === 'fast') {
      att += 0.45;
      def -= 0.2;
      pace += 0.25;
    } else if (own.tempo === 'patient') {
      mid += 0.45;
      def += 0.2;
      pace -= 0.15;
    }

    if (own.width === 'wide' && opp.defensiveLine === 'deep') {
      att += 0.45 + Math.min(0.4, ownProf.crossing * 0.15);
    } else if (own.width === 'narrow' && opp.width === 'wide') {
      mid += 0.45;
    }

    if (own.finalThird === 'box') {
      att += 0.45 + Math.min(0.45, ownProf.aerial * 0.14);
      pace += 0.2;
    } else if (own.finalThird === 'counter') {
      att += opp.defensiveLine === 'high' ? 0.75 : 0.3;
      pace += 0.1;
    } else {
      att += 0.35;
    }

    return { att, def, mid, pace };
  };

  const pairA = applyPair(tacA, tacB, profA, profB);
  const pairB = applyPair(tacB, tacA, profB, profA);

  attModA += pairA.att;
  defModA += pairA.def;
  midModA += pairA.mid;

  attModB += pairB.att;
  defModB += pairB.def;
  midModB += pairB.mid;

  const baseRed = (tac: TeamTactics, prof: SquadTraitProfile): number => {
    let p = tac.tackling === 'aggressive' ? 0.2 : tac.tackling === 'cautious' ? 0.05 : 0.11;
    if (tac.counterPress === 'on') p += 0.02;
    p += Math.min(0.05, prof.aggressive * 0.012);
    p -= Math.min(0.04, prof.leadership * 0.015);
    return Math.max(0.03, Math.min(0.28, p));
  };

  const baseCard = (tac: TeamTactics, prof: SquadTraitProfile): number => {
    let p = tac.tackling === 'aggressive' ? 0.16 : tac.tackling === 'cautious' ? 0.04 : 0.08;
    p += Math.min(0.06, prof.aggressive * 0.015);
    return Math.max(0.03, Math.min(0.24, p));
  };

  return {
    attModA: Number(attModA.toFixed(2)),
    defModA: Number(defModA.toFixed(2)),
    midModA: Number(midModA.toFixed(2)),
    attModB: Number(attModB.toFixed(2)),
    defModB: Number(defModB.toFixed(2)),
    midModB: Number(midModB.toFixed(2)),
    redProbA: baseRed(tacA, profA),
    redProbB: baseRed(tacB, profB),
    cardProbA: baseCard(tacA, profA),
    cardProbB: baseCard(tacB, profB),
    goalPaceMod: Number((pairA.pace + pairB.pace).toFixed(2)),
    penBonusA: profA.gkPenSpecialist * 0.08 + profA.gkReflex * 0.03,
    penBonusB: profB.gkPenSpecialist * 0.08 + profB.gkReflex * 0.03,
  };
}

export function pickAiTacticsForTeam(team: Team): TeamTactics {
  const starters = team.starters && team.starters.length ? team.starters : team.picks.slice(0, 11);
  const prof = evaluateSquadTraitProfile(starters);
  const avgR = starters.reduce((s, p) => s + p.r, 0) / (starters.length || 1);

  if (avgR >= 84 && prof.passing >= 5) {
    return { ...TACTIC_PRESETS[2].tactics }; // Topa Sahip Olma
  }
  if (prof.stamina >= 4 && avgR >= 81) {
    return { ...TACTIC_PRESETS[1].tactics }; // Yüksek Pres
  }
  if (avgR < 78 || (prof.speed >= 4 && prof.passing < 4)) {
    return { ...TACTIC_PRESETS[3].tactics }; // Kontra Atak
  }
  if (prof.aerial >= 3 && prof.crossing >= 2) {
    return { ...TACTIC_PRESETS[4].tactics }; // Kanat & Orta
  }
  return { ...DEFAULT_TACTICS };
}

export function formatTacticsBrief(tactics?: TeamTactics): string {
  const t = tactics ? { ...DEFAULT_TACTICS, ...tactics } : DEFAULT_TACTICS;
  const press = PRESS_OPTIONS.find((o) => o.value === t.pressIntensity)?.label || 'Orta Blok';
  const line = DEFENSIVE_LINE_OPTIONS.find((o) => o.value === t.defensiveLine)?.label || 'Standart';
  const build = BUILDUP_OPTIONS.find((o) => o.value === t.buildUp)?.label || 'Karma';
  const finalT = FINAL_THIRD_OPTIONS.find((o) => o.value === t.finalThird)?.label || 'Boşluğu Ara';
  return `${press} · ${line} · ${build} · ${finalT}`;
}
