import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { FileText, X } from 'lucide-react';

const MIN_WINDOW_WIDTH = 280;
const MIN_WINDOW_HEIGHT = 200;

interface DraggableWindowProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  resizable?: boolean;
}

export function DraggableWindow({
  title,
  onClose,
  children,
  initialX = 100,
  initialY = 100,
  initialWidth = 288,
  initialHeight,
  resizable = false,
}: DraggableWindowProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({
    width: initialWidth,
    height: initialHeight ?? 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });
  const resizeRef = useRef({ startX: 0, startY: 0, width: 0, height: 0 });

  const handlePointerDown = (event: PointerEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: event.clientX - pos.x,
      startY: event.clientY - pos.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging) return;
    setPos({
      x: event.clientX - dragRef.current.startX,
      y: event.clientY - dragRef.current.startY,
    });
  };

  const handlePointerUp = (event: PointerEvent) => {
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleResizeDown = (event: PointerEvent) => {
    event.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: size.width,
      height:
        size.height ||
        event.currentTarget.parentElement?.getBoundingClientRect().height ||
        MIN_WINDOW_HEIGHT,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event: PointerEvent) => {
    if (!isResizing) return;
    setSize({
      width: Math.max(
        MIN_WINDOW_WIDTH,
        resizeRef.current.width + (event.clientX - resizeRef.current.startX)
      ),
      height: Math.max(
        MIN_WINDOW_HEIGHT,
        resizeRef.current.height + (event.clientY - resizeRef.current.startY)
      ),
    });
  };

  const handleResizeUp = (event: PointerEvent) => {
    setIsResizing(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className='pointer-events-auto absolute z-30 flex flex-col gap-2 shadow-2xl'
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height || undefined,
      }}
    >
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-zinc-700 bg-black/70 backdrop-blur-md'>
        <div
          className='flex shrink-0 cursor-move items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-2'
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <span className='flex select-none items-center gap-2 font-serif text-xs font-bold uppercase tracking-widest text-zinc-300'>
            <FileText
              size={14}
              className='shrink-0'
              style={{ color: 'var(--theme-color)' }}
            />
            <span className='translate-y-[2px]'>{title}</span>
          </span>
          <button
            onClick={onClose}
            className='cursor-pointer text-zinc-500 outline-none transition-colors hover:text-white focus:outline-none'
            onPointerDown={(event) => event.stopPropagation()}
          >
            <X size={14} />
          </button>
        </div>
        <div className='flex min-h-0 flex-1 flex-col'>{children}</div>
      </div>

      {resizable && (
        <div
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className='absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize outline-none focus:outline-none'
        >
          <span className='pointer-events-none absolute bottom-1 right-1 block h-2 w-px rotate-45 bg-zinc-600' />
          <span className='pointer-events-none absolute bottom-1 right-2.5 block h-2 w-px rotate-45 bg-zinc-700' />
        </div>
      )}
    </div>
  );
}
