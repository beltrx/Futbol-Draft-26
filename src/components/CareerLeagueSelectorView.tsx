import React from 'react';
import { CAREER_LEAGUES_PREVIEW } from '../data/database';
import { LeagueLogo } from './ClubBadge';

interface CareerLeagueSelectorViewProps {
  teamName: string;
  isGuestWaiting?: boolean;
  onSelectLeague: (leagueName: string) => void;
  onBackToLineup: () => void;
}

export const CareerLeagueSelectorView: React.FC<CareerLeagueSelectorViewProps> = ({
  teamName,
  isGuestWaiting = false,
  onSelectLeague,
  onBackToLineup,
}) => {
  return (
    <section aria-label="Kariyer Ligi Seçimi" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--pri-bright)]">
            LİG KARİYER MODU · 2026-27 SEZONU
          </span>
          <h1 className="text-2xl font-extrabold text-[var(--fg)]">
            {teamName} İçin Mücadele Edeceğin Ligi Seç
          </h1>
          <p className="text-xs text-[var(--muted)]">
            36 takımlı yeni format UEFA Şampiyonlar Ligi (4 Torba · 8 Maç Lig + Play-Off & Eleme), Premier Lig (20 takım · 38 hafta), Bundesliga (18 takım · 34 hafta) ve Serie A (20 takım · 38 hafta) hazır!
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToLineup}
          className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3.5 py-2 text-xs font-semibold hover:bg-[var(--accent)]"
        >
          ← Kadro Dizilişine Dön
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {CAREER_LEAGUES_PREVIEW.map((lg) => {
          const isUclCard = lg.id === 'Şampiyonlar Ligi';
          return (
            <div
              key={lg.id}
              className={`flex flex-col justify-between rounded-2xl border p-4 shadow-md ${
                lg.active
                  ? isUclCard
                    ? 'border-sky-400 bg-gradient-to-br from-[#071642] via-[#0b2161] to-[#04091e] ring-1 ring-sky-400/40'
                    : 'border-[var(--pri-bright)] bg-gradient-to-br from-[#101820] to-[#090d12]'
                  : 'border-[var(--border)] bg-[var(--card)] opacity-70'
              }`}
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    <LeagueLogo league={lg.id} size={20} />
                    <span>{lg.country}</span>
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      lg.active
                        ? isUclCard
                          ? 'bg-sky-500/25 text-sky-200'
                          : 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700/40 text-slate-300'
                    }`}
                  >
                    {lg.active ? (isUclCard ? 'YENİ · DEVLER LİGİ' : 'AKTİF') : 'YAKINDA'}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-[var(--fg)]">{lg.name}</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">{lg.note}</p>
              </div>

              <div className="mt-4">
                {lg.active ? (
                  <button
                    type="button"
                    disabled={isGuestWaiting}
                    onClick={() => onSelectLeague(lg.id)}
                    className={`w-full rounded-xl border px-4 py-2.5 text-xs font-bold text-white transition disabled:opacity-50 ${
                      isUclCard
                        ? 'border-sky-400 bg-blue-600 shadow-[0_6px_18px_-6px_rgba(56,189,248,0.75)] hover:bg-blue-500'
                        : 'border-[var(--pri-bright)] bg-[var(--pri)] shadow-[0_6px_18px_-6px_rgba(34,197,94,0.65)] hover:bg-[#15803d]'
                    }`}
                  >
                    {isGuestWaiting
                      ? 'Oda Kurucusu Ligi Başlatıyor...'
                      : `${lg.name}'i Başlat →`}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--raised)] px-4 py-2 text-xs font-semibold text-[var(--muted)]"
                  >
                    Yakında Eklenecek
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
