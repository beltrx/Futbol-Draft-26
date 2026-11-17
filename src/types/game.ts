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
}

export type GameModeId =
  | 'career'
  | 'classic'
  | 'wheel'
  | 'iconic'
  | 'club'
  | 'budget';

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
  iconicDefault?: number;
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

export interface TeamCareerState {
  clubFunds: number;
  sponsorName: string;
  moraleMod: number;
  lastResult: { userGoals: number; oppGoals: number; oppName: string } | null;
  usedEventIds: string[];
  activeEvent: CareerEvent | null;
  eventHistory: CareerEventHistoryItem[];
}

export type LeagueTab = 'standings' | 'fixtures' | 'leaders' | 'news';

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
  activeNews: CareerNewsItem | null;
  pendingNewsAfterEvent?: CareerNewsItem | null;
  eventHistory: CareerEventHistoryItem[];
  teamCareer?: Record<number, TeamCareerState>;
  newsFeed: CareerNewsItem[];
  tab: LeagueTab;
}

export type AppView =
  | 'setup'
  | 'clubs'
  | 'draft'
  | 'identity'
  | 'result'
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

