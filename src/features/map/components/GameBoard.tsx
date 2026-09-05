/**
 * The board.
 *
 * Three layers, each redrawn on its own schedule, which is what holds the
 * frame budget together:
 *
 *   1. the map — repainted only when the GM reveals a different one;
 *   2. the tokens — repainted while a piece is being dragged;
 *   3. the save markers — repainted by the pulse, and nothing else.
 *
 * Positions never pass through React. `tokenMotion` hands them straight to the
 * Konva node, so a table full of moving pieces causes no re-renders at all;
 * React is only involved when the *set* of tokens changes.
 *
 * Pan and zoom are imperative for the same reason: the stage transform is
 * written directly to the node and deliberately not mirrored in state, so a
 * wheel gesture costs one repaint rather than one render plus one repaint.
 */

import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Shape,
  Stage,
  Text,
} from 'react-konva';

import type { MapDefinition, MapToken } from '../../../shared/types';
import * as gameClient from '../../session/net/gameClient';
import { selectActiveMap, useLanStore } from '../../session/net/lanStore';
import { tokenMotion } from '../tokenMotion';
import { loadMapImage, usePortrait } from '../useMapImages';

/** Token side in map pixels when a map declares no grid. */
const DEFAULT_TOKEN_SIZE = 64;
const MIN_SCALE = 0.1;
const MAX_SCALE = 6;
const ZOOM_STEP = 1.08;
/** Half of the crossfade; the map is swapped at the midpoint. */
const FADE_MS = 260;

export const TOKEN_DRAG_MIME = 'application/x-guia-token';

/** What the profile picture carries when it is dragged onto the board. */
export interface TokenDragPayload {
  sheetId: string | null;
  label: string;
  color: string;
}

const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

/**
 * Keep a Konva node on the authoritative position for a token, without ever
 * rendering. Both the token and its save marker use this, which is how the
 * marker follows a piece it does not own.
 */
function useLivePosition(
  tokenId: string,
  fallbackX: number,
  fallbackY: number,
  nodeRef: React.MutableRefObject<Konva.Group | null>
) {
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const start = tokenMotion.position(tokenId) ?? {
      x: fallbackX,
      y: fallbackY,
    };
    node.position(start);
    node.getLayer()?.batchDraw();

    return tokenMotion.on((id, x, y) => {
      if (id !== tokenId) return;
      const live = nodeRef.current;
      if (!live) return;
      live.position({ x, y });
      live.getLayer()?.batchDraw();
    });
  }, [tokenId, fallbackX, fallbackY, nodeRef]);
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

interface TokenNodeProps {
  token: MapToken;
  size: number;
  /** True when this client is allowed to pick the piece up. */
  canDrag: boolean;
  clientId: string;
  onRemove: (tokenId: string) => void;
}

const TokenNode = React.memo(function TokenNode({
  token,
  size,
  canDrag,
  clientId,
  onRemove,
}: TokenNodeProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const imageRef = useRef<Konva.Image | null>(null);
  const portrait = usePortrait(token.sheet_id);
  const radius = size / 2;

  useLivePosition(token.id, token.x, token.y, groupRef);

  // A grayscale filter needs the node cached, and caching is expensive, so it
  // happens when the flag or the bitmap changes — never during a drag.
  useEffect(() => {
    const node = imageRef.current;
    if (!node || !portrait) return;

    if (token.grayscale) {
      node.filters([Konva.Filters.Grayscale]);
      node.cache();
    } else {
      node.filters([]);
      node.clearCache();
    }
    node.getLayer()?.batchDraw();
  }, [token.grayscale, portrait]);

  /**
   * Movement is coalesced to one message per animation frame. A pointer can
   * fire far more often than that, and the extra messages would buy nobody a
   * smoother picture.
   */
  const pendingFrame = useRef<number | null>(null);
  const pendingPosition = useRef<{ x: number; y: number } | null>(null);

  const flush = useCallback(() => {
    pendingFrame.current = null;
    const next = pendingPosition.current;
    if (!next) return;
    gameClient.moveToken(clientId, token.id, next.x, next.y, true);
  }, [clientId, token.id]);

  const handleDragStart = useCallback(() => {
    // Our own echo would fight the pointer, so ignore it until we let go.
    tokenMotion.claim(token.id);
  }, [token.id]);

  const handleDragMove = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const { x, y } = event.target.position();
      tokenMotion.set(token.id, x, y);
      pendingPosition.current = { x, y };
      if (pendingFrame.current === null) {
        pendingFrame.current = requestAnimationFrame(flush);
      }
    },
    [flush, token.id]
  );

  const handleDragEnd = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      if (pendingFrame.current !== null) {
        cancelAnimationFrame(pendingFrame.current);
        pendingFrame.current = null;
      }
      const { x, y } = event.target.position();
      tokenMotion.release(token.id);
      tokenMotion.set(token.id, x, y);
      gameClient.moveToken(clientId, token.id, x, y, false);
    },
    [clientId, token.id]
  );

  useEffect(
    () => () => {
      if (pendingFrame.current !== null) {
        cancelAnimationFrame(pendingFrame.current);
      }
      tokenMotion.release(token.id);
    },
    [token.id]
  );

  return (
    <Group
      ref={groupRef}
      draggable={canDrag}
      listening={canDrag}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onContextMenu={(event) => {
        event.evt.preventDefault();
        if (canDrag) onRemove(token.id);
      }}
      onMouseEnter={(event) => {
        const container = event.target.getStage()?.container();
        if (container && canDrag) container.style.cursor = 'grab';
      }}
      onMouseLeave={(event) => {
        const container = event.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
      }}
    >
      {portrait ? (
        <>
          {/* Clipping to a circle keeps a rectangular portrait readable at
              token size without asking anyone to crop their art. */}
          <Group
            clipFunc={(context) => {
              context.beginPath();
              context.arc(0, 0, radius, 0, Math.PI * 2, false);
              context.closePath();
            }}
          >
            <KonvaImage
              ref={imageRef}
              image={portrait}
              x={-radius}
              y={-radius}
              width={size}
              height={size}
              perfectDrawEnabled={false}
            />
          </Group>
          <Circle
            radius={radius}
            stroke={token.color}
            strokeWidth={Math.max(2, size * 0.05)}
            opacity={token.grayscale ? 0.45 : 1}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </>
      ) : (
        <>
          <Circle
            radius={radius}
            fill={token.grayscale ? '#3f3f46' : '#18181b'}
            stroke={token.color}
            strokeWidth={Math.max(2, size * 0.05)}
            opacity={token.grayscale ? 0.5 : 1}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Text
            text={initialsOf(token.label)}
            fontFamily='Georgia, serif'
            fontStyle='bold'
            fontSize={size * 0.36}
            fill={token.grayscale ? '#a1a1aa' : token.color}
            width={size}
            height={size}
            offsetX={radius}
            offsetY={radius}
            align='center'
            verticalAlign='middle'
            listening={false}
            perfectDrawEnabled={false}
          />
        </>
      )}
    </Group>
  );
});

// ---------------------------------------------------------------------------
// Save marker
//
// On its own layer so the pulse repaints a handful of rings rather than every
// portrait on the board.
// ---------------------------------------------------------------------------

function SaveMarker({ token, size }: { token: MapToken; size: number }) {
  const groupRef = useRef<Konva.Group | null>(null);
  useLivePosition(token.id, token.x, token.y, groupRef);

  const radius = size / 2;
  // PV failures read red and PD failures indigo, the same pairing the resource
  // bars already use, so the board needs no legend.
  const color =
    token.save_indicator === 'dp'
      ? '#6366f1'
      : token.save_indicator === 'both'
        ? '#f59e0b'
        : '#ef4444';

  return (
    <Group ref={groupRef} listening={false}>
      <Circle
        radius={radius + Math.max(3, size * 0.09)}
        stroke={color}
        strokeWidth={Math.max(2, size * 0.045)}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
      <Text
        text='!'
        fontFamily='Georgia, serif'
        fontStyle='bold'
        fontSize={size * 0.34}
        fill={color}
        x={radius * 0.52}
        y={-radius - size * 0.28}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

interface GameBoardProps {
  clientId: string;
  isGM: boolean;
}

export function GameBoard({ clientId, isGM }: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const mapLayerRef = useRef<Konva.Layer | null>(null);
  const markerLayerRef = useRef<Konva.Layer | null>(null);

  const activeMap = useLanStore(selectActiveMap);
  const tokens = useLanStore((state) => state.tokens);

  /**
   * The map actually on screen. It lags `activeMap` by half a crossfade: the
   * new image is decoded first, then the old one dissolves, then this swaps.
   * Reading the live value here would make the map pop before the fade.
   */
  const [shown, setShown] = useState<{
    map: MapDefinition;
    image: HTMLImageElement;
  } | null>(null);
  /** Keyed by map so it retires on its own when a different one is revealed. */
  const [loadError, setLoadError] = useState<{
    mapId: string;
    message: string;
  } | null>(null);

  // Sizing follows the container rather than the window, so the board stays
  // correct when a panel opens beside it instead of guessing at a width.
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Centre a map and scale it to fit, written straight to the stage. */
  const frameMap = useCallback(
    (image: HTMLImageElement) => {
      const stage = stageRef.current;
      if (!stage || size.width === 0 || size.height === 0) return;
      const scale = Math.min(
        size.width / image.width,
        size.height / image.height
      );
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      stage.scale({ x: clamped, y: clamped });
      stage.position({
        x: (size.width - image.width * clamped) / 2,
        y: (size.height - image.height * clamped) / 2,
      });
      stage.batchDraw();
    },
    [size.width, size.height]
  );

  // The crossfade. Decode first so the board never blinks to empty, then
  // dissolve out, swap, and dissolve back in.
  // Derived rather than stored: when the GM has revealed nothing, there is
  // nothing to draw, and deriving that saves clearing `shown` from an effect.
  const displayed = activeMap ? shown : null;
  const shownId = displayed?.map.id ?? null;

  useEffect(() => {
    if (!activeMap || shownId === activeMap.id) return;

    let cancelled = false;

    loadMapImage(activeMap)
      .then((image) => {
        if (cancelled) return;
        const layer = mapLayerRef.current;

        const swap = () => {
          if (cancelled) return;
          setShown({ map: activeMap, image });
          frameMap(image);
          const target = mapLayerRef.current;
          if (target) {
            new Konva.Tween({
              node: target,
              opacity: 1,
              duration: FADE_MS / 1000,
            }).play();
          }
        };

        // Nothing on screen yet: fade straight in.
        if (!layer || shownId === null) {
          if (layer) layer.opacity(0);
          swap();
          return;
        }

        new Konva.Tween({
          node: layer,
          opacity: 0,
          duration: FADE_MS / 1000,
          onFinish: swap,
        }).play();
      })
      .catch((error: Error) => {
        if (cancelled) return;
        console.error('Failed to load the map image:', error);
        setLoadError({ mapId: activeMap.id, message: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [activeMap, shownId, frameMap]);

  // Fit a newly revealed map once. Refitting on every resize would yank the
  // view out from under someone who had panned somewhere deliberately.
  const framed = useRef<string | null>(null);
  useEffect(() => {
    if (!displayed || size.width === 0 || size.height === 0) return;
    if (framed.current === displayed.map.id) return;
    frameMap(displayed.image);
    framed.current = displayed.map.id;
  }, [displayed, size.width, size.height, frameMap]);

  const handleWheel = useCallback((event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = stage.scaleX();
    // Anchor on the cursor so the point under the pointer stays put, which is
    // what makes zooming feel like moving a real map rather than a slider.
    const anchor = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = event.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale * direction));

    stage.scale({ x: next, y: next });
    stage.position({
      x: pointer.x - anchor.x * next,
      y: pointer.y - anchor.y * next,
    });
    stage.batchDraw();
  }, []);

  const tokenSize =
    displayed && displayed.map.grid_size > 0 ? displayed.map.grid_size : DEFAULT_TOKEN_SIZE;

  const visibleTokens = useMemo(
    () => (displayed ? tokens.filter((token) => token.map_id === displayed.map.id) : []),
    [tokens, displayed]
  );

  const markedTokens = useMemo(
    () => visibleTokens.filter((token) => Boolean(token.save_indicator)),
    [visibleTokens]
  );

  // One animation for every marker on the board, driving the thin marker layer
  // and nothing else. It does not run when there is nothing to pulse.
  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer || markedTokens.length === 0) return;

    const animation = new Konva.Animation((frame) => {
      if (!frame) return;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin((frame.time / 800) * Math.PI));
      layer.children.forEach((child) => child.opacity(pulse));
    }, layer);
    animation.start();

    return () => {
      animation.stop();
      layer.children.forEach((child) => child.opacity(1));
    };
  }, [markedTokens.length]);

  const handleRemove = useCallback(
    (tokenId: string) => gameClient.removeToken(clientId, tokenId),
    [clientId]
  );

  /** Turn a browser drop into a token in map coordinates. */
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const stage = stageRef.current;
      if (!stage || !displayed) return;

      const raw = event.dataTransfer.getData(TOKEN_DRAG_MIME);
      if (!raw) return;

      let payload: TokenDragPayload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }

      const bounds = stage.container().getBoundingClientRect();
      const local = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      // Screen pixels mean nothing to anyone else, so the drop point is
      // converted into map coordinates before it goes on the wire.
      const point = stage.getAbsoluteTransform().copy().invert().point(local);

      gameClient.placeToken(clientId, {
        // Stable per player and per sheet, so dragging your portrait out a
        // second time moves your piece instead of cloning it.
        id: `token:${clientId}:${payload.sheetId ?? 'self'}`,
        map_id: displayed.map.id,
        owner_client_id: clientId,
        sheet_id: payload.sheetId,
        label: payload.label,
        color: payload.color,
        x: point.x,
        y: point.y,
        grayscale: false,
        save_indicator: null,
      });
    },
    [clientId, displayed]
  );

  return (
    <div
      ref={containerRef}
      className='relative h-full w-full bg-[#121212]'
      onDragOver={(event) => {
        // Without this the browser refuses the drop outright.
        if (event.dataTransfer.types.includes(TOKEN_DRAG_MIME)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={handleDrop}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          draggable
          onWheel={handleWheel}
        >
          <Layer ref={mapLayerRef} listening={false}>
            {displayed && (
              <>
                <KonvaImage
                  image={displayed.image}
                  width={displayed.image.width}
                  height={displayed.image.height}
                  perfectDrawEnabled={false}
                />
                {displayed.map.grid_size > 0 && (
                  // One shape for the whole grid: hundreds of Line nodes would
                  // cost far more than a single stroked path.
                  <Shape
                    listening={false}
                    perfectDrawEnabled={false}
                    stroke='rgba(255,255,255,0.10)'
                    strokeWidth={1}
                    sceneFunc={(context, shape) => {
                      const step = displayed.map.grid_size;
                      const { width, height } = displayed.image;
                      context.beginPath();
                      for (let x = step; x < width; x += step) {
                        context.moveTo(x, 0);
                        context.lineTo(x, height);
                      }
                      for (let y = step; y < height; y += step) {
                        context.moveTo(0, y);
                        context.lineTo(width, y);
                      }
                      context.strokeShape(shape);
                    }}
                  />
                )}
              </>
            )}
          </Layer>

          <Layer>
            {visibleTokens.map((token) => (
              <TokenNode
                key={token.id}
                token={token}
                size={tokenSize}
                canDrag={isGM || token.owner_client_id === clientId}
                clientId={clientId}
                onRemove={handleRemove}
              />
            ))}
          </Layer>

          <Layer ref={markerLayerRef} listening={false}>
            {markedTokens.map((token) => (
              <SaveMarker key={token.id} token={token} size={tokenSize} />
            ))}
          </Layer>
        </Stage>
      )}

      {!displayed && (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
          <p className='max-w-xs text-center font-serif text-sm tracking-widest text-zinc-700'>
            {loadError && loadError.mapId === activeMap?.id
              ? `Não foi possível abrir o mapa. ${loadError.message}`
              : activeMap
                ? 'Revelando o mapa…'
                : 'O mestre ainda não revelou nenhum mapa.'}
          </p>
        </div>
      )}
    </div>
  );
}
