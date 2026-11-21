export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type FormationName = '4-3-3' | '4-2-3-1' | '4-4-2' | '3-5-2';

export type IdentityShape = 'shield' | 'circle' | 'stripes' | 'diamond' | 'star';

export interface ClubCrestDef {
  c1: string;
  c2: string;
  acc: string;
  code: string;
  pat: 'shield' | 'circle' | 'stripes';
}

export interface Player {
  id: number;
  n: string;
  c: string;
  lg: string;
  r: number;
  pos: Position;
  price: number;
  nat?: string;
  age?: number | null;
  trait?: string;
  role?: string;
  isNationalIcon?: boolean;
}

export type PressIntensity = 'low' | 'mid' | 'high';
export type DefensiveLine = 'deep' | 'standard' | 'high';
export type TacklingApproach = 'cautious' | 'balanced' | 'aggressive';
export type CounterPress = 'on' | 'off';
export type BuildUpStyle = 'short' | 'mixed' | 'direct';
export type AttackTempo = 'patient' | 'balanced' | 'fast';
export type AttackWidth = 'narrow' | 'normal' | 'wide';
export type FinalThirdInstruction = 'box' | 'space' | 'counter';

export interface TeamTactics {
  pressIntensity: PressIntensity;
  defensiveLine: DefensiveLine;
  tackling: TacklingApproach;
  counterPress: CounterPress;
  buildUp: BuildUpStyle;
  tempo: AttackTempo;
  width: AttackWidth;
  finalThird: FinalThirdInstruction;
}

export interface TeamCustomIdentity {
  type: 'custom' | 'club';
  shape: IdentityShape;
  c1: string;
  c2: string;
  club: string;
}

export interface Team {
  name: string;
  me: number;
  isHuman: boolean;
  identityDone: boolean;
  customIdentity: TeamCustomIdentity;
  picks: Player[];
  starters: Player[] | null;
  bench: Player[] | null;
  formation: FormationName;
  spent: number;
  tactics?: TeamTactics;
}

export type GameModeId =
  | 'career'
  | 'classic'
  | 'wheel'
  | 'iconic'
  | 'club'
  | 'budget'
  | 'auction';

export interface GameModeDef {
  id: GameModeId;
  name: string;
  tag: string;
  d: string;
  clubs: 'optional' | 'required';
  cpu: 'best' | 'wheel';
  budget?: number;
  career?: number;
  special?: number;
  wheel?: number;
  auction?: number;
  iconicDefault?: number;
}

export type AuctionNominationMode = 'player' | 'ai';
export type AuctionPhase = 'nominating' | 'bidding' | 'sold_flash' | 'done';

export interface AuctionBidEntry {
  teamIdx: number;
  amount: number;
  action: 'nominate' | 'bid' | 'pass';
}

export interface AuctionState {
  nominationMode: AuctionNominationMode;
  budgetPerTeam: number;
  nominatorIdx: number;
  phase: AuctionPhase;
  activePlayer: Player | null;
  currentBid: number;
  highestBidderIdx: number | null;
  activeBidderIdx: number;
  passedTeams: number[];
  lotNumber: number;
  bidLog: AuctionBidEntry[];
  lastSold: {
    player: Player;
    winnerIdx: number;
    price: number;
  } | null;
  skippedIds: number[];
}

export interface DraftHistoryItem {
  teamIdx: number;
  playerId: number;
  paid: number;
  isCpu: boolean;
}

export interface DraftState {
  m: Omit<GameModeDef, 'budget'> & { budget: number | null };
  pool: Player[];
  teams: Team[];
  order: number[];
  k: number;
  taken: Set<number>;
  history: DraftHistoryItem[];
  budgetWarning: string;
  nameGroups?: Record<string, Player[]>;
  _cacheTakenSize?: number;
  _cheapestByPos?: Record<Position, { id: number; cost: number }[]>;
  _cheapestAll?: { id: number; cost: number }[];
}

export interface WheelState {
  spinning: boolean;
  angle: number;
  selectedClub: string | null;
  offeredPlayers: Player[];
  jokers: number;
  jokersByTeam: Record<number, number>;
}

export interface FormationRowDef {
  label: string;
  pos: Position;
  count: number;
}

export interface FormationDef {
  quota: Record<Position, number>;
  rows: FormationRowDef[];
}

export interface PitchRow {
  label: string;
  pos: Position;
  count: number;
  players: Player[];
}

export interface LineupPlayer extends Player {
  effR: number;
  outOfPos: boolean;
  slotPos: Position;
}

export interface SideEvaluation {
  L: Record<Position, LineupPlayer[]>;
  pitchRows: PitchRow[];
  avg: number;
  att: number;
  def: number;
  mid: number;
}

export type MatchEventType = 'goal' | 'red' | 'save' | 'post' | 'miss' | 'card';

export interface ScheduledMatchEvent {
  type: MatchEventType;
  side: 0 | 1;
  min: number;
  scorer?: Player | null;
  assister?: Player | null;
  player?: Player | null;
  gk?: { n: string; id?: number } | null;
}

export interface PenaltyData {
  score: [number, number];
  winnerSide: 0 | 1;
  takersA: string[];
  takersB: string[];
}

export interface MatchPlan {
  winnerSide: -1 | 0 | 1;
  goesToET: boolean;
  goesToPenalties: boolean;
  penaltyData: PenaltyData | null;
  maxMin: number;
  scheduledByMin: ScheduledMatchEvent[][];
  aggOffset?: [number, number];
}

export interface MatchGoalEntry {
  min: number;
  scorer: string;
  assister: string | null;
}

export interface MatchPlayerStat {
  goals: number;
  assists: number;
  red: boolean;
}

export interface MatchLogEntry {
  min: number | string;
  isGoal: boolean;
  isRed: boolean;
  text: string;
}

export interface MatchState {
  a: number;
  b: number;
  tourneyMatchId: string | null;
  sa: SideEvaluation;
  sb: SideEvaluation;
  plan: MatchPlan;
  min: number;
  sc: [number, number];
  penSc: [number, number] | null;
  redCards: [number, number];
  perfFactor: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  saves: [number, number];
  xg: [number, number];
  goalsList: [MatchGoalEntry[], MatchGoalEntry[]];
  playerStats: Record<number, MatchPlayerStat>;
  lastHighlightGoal: number | null;
  lastHighlightAssist: number | null;
  log: MatchLogEntry[];
  run: number;
  speed: 1 | 2 | 4;
  leagueWeekRecorded: boolean;
  careerWeek?: number;
  tacticsA?: TeamTactics;
  tacticsB?: TeamTactics;
}

export interface PendingMatchContext {
  a: number;
  b: number;
  tourneyMatchId: string | null;
}

export interface TournamentMatch {
  id: string;
  title: string;
  a: number | null;
  b: number | null;
  done: boolean;
  sc: [number, number] | null;
  pen: [number, number] | null;
  winner: number | null;
  goals: [MatchGoalEntry[], MatchGoalEntry[]] | [];
}

export interface TournamentState {
  matches: TournamentMatch[];
  champion: number | null;
}

export interface LeagueFixture {
  a: number;
  b: number;
  done: boolean;
  sc: [number, number] | null;
  pen?: [number, number] | null;
  winner?: number | null;
  stageLabel?: string;
  leg?: 1 | 2;
  firstLegSc?: [number, number] | null;
  aggSc?: [number, number] | null;
  redCards?: { teamIdx: number; playerId: number; playerName: string }[];
}

export interface StandingsRow {
  teamIdx: number;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface CareerPlayerStat {
  name: string;
  teamIdx: number;
  teamName: string;
  club?: string;
  goals: number;
  assists: number;
}

export interface CareerNewsItem {
  week: number;
  source: string;
  clubLogoName?: string;
  teamIdx: number | null;
  title: string;
  body: string;
  effectBadge?: string | null;
  effectPositive?: boolean | null;
}

export interface CareerEventChoice {
  choiceIdx?: number;
  label: string;
  outcomeText?: string;
  effect: (ctx: { lg: LeagueState; userTeam: Team; teamIdx?: number }) => string;
}

export interface CareerEvent {
  id: string;
  tag: string;
  title: string;
  desc: string;
  teamIdx?: number;
  targetPlayerId?: number;
  benchPlayerId?: number;
  choices: CareerEventChoice[];
}

export interface CareerEventHistoryItem {
  week: number;
  title: string;
  outcome: string;
}

export interface PressConferenceChoiceDef {
  tone:
    | 'Sakin / Profesyonel'
    | 'İddialı / Agresif'
    | 'Küstah / Provokatif'
    | 'Diplomatik / Politik'
    | 'Takımı Koruyan';
  text: string;
  goodProb: number;
  goodResult: { text: string; morale: number; funds: number };
  badResult: { text: string; morale: number; funds: number };
}

export interface PressConferenceQuestionDef {
  id: string;
  question: string;
  choices: PressConferenceChoiceDef[];
}

export interface PressConferenceAskedQuestion {
  media: string;
  questionId: string;
  questionText: string;
  choices: PressConferenceChoiceDef[];
}

export interface PressConferenceAnswerLog {
  media: string;
  questionText: string;
  chosenTone: string;
  chosenText: string;
  isGood: boolean;
  outcomeText: string;
  moraleDelta: number;
  fundsDelta: number;
}

export interface PressConferenceState {
  week: number;
  teamIdx: number;
  teamName: string;
  rank: number;
  lastMatchSummary: string;
  lostLastMatch: boolean;
  status: 'invited' | 'in_progress' | 'completed' | 'declined';
  currentQIdx: number;
  questions: PressConferenceAskedQuestion[];
  answers: PressConferenceAnswerLog[];
  totalMoraleDelta: number;
  totalFundsDelta: number;
  headline?: string;
  declineOutcomeText?: string;
  declineMoraleDelta?: number;
}

export interface TeamCareerState {
  clubFunds: number;
  sponsorName: string;
  moraleMod: number;
  lastResult: { userGoals: number; oppGoals: number; oppName: string } | null;
  usedEventIds: string[];
  activeEvent: CareerEvent | null;
  activePressConference?: PressConferenceState | null;
  eventHistory: CareerEventHistoryItem[];
}

export type LeagueTab = 'standings' | 'fixtures' | 'leaders' | 'news' | 'pots' | 'bracket';

export interface UclPotTeamMeta {
  teamIdx: number;
  pot: 1 | 2 | 3 | 4;
  club: string;
  country: string;
  coeff: string;
  coeffNum: number;
  note?: string;
}

export interface LeagueState {
  leagueName: string;
  week: number;
  maxWeeks: number;
  viewWeek: number;
  schedule: LeagueFixture[][];
  standings: StandingsRow[];
  playerStats: Record<string, CareerPlayerStat>;
  /** Number of remaining weeks/matches unavailable (shared for both injury & red-card bans) */
  injuries: Record<number, number>;
  /** Flag marking specifically a red-card suspension (duration stored in injuries[pid]) */
  suspensions: Record<number, number>;
  moraleMod: number;
  clubFunds: number;
  sponsorName: string;
  lastResult: { userGoals: number; oppGoals: number; oppName: string } | null;
  usedEventIds: Set<string>;
  usedNewsIds: Set<string>;
  activeEvent: CareerEvent | null;
  activePressConference?: PressConferenceState | null;
  activeNews: CareerNewsItem | null;
  pendingNewsAfterEvent?: CareerNewsItem | null;
  eventHistory: CareerEventHistoryItem[];
  teamCareer?: Record<number, TeamCareerState>;
  newsFeed: CareerNewsItem[];
  tab: LeagueTab;
  isUcl?: boolean;
  uclPots?: UclPotTeamMeta[];
  uclChampionTeamIdx?: number | null;
}

export type AppView =
  | 'setup'
  | 'clubs'
  | 'draft'
  | 'identity'
  | 'result'
  | 'tactics'
  | 'match'
  | 'league_select'
  | 'league_hub';

export interface NetStateSnapshot {
  role: 'host' | 'guest' | null;
  roomCode: string;
  connected: boolean;
  statusText: string;
  myTeamIdx: number;
  peerName: string;
  readyPhase?: string;
  readyMap: Record<number, boolean>;
  chatLog: { sender: string; text: string }[];
}

