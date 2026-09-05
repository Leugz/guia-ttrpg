/**
 * Bitmap loading for the board.
 *
 * Konva draws `HTMLImageElement`s, not URLs, and decoding a map is expensive
 * enough that doing it again on every render would be visible. Both caches
 * below are module-level and keyed by something stable, so a map you have
 * already looked at comes back instantly when the GM switches back to it, and
 * a portrait is decoded once no matter how many tokens use it.
 */

import { useEffect, useState } from 'react';

import type { MapDefinition } from '../../shared/types';
import * as gameClient from '../session/net/gameClient';

const decoded = new Map<string, HTMLImageElement>();
const inFlight = new Map<string, Promise<HTMLImageElement>>();

const decode = (key: string, url: string): Promise<HTMLImageElement> => {
  const ready = decoded.get(key);
  if (ready) return Promise.resolve(ready);

  const existing = inFlight.get(key);
  if (existing) return existing;

  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      decoded.set(key, image);
      inFlight.delete(key);
      resolve(image);
    };
    image.onerror = () => {
      inFlight.delete(key);
      reject(new Error(`Não foi possível carregar a imagem: ${key}`));
    };
    image.src = url;
  });

  inFlight.set(key, pending);
  return pending;
};

/**
 * Decode a map's image. Returns `null` while it is still loading, which the
 * board renders as its "carregando" state rather than a blank stage.
 */
export const loadMapImage = (map: MapDefinition) =>
  gameClient.getMapImageUrl(map).then((url) => decode(`map:${map.id}`, url));

/** Decode a character's portrait, or reject when the sheet declares none. */
export const loadPortrait = (sheetId: string) =>
  gameClient
    .getPortraitUrl(sheetId)
    .then((url) => decode(`portrait:${sheetId}`, url));

/**
 * The portrait for one sheet, or `null` when there is none — in which case the
 * token falls back to initials on the player's colour.
 */
const withoutPortrait = new Set<string>();

export function usePortrait(sheetId: string | null | undefined) {
  // The decoded bitmap lives in the module cache, so it is read during render
  // rather than mirrored into state. This counter exists only to schedule the
  // one re-render that a finished decode needs.
  const [, bump] = useState(0);

  useEffect(() => {
    if (!sheetId || withoutPortrait.has(sheetId)) return;
    if (decoded.has(`portrait:${sheetId}`)) return;

    let cancelled = false;
    loadPortrait(sheetId)
      .then(() => {
        if (!cancelled) bump((tick) => tick + 1);
      })
      .catch(() => {
        // Remembered, so a sheet with no portrait is not asked for again on
        // every render.
        withoutPortrait.add(sheetId);
        if (!cancelled) bump((tick) => tick + 1);
      });

    return () => {
      cancelled = true;
    };
  }, [sheetId]);

  return sheetId ? (decoded.get(`portrait:${sheetId}`) ?? null) : null;
}
