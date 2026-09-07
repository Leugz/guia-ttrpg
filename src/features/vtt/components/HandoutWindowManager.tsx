import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Eye, EyeOff, Send } from 'lucide-react';

import * as gameClient from '../../session/net/gameClient';
import { lan } from '../../session/net/lanConnection';
import { useLanStore } from '../../session/net/lanStore';
import type { LanPlayer } from '../../session/net/protocol';
import type { Handout } from '../../../shared/types';
import { getInitials } from '../../../shared/lib/initials';
import { DraggableWindow } from './DraggableWindow';

const PROSE =
  'leading-relaxed [&>p]:mb-3 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--theme-color)] [&_blockquote]:bg-zinc-900/30 [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-400 [&_code]:rounded [&_code]:bg-zinc-800/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-[var(--theme-color)] [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-inside [&_ol]:list-decimal [&_strong]:font-bold [&_strong]:text-white [&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-zinc-700 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-zinc-700 [&_th]:bg-zinc-800/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-bold [&_th]:text-white [&_ul]:mb-3 [&_ul]:list-inside [&_ul]:list-disc';

interface HandoutRowProps {
  handout: Handout;
  isGM: boolean;
  players: LanPlayer[];
  onOpen: (id: string) => void;
  onTogglePublic: (id: string) => void;
  onToggleShare: (id: string, targetClientId: string) => void;
  onOpenForAll: (id: string) => void;
  onOpenForPlayer: (id: string, targetClientId: string) => void;
}

/**
 * One row in the handout list.
 *
 * `VttApp` carried this markup twice, copy-pasted for the "Regras" and
 * "Documentos" sections, and the two copies had already drifted — one wrapped
 * its share controls in a stray `<>…</>` the other did not. One component, two
 * call sites.
 */
const HandoutRow = React.memo(function HandoutRow({
  handout,
  isGM,
  players,
  onOpen,
  onTogglePublic,
  onToggleShare,
  onOpenForAll,
  onOpenForPlayer,
}: HandoutRowProps) {
  const shared = handout.shared_with ?? [];

  return (
    <div className='flex flex-col gap-2 rounded border border-transparent bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-800 hover:bg-zinc-900/80'>
      <div
        className='flex cursor-pointer items-center gap-2 transition-colors hover:text-white'
        onClick={() => onOpen(handout.id)}
      >
        <div
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${handout.is_public ? 'bg-green-500' : shared.length > 0 ? 'bg-blue-500' : 'bg-zinc-600'}`}
        />
        <span className='truncate font-medium'>{handout.title}</span>
      </div>

      {isGM && (
        <div className='ml-3 mt-1 flex flex-col gap-2 border-t border-zinc-800/50 pt-2'>
          <button
            onClick={() => onTogglePublic(handout.id)}
            className={`flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider outline-none transition-colors hover:bg-green-900 focus:outline-none ${handout.is_public ? 'bg-green-950/50 text-green-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            {handout.is_public ? (
              <>
                <Eye size={10} /> Público (Todos)
              </>
            ) : (
              <>
                <EyeOff size={10} /> Privado
              </>
            )}
          </button>

          <button
            onClick={() => onOpenForAll(handout.id)}
            className='flex w-full items-center justify-center gap-1 rounded bg-amber-950/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 outline-none transition-colors hover:bg-amber-900 focus:outline-none'
          >
            <Send size={10} /> Abrir para Todos
          </button>

          {!handout.is_public && (
            <div className='flex flex-wrap items-center gap-1'>
              <span className='mr-1 text-[9px] uppercase tracking-widest text-zinc-500'>
                Visível para:
              </span>
              {players.map((player) => {
                const isShared = shared.includes(player.client_id);
                return (
                  <React.Fragment key={player.client_id}>
                    <button
                      onClick={() =>
                        onToggleShare(handout.id, player.client_id)
                      }
                      className={`flex h-5 w-5 items-center justify-center rounded-sm text-[9px] font-bold outline-none transition-colors focus:outline-none ${isShared ? 'bg-zinc-800 text-white shadow-[0_0_5px_currentColor]' : 'bg-zinc-950 text-zinc-600 hover:bg-zinc-800'}`}
                      style={{
                        color: isShared ? player.color : undefined,
                        borderColor: isShared ? player.color : '#27272a',
                        borderWidth: '1px',
                      }}
                      title={`${isShared ? 'Remover' : 'Compartilhar com'} ${player.username}`}
                    >
                      {getInitials(player.username)}
                    </button>
                    <button
                      onClick={() =>
                        onOpenForPlayer(handout.id, player.client_id)
                      }
                      className='flex h-5 w-5 items-center justify-center rounded-sm bg-zinc-950 text-zinc-600 outline-none transition-colors hover:bg-amber-900 hover:text-amber-400 focus:outline-none'
                      title={`Abrir agora só para ${player.username}`}
                    >
                      <Send size={9} />
                    </button>
                  </React.Fragment>
                );
              })}
              {players.length === 0 && (
                <span className='text-[9px] text-zinc-600'>Nenhum jogador</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export interface HandoutWindowManagerProps {
  isGM: boolean;
  clientId: string;
  roster: LanPlayer[];
  /** Whether the browser window listing the handouts is showing. */
  isListOpen: boolean;
  onCloseList: () => void;
}

/**
 * Owns everything about handouts: which are visible, which windows are open,
 * the decoded image URLs, and the four GM actions that mutate sharing.
 *
 * Pulled out of `VttApp` wholesale. The image-URL cache in particular was a
 * `VttApp` state object, so decoding one image re-rendered the entire table.
 */
export function HandoutWindowManager({
  isGM,
  clientId,
  roster,
  isListOpen,
  onCloseList,
}: HandoutWindowManagerProps) {
  const handouts = useLanStore((state) => state.handouts);

  const [openIds, setOpenIds] = useState<string[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  const visible = useMemo(
    () =>
      isGM
        ? handouts
        : handouts.filter(
            (h) => h.is_public || h.shared_with?.includes(clientId)
          ),
    [handouts, isGM, clientId]
  );

  const regras = useMemo(
    () => visible.filter((h) => h.category === 'regras'),
    [visible]
  );
  const documentos = useMemo(
    () => visible.filter((h) => h.category === 'documentos'),
    [visible]
  );
  const players = useMemo(
    () => roster.filter((p) => p.connected && p.claimed_sheet !== '__GM__'),
    [roster]
  );

  const open = useCallback((id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const close = useCallback((id: string) => {
    setOpenIds((prev) => prev.filter((entry) => entry !== id));
    setAssetUrls((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Four mutations that all end the same way: replace one handout in the store.
  const patch = useCallback((updated: Handout) => {
    useLanStore.setState((state) => ({
      handouts: state.handouts.map((h) => (h.id === updated.id ? updated : h)),
    }));
  }, []);

  const onTogglePublic = useCallback(
    (id: string) =>
      gameClient.toggleHandoutPublic(id).then(patch).catch(console.error),
    [patch]
  );
  const onToggleShare = useCallback(
    (id: string, target: string) =>
      gameClient
        .toggleHandoutShare(id, target)
        .then(patch)
        .catch(console.error),
    [patch]
  );
  const onOpenForAll = useCallback(
    (id: string) =>
      gameClient.openHandoutForAll(id).then(patch).catch(console.error),
    [patch]
  );
  const onOpenForPlayer = useCallback(
    (id: string, target: string) =>
      gameClient
        .openHandoutForPlayer(id, target)
        .then(patch)
        .catch(console.error),
    [patch]
  );

  // The GM pushed a handout at us. Subscribing to the socket event directly
  // means this is a plain callback rather than a queue drained from an effect.
  useEffect(
    () =>
      lan.on('handoutForceOpen', (message) => {
        const target = message.target ?? null;
        if (target === null || target === clientId) open(message.handoutId);
      }),
    [clientId, open]
  );

  // Decode the image behind every open non-text handout, once each.
  useEffect(() => {
    let cancelled = false;
    for (const id of openIds) {
      const handout = handouts.find((h) => h.id === id);
      if (!handout || handout.content_type === 'text') continue;
      if (assetUrls[id]) continue;

      gameClient
        .getHandoutAssetUrl(handout)
        .then((url) => {
          if (cancelled) return;
          setAssetUrls((prev) => (prev[id] ? prev : { ...prev, [id]: url }));
        })
        .catch((error) => {
          console.error(`Failed to load the image for handout "${id}":`, error);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [openIds, handouts, assetUrls]);

  const renderSection = (title: string, entries: Handout[], empty: string) => (
    <div className='mb-2 mt-2 px-3'>
      <span className='block w-full border-b border-zinc-800 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
        {title}
      </span>
      <div className='mt-1 flex flex-col gap-1'>
        {entries.map((handout) => (
          <HandoutRow
            key={handout.id}
            handout={handout}
            isGM={isGM}
            players={players}
            onOpen={open}
            onTogglePublic={onTogglePublic}
            onToggleShare={onToggleShare}
            onOpenForAll={onOpenForAll}
            onOpenForPlayer={onOpenForPlayer}
          />
        ))}
        {entries.length === 0 && (
          <span className='py-2 text-xs italic text-zinc-600'>{empty}</span>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isListOpen && (
        <DraggableWindow
          title='Arquivos & Documentos'
          onClose={onCloseList}
          initialX={84}
          initialY={80}
          initialWidth={320}
          initialHeight={520}
          resizable
        >
          <div className='flex min-h-0 flex-1 flex-col overflow-y-auto bg-black/50 pb-2 backdrop-blur-lg'>
            {(regras.length > 0 || isGM) &&
              renderSection(
                'Regras do Sistema',
                regras,
                'Nenhuma regra disponível.'
              )}
            {(documentos.length > 0 || isGM) &&
              renderSection(
                'Documentos & Pistas',
                documentos,
                'Nenhum documento disponível.'
              )}
          </div>
        </DraggableWindow>
      )}

      {openIds.map((id, index) => {
        const handout = handouts.find((h) => h.id === id);
        if (!handout) return null;
        if (
          !isGM &&
          !handout.is_public &&
          !handout.shared_with?.includes(clientId)
        ) {
          return null;
        }

        return (
          <DraggableWindow
            key={id}
            title={handout.title}
            onClose={() => close(id)}
            initialX={220 + index * 30}
            initialY={120 + index * 30}
            initialWidth={560}
            initialHeight={640}
            resizable
          >
            <div className='min-h-0 flex-1 overflow-y-auto bg-black/50 p-4 text-sm text-zinc-300 backdrop-blur-lg'>
              {handout.content_type === 'text' ? (
                <div className={PROSE}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {handout.content}
                  </ReactMarkdown>
                </div>
              ) : assetUrls[id] ? (
                <img
                  src={assetUrls[id]}
                  alt={handout.title}
                  className='w-full rounded border border-zinc-800 object-contain'
                  draggable={false}
                />
              ) : (
                <div className='py-8 text-center text-zinc-500'>
                  Carregando imagem…
                </div>
              )}
            </div>
          </DraggableWindow>
        );
      })}
    </>
  );
}
