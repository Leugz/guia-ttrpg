import { DieShape } from '../../../shared/components/DieShape';
import type { RollResult } from '../../../shared/types';

export interface ToastItem {
  toastId: number;
  sender: string;
  color: string;
  type: 'text' | 'roll';
  content?: string;
  rollLabel?: string;
  rollResult?: RollResult;
}

export function ToastFeed({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className='pointer-events-none absolute bottom-28 right-6 z-[60] flex flex-col items-end gap-3'>
      {toasts.map((toast) => {
        const critValues = new Set<number>();
        if (toast.type === 'roll' && toast.rollResult?.is_critical_success) {
          const counts: Record<number, number> = {};
          toast.rollResult.dice.forEach((d) => {
            counts[d.value] = (counts[d.value] || 0) + 1;
          });
          Object.entries(counts).forEach(([val, count]) => {
            if (Number(val) >= 6 && count >= 2) {
              critValues.add(Number(val));
            }
          });
        }

        return (
          <div
            key={toast.toastId}
            className='animate-float-up-fade w-fit min-w-[340px] max-w-md rounded-sm border border-zinc-700 bg-black/80 px-4 py-3 shadow-2xl backdrop-blur-md'
          >
            {toast.type === 'text' ? (
              <div className='text-sm leading-relaxed'>
                <span
                  className='font-serif font-bold tracking-wider'
                  style={{ color: toast.color }}
                >
                  {toast.sender}:{' '}
                </span>
                <span className='text-zinc-200'>{toast.content}</span>
              </div>
            ) : (
              <div className='flex flex-col gap-3'>
                <div className='text-sm leading-none'>
                  <span
                    className='font-serif font-bold tracking-wider'
                    style={{ color: toast.color }}
                  >
                    {toast.sender}:{' '}
                  </span>
                  <span className='font-bold tracking-wide text-white'>
                    {toast.rollLabel || 'Rolagem'}
                  </span>
                </div>

                {toast.rollResult && (
                  <div className='flex items-center justify-between'>
                    <div className='flex flex-wrap items-center gap-2 py-1'>
                      {toast.rollResult.dice.map((d, i) => (
                        <DieShape
                          key={i}
                          sides={d.sides}
                          value={d.value}
                          className='h-10 w-10 text-lg'
                          colorClass={
                            toast.rollResult!.is_critical_success &&
                            critValues.has(d.value)
                              ? 'text-indigo-400'
                              : toast.rollResult!.is_critical_failure
                                ? 'text-red-500'
                                : !d.counted
                                  ? 'text-zinc-500'
                                  : 'text-white'
                          }
                          isDropped={!d.counted}
                        />
                      ))}
                    </div>

                    <div className='ml-4 flex min-w-[70px] shrink-0 flex-col items-center justify-center border-l border-zinc-700/60 pl-4'>
                      <span className='mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
                        Total
                      </span>
                      <span
                        className={`font-serif text-3xl font-black leading-none ${
                          toast.rollResult.is_critical_success
                            ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]'
                            : toast.rollResult.is_critical_failure
                              ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                              : 'text-white'
                        }`}
                      >
                        {toast.rollResult.total_sum}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
