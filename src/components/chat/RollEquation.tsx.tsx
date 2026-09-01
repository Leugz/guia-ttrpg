import { RollResult } from '../../lib/systemRules';

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
      className={`mt-2 rounded border bg-black p-2 ${borderColor} text-center font-mono`}
    >
      <div className='mb-1 text-sm tracking-widest text-neutral-400'>
        ({result.rolls.join(' + ')})
      </div>
      <div
        className={`text-2xl font-bold ${isCritSuccess ? 'text-blue-400' : isCritFail ? 'text-red-400' : 'text-white'}`}
      >
        = {result.total_sum}
      </div>
    </div>
  );
}
