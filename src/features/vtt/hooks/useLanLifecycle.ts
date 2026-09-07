import { useEffect } from 'react';
import { useLanStore } from '../../session/net/lanStore';
import type { ConnectionStatus } from '../../session/net/protocol';

export interface LanLifecycleOptions {
  isHosting: boolean;
  isLanOpen: boolean;
  lanHostAddress: string | null;
  clientId: string;
  username: string | null;
  identityColor: string;
  connectionStatus: ConnectionStatus;
  localClaim: string | null;
}

export function useLanLifecycle({
  isHosting,
  isLanOpen,
  lanHostAddress,
  clientId,
  username,
  identityColor,
  connectionStatus,
  localClaim,
}: LanLifecycleOptions) {
  const connect = useLanStore((state) => state.connect);
  const disconnect = useLanStore((state) => state.disconnect);
  const updateIdentity = useLanStore((state) => state.updateIdentity);
  const claimSheet = useLanStore((state) => state.claimSheet);

  useEffect(() => {
    if (isHosting) {
      if (isLanOpen) {
        connect('127.0.0.1', {
          clientId,
          username: username || 'Unknown',
          color: identityColor,
        });
      } else {
        useLanStore.getState().disconnectSocketOnly();
      }
    } else {
      if (lanHostAddress) {
        connect(lanHostAddress, {
          clientId,
          username: username || 'Unknown',
          color: identityColor,
        });
      } else {
        disconnect();
      }
    }
  }, [isHosting, isLanOpen, lanHostAddress]);

  useEffect(() => {
    if (isLanOpen && connectionStatus === 'online' && localClaim) {
      claimSheet(clientId, localClaim);
    }
  }, [isLanOpen, connectionStatus, localClaim, clientId, claimSheet]);

  useEffect(() => {
    updateIdentity({
      clientId,
      username: username || 'Unknown',
      color: identityColor,
    });
  }, [identityColor, clientId, username, updateIdentity]);
}
