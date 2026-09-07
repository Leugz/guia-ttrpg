import { useEffect } from 'react';
import * as gameClient from '../../session/net/gameClient';
import type { CharacterSheet } from '../../../shared/types';

/**
 * Pushes the local token's visual state (grayscale on a failed death save,
 * the "owes a save" indicator) to the board whenever resources or death
 * saves change.
 */
export function useTokenPresenceSync(
  myTokenId: string | null,
  clientId: string,
  character: CharacterSheet | null,
  isTrueGM: boolean
) {
  useEffect(() => {
    if (!myTokenId || (!character && !isTrueGM)) return;
    const hpDown = character
      ? (character.resources.hp.current || 0) <= 0
      : false;
    const dpDown = character
      ? (character.resources.dp.current || 0) <= 0
      : false;
    const hpFailed = character
      ? Boolean(character.death_saves?.hp?.failed)
      : false;
    const dpFailed = character
      ? Boolean(character.death_saves?.dp?.failed)
      : false;

    const grayscale = hpFailed || dpFailed;
    const owesHp = hpDown && !hpFailed;
    const owesDp = dpDown && !dpFailed;
    const saveIndicator = grayscale
      ? null
      : owesHp && owesDp
        ? 'both'
        : owesHp
          ? 'hp'
          : owesDp
            ? 'dp'
            : null;
    gameClient.setTokenState(clientId, myTokenId, grayscale, saveIndicator);
  }, [myTokenId, clientId, character, isTrueGM]);
}
