import { useEffect, useState } from 'react';
import * as gameClient from '../../session/net/gameClient';

/** Resolves the portrait asset URL for whichever identity is active. */
export function usePortraitUrl(
  activeSheetId: string | null,
  isTrueGM: boolean
): string | null {
  const [resolvedPortrait, setResolvedPortrait] = useState<{
    sheetId: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!activeSheetId && !isTrueGM) return;
    let cancelled = false;
    const requestTarget = isTrueGM ? '__GM__' : activeSheetId!;

    gameClient
      .getPortraitUrl(requestTarget)
      .then((url) => {
        if (!cancelled) setResolvedPortrait({ sheetId: requestTarget, url });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeSheetId, isTrueGM]);

  return resolvedPortrait &&
    resolvedPortrait.sheetId === (isTrueGM ? '__GM__' : activeSheetId)
    ? resolvedPortrait.url
    : null;
}
