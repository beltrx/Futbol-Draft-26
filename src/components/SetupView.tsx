import React from 'react';
import { MODES } from '../data/database';
import { isPeerReadyForPhase } from '../services/onlineNet';
import type { GameModeId, NetStateSnapshot } from '../types/game';
import { LeagueLogo, OnlineReadyBadges } from './ClubBadge';

interface SetupViewProps {
  mode: GameModeId;
  opp: number;
  humanCount: number;
  format: 'snake' | 'linear';
  strictPos: boolean;
  teamName: string;
  careerLeague: string;
  err: string;
  net: NetStateSnapshot;
  onSelectMode: (modeId: GameModeId) => void;
  onChangeOpp: (opp: number) => void;
  onChangeHumanCount: (count: number) => void;
  onChangeFormat: (format: 'snake' | 'linear') => void;
  onChangeStrictPos: (strict: boolean) => void;
  onChangeTeamName: (name: string) => void;
  onChangeCareerLeague: (league: string) => void;
  onContinueToClubs: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({
  mode,
  opp,
  humanCount,
  format,
  strictPos,
  teamName,
  careerLeague,
  err,
  net,
  onSelectMode,
  onChangeOpp,
  onChangeHumanCount,
  onChangeFormat,
  onChangeStrictPos,
  onChangeTeamName,
  onChangeCareerLeague,
  onContinueToClubs,
}) => {
  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];
  const isCareer = !!activeMode.career;
  const isGuest = net.role === 'guest';
  const myReady = isPeerReadyForPhase(net, 'setup', net.myTeamIdx);

  return (
    <section aria-label="Oyun Kurulumu" className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#0f151c] to-[#080b0f] p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <span className="inline-block rounded-md border border-[var(--pri-bright)]/40 bg-[#166534]/25 px-2.5 py-0.5 font-disp text-[11px] font-bold uppercase tracking-widest text-[var(--pri-bright)]">
              2026-27 · PREMIER LİG, BUNDESLIGA &amp; SERIE A KARİYER
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--fg)] sm:text-3xl">
              Hayalindeki Kadroyu Kur, Sezonu Domine Et
            </h1>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              102 dünya kulübünden oyuncularla draft yap, kendi takım armanı tasarla, 11+3 taktik
              tahtanı kur ve Premier Lig (38 Hafta), Bundesliga (34 Hafta) veya Serie A (38 Hafta)
              kariyerinde şampiyonluğa oyna.
            </p>
          </div>
          {net.connected && (
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span className="rounded-lg border border-emerald-400/50 bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-200">
                Canlı Oda Aktif ({net.roomCode}) · {net.peerName || '2 Oyuncu'} Bağlı
              </span>
              <OnlineReadyBadges net={net} phase="setup" />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--fg)]">1. Oyun Modunu Seç</h2>
          <span className="text-xs text-[var(--muted)]">
            Seçili Mod: <strong className="text-[var(--pri-bright)]">{activeMode.name}</strong>
            {isGuest && net.connected ? ' (Oda Kurucu Seçimi)' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((m) => {
            const selected = m.id === mode;
            const disabledGuest = isGuest;
            return (
              <button
                key={m.id}
                type="button"
                disabled={disabledGuest}
                aria-pressed={selected}
                onClick={() => onSelectMode(m.id)}
                className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                  selected
                    ? 'border-[var(--pri-bright)] bg-gradient-to-br from-[#131d19] to-[#0c1116] shadow-[0_0_0_1px_rgba(34,197,94,0.35)]'
                    : m.special
                    ? 'border-amber-500/40 bg-[#12161d] hover:border-amber-400/70 hover:bg-[#181e28]'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[#2b3b4e] hover:bg-[var(--raised)]'
                }`}
              >
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                        m.special
                          ? 'bg-amber-500/20 text-amber-300'
                          : selected
                          ? 'bg-[var(--pri)] text-emerald-100'
                          : 'bg-[var(--raised)] text-[var(--muted)]'
                      }`}
                    >
                      {m.tag}
                    </span>
                    {selected && (
                      <span className="text-xs font-extrabold text-[var(--pri-bright)]">✓</span>
                    )}
                  </div>
                  <div className="font-disp text-sm font-bold text-[var(--fg)]">{m.name}</div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{m.d}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <h2 className="mb-3 text-base font-bold text-[var(--fg)]">2. Draft &amp; Sezon Ayarları</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="setup-team-name" className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              Takım Adın
            </label>
            <input
              id="setup-team-name"
              type="text"
              value={teamName}
              onChange={(e) => onChangeTeamName(e.target.value)}
              placeholder="Örn: 1. Oyuncu"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] focus:border-[var(--pri-bright)] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="setup-human-count" className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              Oyuncu Modu
            </label>
            <select
              id="setup-human-count"
              disabled={net.connected || isGuest}
              value={net.connected ? 2 : humanCount}
              onChange={(e) => onChangeHumanCount(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] disabled:opacity-60"
            >
              <option value={1}>Tek Kişilik (Ben vs Yapay Zeka)</option>
              <option value={2}>2 Kişilik (Aynı PC veya Online)</option>
            </select>
          </div>

          <div>
            <label htmlFor="setup-opp-count" className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
              {isCareer && <LeagueLogo league={careerLeague} size={16} />}
              <span>{isCareer ? 'Kariyer Ligi Seçimi' : 'Draft Takım Sayısı'}</span>
            </label>
            {isCareer ? (
              <select
                id="setup-opp-count"
                disabled={isGuest}
                value={careerLeague}
                onChange={(e) => onChangeCareerLeague(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] disabled:opacity-60"
              >
                <option value="Premier Lig">Premier Lig (20 Takım · 38 Hafta)</option>
                <option value="Bundesliga">Bundesliga (18 Takım · 34 Hafta)</option>
                <option value="Serie A">Serie A (20 Takım · 38 Hafta)</option>
              </select>
            ) : (
              <select
                id="setup-opp-count"
                disabled={isGuest}
                value={opp}
                onChange={(e) => onChangeOpp(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] disabled:opacity-60"
              >
                <option value={1}>2 Takım (Doğrudan Final)</option>
                <option value={2}>3 Takım (Yarı Final + Final)</option>
                <option value={3}>4 Takım (2 Yarı Final + Final)</option>
              </select>
            )}
          </div>

          <div>
            <label htmlFor="setup-format" className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              Draft Seçim Sırası
            </label>
            <select
              id="setup-format"
              disabled={isGuest}
              value={format}
              onChange={(e) => onChangeFormat(e.target.value as 'snake' | 'linear')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] disabled:opacity-60"
            >
              <option value="snake">Yılan Sırası (1→2→2→1)</option>
              <option value="linear">Sabit Sıra (1→2→1→2)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3.5">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--fg)]">
            <input
              type="checkbox"
              checked={strictPos}
              disabled={isGuest}
              onChange={(e) => onChangeStrictPos(e.target.checked)}
              className="h-4 w-4 accent-[var(--pri-bright)]"
            />
            <span>
              Mevki Kısıtlamasını Koru (1 KL · 4 DF · 3 OS · 3 FV zorunlu taban kadro)
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2.5">
            {net.connected && <OnlineReadyBadges net={net} phase="setup" />}
            {isGuest && !net.connected ? (
              <span className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3.5 py-2 text-xs font-semibold text-amber-200">
                Oda bağlantısı kuruluyor...
              </span>
            ) : (
              <button
                type="button"
                onClick={onContinueToClubs}
                className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2.5 text-sm font-bold text-[var(--pri-fg)] shadow-[0_8px_24px_-6px_rgba(34,197,94,0.6)] transition hover:bg-[#15803d]"
              >
                {net.connected
                  ? myReady
                    ? 'Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                    : 'Hazır Ol: Lig & Takım Seç →'
                  : 'Devam Et: Lig & Takım Seç →'}
              </button>
            )}
          </div>
        </div>

        {err && (
          <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            {err}
          </p>
        )}
      </div>
    </section>
  );
};

