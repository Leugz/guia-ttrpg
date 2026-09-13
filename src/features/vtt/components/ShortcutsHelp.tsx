import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
  gmOnly?: boolean;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Mapa',
    shortcuts: [
      { keys: ['W', 'A', 'S', 'D'], description: 'Mover a câmera' },
      { keys: ['Roda do mouse'], description: 'Aproximar e afastar' },
      {
        keys: ['Arrastar'],
        description: 'Deslocar o mapa (com a ferramenta Selecionar)',
      },
      {
        keys: ['Arrastar o retrato'],
        description: 'Colocar o seu token no mapa',
      },
      {
        keys: ['Botão direito no token'],
        description: 'Remover o token do mapa',
      },
    ],
  },
  {
    title: 'Janelas',
    shortcuts: [
      { keys: ['R'], description: 'Rolador de dados' },
      { keys: ['Espaço', 'Enter'], description: 'Abrir e fechar o chat' },
      { keys: ['C'], description: 'Abrir e fechar a ficha' },
      { keys: ['?', 'H'], description: 'Esta lista de atalhos' },
      { keys: ['Esc'], description: 'Fechar a janela em foco' },
    ],
  },
  {
    title: 'Mestre',
    shortcuts: [
      {
        keys: ['V'],
        description: 'Fechar e abrir a cortina (pausa da mesa)',
        gmOnly: true,
      },
    ],
  },
];

interface ShortcutsHelpProps {
  isGM: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ isGM, onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const groups = GROUPS.map((group) => ({
    ...group,
    shortcuts: group.shortcuts.filter((entry) => isGM || !entry.gmOnly),
  })).filter((group) => group.shortcuts.length > 0);

  return (
    <div
      className='fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm'
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className='flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-sm border border-zinc-800 bg-[#0a0a0a] shadow-2xl'
      >
        <div className='flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-3'>
          <h2 className='font-serif text-sm font-bold uppercase tracking-widest text-white'>
            Atalhos do Teclado
          </h2>
          <button
            onClick={onClose}
            className='text-zinc-500 outline-none transition-colors hover:text-white focus:outline-none'
          >
            <X size={16} />
          </button>
        </div>

        <div className='flex flex-col gap-5 overflow-y-auto px-5 py-4'>
          {groups.map((group) => (
            <div key={group.title} className='flex flex-col gap-2'>
              <span className='border-b border-zinc-900 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
                {group.title}
              </span>
              {group.shortcuts.map((entry) => (
                <div
                  key={entry.description}
                  className='flex items-center justify-between gap-4'
                >
                  <span className='text-xs text-zinc-400'>
                    {entry.description}
                  </span>
                  <span className='flex shrink-0 items-center gap-1'>
                    {entry.keys.map((key) => (
                      <kbd
                        key={key}
                        className='rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-300'
                      >
                        {key}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
