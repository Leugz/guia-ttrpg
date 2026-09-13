import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const WHEEL_STEP = 1.15;
const BUTTON_STEP = 1.4;

interface ZoomableImageProps {
  src: string;
  alt: string;
}

/**
 * Wheel to zoom toward the cursor, drag to pan, double click to reset.
 * Panning is clamped so the picture can never be shoved out of view.
 */
export function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panOrigin = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const clampOffset = useCallback(
    (next: { x: number; y: number }, atScale: number) => {
      const frame = frameRef.current;
      if (!frame || atScale <= 1) return { x: 0, y: 0 };

      const { width, height } = frame.getBoundingClientRect();
      const slackX = (width * (atScale - 1)) / 2;
      const slackY = (height * (atScale - 1)) / 2;
      return {
        x: Math.max(-slackX, Math.min(slackX, next.x)),
        y: Math.max(-slackY, Math.min(slackY, next.y)),
      };
    },
    []
  );

  const zoomTo = useCallback(
    (nextScale: number, anchor?: { x: number; y: number }) => {
      const frame = frameRef.current;
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));

      setScale((current) => {
        if (!frame || clamped === current) return clamped;

        const bounds = frame.getBoundingClientRect();
        const point = anchor ?? {
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        };
        const fromCenterX = point.x - (bounds.left + bounds.width / 2);
        const fromCenterY = point.y - (bounds.top + bounds.height / 2);
        const ratio = clamped / current;

        setOffset((currentOffset) =>
          clampOffset(
            {
              x: fromCenterX - (fromCenterX - currentOffset.x) * ratio,
              y: fromCenterY - (fromCenterY - currentOffset.y) * ratio,
            },
            clamped
          )
        );
        return clamped;
      });
    },
    [clampOffset]
  );

  // Registered by hand so the listener is not passive and can block the
  // window's own scroll while the cursor is over the picture.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? 1 / WHEEL_STEP : WHEEL_STEP;
      setScale((current) => {
        const next = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, current * direction)
        );
        if (next === current) return current;

        const bounds = frame.getBoundingClientRect();
        const fromCenterX = event.clientX - (bounds.left + bounds.width / 2);
        const fromCenterY = event.clientY - (bounds.top + bounds.height / 2);
        const ratio = next / current;

        setOffset((currentOffset) =>
          clampOffset(
            {
              x: fromCenterX - (fromCenterX - currentOffset.x) * ratio,
              y: fromCenterY - (fromCenterY - currentOffset.y) * ratio,
            },
            next
          )
        );
        return next;
      });
    };

    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [clampOffset]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (scale <= 1 || event.button !== 0) return;
    setIsPanning(true);
    panOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!isPanning) return;
    setOffset(
      clampOffset(
        {
          x: panOrigin.current.offsetX + (event.clientX - panOrigin.current.x),
          y: panOrigin.current.offsetY + (event.clientY - panOrigin.current.y),
        },
        scale
      )
    );
  };

  const stopPanning = (event: React.PointerEvent) => {
    if (!isPanning) return;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        onDoubleClick={reset}
        className={`relative min-h-0 flex-1 overflow-hidden rounded border border-zinc-800 bg-black/40 ${
          scale > 1
            ? isPanning
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : 'cursor-zoom-in'
        }`}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className='pointer-events-none absolute inset-0 h-full w-full object-contain'
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: isPanning ? 'none' : 'transform 90ms linear',
          }}
        />
      </div>

      <div className='mt-2 flex shrink-0 items-center justify-center gap-1'>
        <button
          onClick={() => zoomTo(scale / BUTTON_STEP)}
          disabled={scale <= MIN_SCALE}
          title='Afastar'
          className='rounded-sm border border-zinc-800 bg-black/60 p-1.5 text-zinc-400 outline-none transition-colors hover:border-zinc-600 hover:text-white focus:outline-none disabled:opacity-30'
        >
          <Minus size={14} />
        </button>
        <span className='w-14 text-center font-mono text-[10px] tabular-nums text-zinc-500'>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => zoomTo(scale * BUTTON_STEP)}
          disabled={scale >= MAX_SCALE}
          title='Aproximar'
          className='rounded-sm border border-zinc-800 bg-black/60 p-1.5 text-zinc-400 outline-none transition-colors hover:border-zinc-600 hover:text-white focus:outline-none disabled:opacity-30'
        >
          <Plus size={14} />
        </button>
        <button
          onClick={reset}
          title='Ajustar à janela'
          className='ml-1 rounded-sm border border-zinc-800 bg-black/60 p-1.5 text-zinc-400 outline-none transition-colors hover:border-zinc-600 hover:text-white focus:outline-none'
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}
