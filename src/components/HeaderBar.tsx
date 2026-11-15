import React, { useState } from 'react';
import type { AppView, DraftState, LeagueState, NetStateSnapshot } from '../types/game';

interface HeaderBarProps {
  view: AppView;
  draft: DraftState | null;
  league: LeagueState | null;
  net: NetStateSnapshot;
  onlineModalOpen: boolean;
  onToggleOnlineModal: () => void;
  onNavigate: (view: AppView) => void;
  onGoMatchDirect: () => void;
  onResetToSetup: () => void;
  onSendChat: (text: string) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  view,
  draft,
  league,
  net,
  onlineModalOpen,
  onToggleOnlineModal,
  onNavigate,
  onGoMatchDirect,
  onResetToSetup,
  onSendChat,
}) => {
  const [chatText, setChatText] = useState('');
  const isCareer = !!(draft && draft.m.career);
  const lastChat = net.chatLog[net.chatLog.length - 1];

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = chatText.trim();
    if (!txt) return;
    onSendChat(txt);
    setChatText('');
  };

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[#0a0e13]/92 px-4 py-3 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--pri-bright)] bg-gradient-to-br from-[#166534] to-[#14532d] font-disp text-base font-extrabold text-[var(--pri-fg)] shadow-[0_6px_20px_-6px_rgba(34,197,94,0.65)]">
            FD
          </div>
          <div>
            <div className="font-disp text-xl font-extrabold tracking-tight text-[var(--fg)]">
              Futbol <span className="text-[var(--pri-bright)]">Draft</span>
            </div>
            <span className="block text-xs text-[var(--muted)]">
              2026-27 Sezonu · Kadro, Lig Kariyeri &amp; Turnuva Simülatörü
            </span>
          </div>
        </div>

        <nav aria-label="Ana gezinme" className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleOnlineModal}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              net.connected || onlineModalOpen
                ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-[var(--pri-fg)]'
                : 'border-amber-500/60 bg-amber-900/60 text-amber-100 hover:bg-amber-800/70'
            }`}
          >
            {net.connected ? `Canlı Oda (${net.roomCode})` : 'Online Oda (2 PC)'}
          </button>

          {!net.connected && draft && draft.k >= draft.order.length && (
            <button
              type="button"
              onClick={() => onNavigate('identity')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                view === 'identity'
                  ? 'border-[var(--pri-bright)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--raised)] text-[var(--fg)] hover:bg-[var(--accent)]'
              }`}
            >
              Takım Kimliği &amp; Logo
            </button>
          )}

          {!net.connected && draft && (
            <button
              type="button"
              onClick={() => onNavigate('result')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                view === 'result'
                  ? 'border-[var(--pri-bright)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--raised)] text-[var(--fg)] hover:bg-[var(--accent)]'
              }`}
            >
              Kadro Dizilişi (11+3)
            </button>
          )}

          {!net.connected && draft && isCareer && league && (
            <button
              type="button"
              onClick={() => onNavigate('league_hub')}
              className="rounded-lg border border-[var(--pri-bright)] bg-[var(--pri)] px-3 py-1.5 text-xs font-semibold text-[var(--pri-fg)] transition hover:bg-[#15803d]"
            >
              Premier Lig Merkezi
            </button>
          )}

          {!net.connected && draft && !isCareer && (
            <button
              type="button"
              onClick={onGoMatchDirect}
              className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)] transition hover:bg-[var(--accent)]"
            >
              Turnuva &amp; Maç
            </button>
          )}

          {!net.connected && view !== 'setup' && (
            <button
              type="button"
              onClick={onResetToSetup}
              className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)] transition hover:bg-[var(--accent)]"
            >
              Ana Menü
            </button>
          )}
        </nav>
      </header>

      {net.role && (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#166534] bg-[var(--surface)] px-3.5 py-2.5 shadow-md">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                net.connected
                  ? 'bg-[var(--pri-bright)] shadow-[0_0_8px_var(--pri-bright)]'
                  : 'bg-[var(--warn)]'
              }`}
            />
            <strong className="text-[var(--fg)]">{net.statusText}</strong>
            <span className="rounded border border-[var(--border)] bg-[var(--raised)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
              {net.role === 'host' ? 'Oda Kurucu (1. Takım)' : 'Misafir (2. Takım)'}
            </span>
          </div>

          {net.connected && (
            <div className="flex flex-wrap items-center gap-2">
              {lastChat && (
                <span className="rounded-md border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-xs">
                  <strong className="text-[var(--pri-bright)]">{lastChat.sender}:</strong>{' '}
                  {lastChat.text}
                </span>
              )}
              <button
                type="button"
                onClick={() => onSendChat('Harika seçim!')}
                className="rounded border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--accent)]"
              >
                İyi Seçim
              </button>
              <button
                type="button"
                onClick={() => onSendChat('O oyuncuyu ben alacaktım!')}
                className="rounded border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--accent)]"
              >
                Ben Alacaktım
              </button>
              <button
                type="button"
                onClick={() => onSendChat('Maça hazır mısın?')}
                className="rounded border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--accent)]"
              >
                Hazır mısın?
              </button>
              <form onSubmit={handleChatSubmit} className="flex items-center gap-1.5">
                <label htmlFor="net-chat-inp" className="sr-only">
                  Sohbet mesajı
                </label>
                <input
                  id="net-chat-inp"
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Mesaj yaz..."
                  className="w-32 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--fg)] focus:border-[var(--pri-bright)] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded border border-[var(--pri-bright)] bg-[var(--pri)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#15803d]"
                >
                  Gönder
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
};
