import { useEffect } from 'react';
import * as gameClient from '../../session/net/gameClient';
import { useLanStore } from '../../session/net/lanStore';

export function useHostCatalogSync(isHosting: boolean) {
  const setSheets = useLanStore((state) => state.setSheets);
  const setHandouts = useLanStore((state) => state.setHandouts);
  const setMaps = useLanStore((state) => state.setMaps);

  useEffect(() => {
    if (!isHosting) return;
    let cancelled = false;

    gameClient
      .listSheets()
      .then((available) => {
        if (!cancelled) setSheets(available);
      })
      .catch((error) => console.error(error));
    gameClient
      .listHandouts()
      .then((available) => {
        if (!cancelled) setHandouts(available);
      })
      .catch((error) => console.error(error));
    gameClient
      .listMaps()
      .then((available) => {
        if (!cancelled) setMaps(available);
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
    };
  }, [isHosting, setSheets, setHandouts, setMaps]);
}
