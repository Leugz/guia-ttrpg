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
  Line,
} from 'react-konva';

import type { MapDefinition, MapToken } from '../../../shared/types';
import * as gameClient from '../../session/net/gameClient';
import { selectActiveMap, useLanStore } from '../../session/net/lanStore';
import { tokenMotion } from '../tokenMotion';
import { loadMapImage, useTokenImage } from '../useMapImages';

const DEFAULT_TOKEN_SIZE = 64;
const MIN_SCALE = 0.1;
const MAX_SCALE = 6;
const ZOOM_STEP = 1.08;
const FADE_MS = 350;

export const TOKEN_DRAG_MIME = 'application/x-amip-token';

interface RulerShape {
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  color: string;
}

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

interface TokenNodeProps {
  token: MapToken;
  size: number;
  canDrag: boolean;
  clientId: string;
  mapWidth: number;
  mapHeight: number;
  onRemove: (tokenId: string) => void;
}

const TokenNode = React.memo(function TokenNode({
  token,
  size,
  canDrag,
  clientId,
  mapWidth,
  mapHeight,
  onRemove,
}: TokenNodeProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const imageRef = useRef<Konva.Image | null>(null);

  const tokenBitmap = useTokenImage(token.sheet_id);
  const radius = size / 2;

  useLivePosition(token.id, token.x, token.y, groupRef);

  useEffect(() => {
    const node = imageRef.current;
    if (!node || !tokenBitmap) return;
    if (token.grayscale) {
      node.filters([Konva.Filters.Grayscale]);
      node.cache();
    } else {
      node.filters([]);
      node.clearCache();
    }
    node.getLayer()?.batchDraw();
  }, [token.grayscale, tokenBitmap]);

  const pendingFrame = useRef<number | null>(null);
  const pendingPosition = useRef<{ x: number; y: number } | null>(null);

  const flush = useCallback(() => {
    pendingFrame.current = null;
    const next = pendingPosition.current;
    if (!next) return;
    gameClient.moveToken(clientId, token.id, next.x, next.y, true);
  }, [clientId, token.id]);

  const handleDragStart = useCallback(() => {
    tokenMotion.claim(token.id);
  }, [token.id]);

  const handleDragMove = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      let { x, y } = event.target.position();
      x = Math.max(0, Math.min(x, mapWidth));
      y = Math.max(0, Math.min(y, mapHeight));
      event.target.position({ x, y });

      tokenMotion.set(token.id, x, y);
      pendingPosition.current = { x, y };
      if (pendingFrame.current === null) {
        pendingFrame.current = requestAnimationFrame(flush);
      }
    },
    [flush, token.id, mapWidth, mapHeight]
  );

  const handleDragEnd = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      if (pendingFrame.current !== null) {
        cancelAnimationFrame(pendingFrame.current);
        pendingFrame.current = null;
      }
      let { x, y } = event.target.position();
      x = Math.max(0, Math.min(x, mapWidth));
      y = Math.max(0, Math.min(y, mapHeight));

      tokenMotion.release(token.id);
      tokenMotion.set(token.id, x, y);
      gameClient.moveToken(clientId, token.id, x, y, false);
    },
    [clientId, token.id, mapWidth, mapHeight]
  );

  useEffect(
    () => () => {
      if (pendingFrame.current !== null)
        cancelAnimationFrame(pendingFrame.current);
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
      {tokenBitmap ? (
        <KonvaImage
          ref={imageRef}
          image={tokenBitmap}
          x={-radius}
          y={-radius}
          width={size}
          height={size}
          opacity={token.grayscale ? 0.45 : 1}
          perfectDrawEnabled={false}
        />
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

function SaveMarker({ token, size }: { token: MapToken; size: number }) {
  const groupRef = useRef<Konva.Group | null>(null);
  useLivePosition(token.id, token.x, token.y, groupRef);

  const radius = size / 2;
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

function PingNode({ x, y, color }: { x: number; y: number; color: string }) {
  const innerRef = useRef<Konva.Circle>(null);
  const outerRef = useRef<Konva.Circle>(null);
  useEffect(() => {
    if (innerRef.current) {
      new Konva.Tween({
        node: innerRef.current,
        radius: 100,
        opacity: 0,
        duration: 1.2,
        easing: Konva.Easings.EaseOut,
      }).play();
    }
    if (outerRef.current) {
      new Konva.Tween({
        node: outerRef.current,
        radius: 150,
        opacity: 0,
        duration: 1.8,
        easing: Konva.Easings.EaseOut,
      }).play();
    }
  }, []);
  return (
    <Group x={x} y={y}>
      <Circle ref={innerRef} radius={10} fill={color} opacity={0.8} />
      <Circle
        ref={outerRef}
        radius={20}
        stroke={color}
        strokeWidth={6}
        opacity={0.9}
      />
    </Group>
  );
}

interface GameBoardProps {
  clientId: string;
  isGM: boolean;
  activeTool: string;
  identityColor: string;
}

export function GameBoard({
  clientId,
  isGM,
  activeTool,
  identityColor,
}: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const incomingGroupRef = useRef<Konva.Group | null>(null);
  const markerLayerRef = useRef<Konva.Layer | null>(null);

  const activeMap = useLanStore(selectActiveMap);
  const tokens = useLanStore((state) => state.tokens);

  const pings = useLanStore((state) => state.pings);
  const rulers = useLanStore((state) => state.rulers);

  const [shown, setShown] = useState<{
    map: MapDefinition;
    image: HTMLImageElement;
  } | null>(null);
  const [outgoing, setOutgoing] = useState<{
    image: HTMLImageElement;
    grid_size: number;
  } | null>(null);
  const [loadError, setLoadError] = useState<{
    mapId: string;
    message: string;
  } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const [localRuler, setLocalRuler] = useState<RulerShape | null>(null);

  const rulerFrame = useRef<number | null>(null);
  const pendingRuler = useRef<RulerShape | null>(null);

  const flushRuler = useCallback(() => {
    rulerFrame.current = null;
    const next = pendingRuler.current;
    if (!next) return;
    setLocalRuler(next);
    gameClient.sendToolEvent(clientId, { action: 'ruler', ...next });
  }, [clientId]);

  const cancelRulerFrame = useCallback(() => {
    if (rulerFrame.current !== null) {
      cancelAnimationFrame(rulerFrame.current);
      rulerFrame.current = null;
    }
    pendingRuler.current = null;
  }, []);

  useEffect(() => cancelRulerFrame, [cancelRulerFrame]);

  const keys = useRef(new Set<string>());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      keys.current.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let animId: number;
    const loop = () => {
      const stage = stageRef.current;
      if (stage && keys.current.size > 0) {
        const speed = 12;
        let dx = 0;
        let dy = 0;
        if (keys.current.has('w')) dy += speed;
        if (keys.current.has('s')) dy -= speed;
        if (keys.current.has('a')) dx += speed;
        if (keys.current.has('d')) dx -= speed;
        if (dx !== 0 || dy !== 0) {
          const pos = stage.position();
          stage.position({ x: pos.x + dx, y: pos.y + dy });
          stage.batchDraw();
        }
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(animId);
    };
  }, []);

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

  const displayed = activeMap ? shown : null;
  const shownId = displayed?.map.id ?? null;

  useEffect(() => {
    if (!activeMap || shownId === activeMap.id) return;
    let cancelled = false;

    loadMapImage(activeMap)
      .then((image) => {
        if (cancelled) return;
        if (shown) {
          setOutgoing({ image: shown.image, grid_size: shown.map.grid_size });
        }
        setShown({ map: activeMap, image });
        frameMap(image);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        console.error('Failed to load the map image:', error);
        setLoadError({ mapId: activeMap.id, message: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [activeMap, shownId, frameMap, shown]);

  useEffect(() => {
    if (outgoing && incomingGroupRef.current) {
      incomingGroupRef.current.opacity(0);
      new Konva.Tween({
        node: incomingGroupRef.current,
        opacity: 1,
        duration: FADE_MS / 1000,
        onFinish: () => setOutgoing(null),
      }).play();
    }
  }, [shown, outgoing]);

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

  const handlePointerDown = useCallback(() => {
    if (activeTool === 'select' || !displayed) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const transform = stage.getAbsoluteTransform().copy().invert();
    const mapPos = transform.point(pos);

    if (
      mapPos.x < 0 ||
      mapPos.y < 0 ||
      mapPos.x > displayed.image.width ||
      mapPos.y > displayed.image.height
    ) {
      return;
    }

    if (activeTool === 'ping') {
      gameClient.sendToolEvent(clientId, {
        action: 'ping',
        x: mapPos.x,
        y: mapPos.y,
        color: identityColor,
      });
    } else if (activeTool === 'ruler') {
      const newRuler: RulerShape = {
        start_x: mapPos.x,
        start_y: mapPos.y,
        end_x: mapPos.x,
        end_y: mapPos.y,
        color: identityColor,
      };
      setLocalRuler(newRuler);
      gameClient.sendToolEvent(clientId, { action: 'ruler', ...newRuler });
    }
  }, [activeTool, displayed, clientId, identityColor]);

  const handlePointerMove = useCallback(() => {
    if (activeTool !== 'ruler' || !localRuler || !displayed) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const transform = stage.getAbsoluteTransform().copy().invert();
    const mapPos = transform.point(pos);

    pendingRuler.current = {
      start_x: localRuler.start_x,
      start_y: localRuler.start_y,
      end_x: Math.max(0, Math.min(mapPos.x, displayed.image.width)),
      end_y: Math.max(0, Math.min(mapPos.y, displayed.image.height)),
      color: localRuler.color,
    };
    if (rulerFrame.current === null) {
      rulerFrame.current = requestAnimationFrame(flushRuler);
    }
  }, [activeTool, localRuler, displayed, flushRuler]);

  const handlePointerUp = useCallback(() => {
    if (activeTool === 'ruler') {
      cancelRulerFrame();
      setLocalRuler(null);
      gameClient.sendToolEvent(clientId, { action: 'ruler_clear' });
    }
  }, [activeTool, clientId, cancelRulerFrame]);

  const tokenSize =
    displayed && displayed.map.grid_size > 0
      ? displayed.map.grid_size
      : DEFAULT_TOKEN_SIZE;

  const markedTokens = useMemo(
    () => tokens.filter((token) => Boolean(token.save_indicator)),
    [tokens]
  );

  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer || markedTokens.length === 0) return;
    const animation = new Konva.Animation((frame) => {
      if (!frame) return;
      const pulse =
        0.4 + 0.6 * Math.abs(Math.sin((frame.time / 800) * Math.PI));
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
      const point = stage.getAbsoluteTransform().copy().invert().point(local);
      const clampedX = Math.max(0, Math.min(point.x, displayed.image.width));
      const clampedY = Math.max(0, Math.min(point.y, displayed.image.height));

      gameClient.placeToken(clientId, {
        id: `token:${clientId}:${payload.sheetId ?? 'self'}`,
        map_id: displayed.map.id,
        owner_client_id: clientId,
        sheet_id: payload.sheetId,
        label: payload.label,
        color: payload.color,
        x: clampedX,
        y: clampedY,
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
          draggable={activeTool === 'select'}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <Layer listening={false}>
            {outgoing && (
              <Group>
                <KonvaImage
                  image={outgoing.image}
                  width={outgoing.image.width}
                  height={outgoing.image.height}
                  perfectDrawEnabled={false}
                />
              </Group>
            )}

            {displayed && (
              <Group ref={incomingGroupRef} opacity={outgoing ? 0 : 1}>
                <KonvaImage
                  image={displayed.image}
                  width={displayed.image.width}
                  height={displayed.image.height}
                  perfectDrawEnabled={false}
                />
                {displayed.map.grid_size > 0 && (
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
              </Group>
            )}
          </Layer>

          <Layer>
            {tokens.map((token) => (
              <TokenNode
                key={token.id}
                token={token}
                size={tokenSize}
                canDrag={isGM || token.owner_client_id === clientId}
                clientId={clientId}
                mapWidth={displayed?.image.width ?? 0}
                mapHeight={displayed?.image.height ?? 0}
                onRemove={handleRemove}
              />
            ))}
          </Layer>

          <Layer ref={markerLayerRef} listening={false}>
            {markedTokens.map((token) => (
              <SaveMarker key={token.id} token={token} size={tokenSize} />
            ))}
          </Layer>

          <Layer listening={false}>
            {pings.map((p) => (
              <PingNode key={p.id} x={p.x} y={p.y} color={p.color} />
            ))}

            {Object.entries(rulers).map(([ownerId, r]) => {
              if (ownerId === clientId) return null;
              return (
                <Group key={ownerId}>
                  <Line
                    points={[r.start_x, r.start_y, r.end_x, r.end_y]}
                    stroke={r.color}
                    strokeWidth={4}
                    dash={[10, 5]}
                  />
                  <Text
                    x={r.end_x + 10}
                    y={r.end_y + 10}
                    text={`${Math.round((Math.hypot(r.end_x - r.start_x, r.end_y - r.start_y) / tokenSize) * 1.5 * 10) / 10}m`}
                    fill={r.color}
                    fontSize={20}
                    fontStyle='bold'
                    shadowColor='black'
                    shadowBlur={4}
                  />
                </Group>
              );
            })}

            {localRuler && (
              <Group>
                <Line
                  points={[
                    localRuler.start_x,
                    localRuler.start_y,
                    localRuler.end_x,
                    localRuler.end_y,
                  ]}
                  stroke={localRuler.color}
                  strokeWidth={4}
                  dash={[10, 5]}
                />
                <Text
                  x={localRuler.end_x + 10}
                  y={localRuler.end_y + 10}
                  text={`${Math.round((Math.hypot(localRuler.end_x - localRuler.start_x, localRuler.end_y - localRuler.start_y) / tokenSize) * 1.5 * 10) / 10}m`}
                  fill={localRuler.color}
                  fontSize={20}
                  fontStyle='bold'
                  shadowColor='black'
                  shadowBlur={4}
                />
              </Group>
            )}
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
