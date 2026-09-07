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

export const loadMapImage = (map: MapDefinition) =>
  gameClient.getMapImageUrl(map).then((url) => decode(`map:${map.id}`, url));

export const loadPortrait = (sheetId: string) =>
  gameClient
    .getPortraitUrl(sheetId)
    .then((url) => decode(`portrait:${sheetId}`, url));

export const loadTokenImage = (sheetId: string) =>
  gameClient
    .getTokenImageUrl(sheetId)
    .then((url) => decode(`token_image:${sheetId}`, url));

const withoutPortrait = new Set<string>();
const withoutToken = new Set<string>();

export function usePortrait(sheetId: string | null | undefined) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!sheetId || withoutPortrait.has(sheetId)) return;
    if (decoded.has(`portrait:${sheetId}`)) return;
    let cancelled = false;
    loadPortrait(sheetId)
      .then(() => {
        if (!cancelled) bump((t) => t + 1);
      })
      .catch(() => {
        withoutPortrait.add(sheetId);
        if (!cancelled) bump((t) => t + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [sheetId]);
  return sheetId ? (decoded.get(`portrait:${sheetId}`) ?? null) : null;
}

export function useTokenImage(sheetId: string | null | undefined) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!sheetId || withoutToken.has(sheetId)) return;
    if (decoded.has(`token_image:${sheetId}`)) return;
    let cancelled = false;
    loadTokenImage(sheetId)
      .then(() => {
        if (!cancelled) bump((t) => t + 1);
      })
      .catch(() => {
        withoutToken.add(sheetId);
        if (!cancelled) bump((t) => t + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [sheetId]);
  return sheetId ? (decoded.get(`token_image:${sheetId}`) ?? null) : null;
}
