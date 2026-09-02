import { FaArrowUp, FaArrowDown, FaSkull, FaStar } from 'react-icons/fa';
import { RollResult } from '../../../shared/types';

export function RollEquation({ result }: { result: RollResult }) {
  const isCritSuccess = result.is_critical_success;
  const isCritFail = result.is_critical_failure;

  let borderColor = 'border-neutral-700';
  if (isCritSuccess)
    borderColor = 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]';
  if (isCritFail)
    borderColor = 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';

  return (
    <div
      className={`mt-2 rounded border bg-black p-3 ${borderColor} font-mono`}
    >
      {/* Visual Crit Indicators (Section 4.12) */}
      {(isCritSuccess || isCritFail) && (
        <div className='mb-2 flex justify-center'>
          {isCritSuccess ? (
            <FaStar className='text-xl text-blue-400' />
          ) : (
            <FaSkull className='text-xl text-red-500' />
          )}
        </div>
      )}

      {/* Die Mapping (Section 4.11) */}
      <div className='mb-3 flex flex-wrap justify-center gap-2'>
        {result.dice.map((die, idx) => (
          <div
            key={idx}
            title={die.source}
            className={`flex flex-col items-center rounded border p-2 ${die.counted ? 'border-neutral-500 bg-neutral-800 text-white' : 'border-neutral-800 bg-neutral-900 text-neutral-600 line-through'}`}
          >
            <span className='mb-1 text-xs uppercase tracking-wider text-neutral-400'>
              d{die.sides}
            </span>
            <span className='flex items-center gap-1 text-lg font-bold'>
              {die.value}
              {/* RA / RB Indicators */}
              {die.is_highest && (
                <FaArrowUp className='text-xs text-blue-400' />
              )}
              {die.is_lowest && (
                <FaArrowDown className='text-xs text-red-500' />
              )}
            </span>
          </div>
        ))}
      </div>

      <div
        className={`text-center text-2xl font-bold ${isCritSuccess ? 'text-blue-400' : isCritFail ? 'text-red-400' : 'text-white'}`}
      >
        = {result.total_sum}
      </div>
    </div>
  );
}
