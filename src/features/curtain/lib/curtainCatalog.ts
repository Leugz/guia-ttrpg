export interface CurtainClip {
  id: string;
  title: string;
  url: string;
}

/**
 * Bundled the same way the jukebox bundles music, so every machine at the
 * table resolves the same URL and nothing has to travel over the socket.
 *
 * Drop files into `campaigns/shared/curtains/` (or an act's
 * `assets/curtains/`) and they show up here after the next build.
 */
const clipFiles = import.meta.glob(
  [
    '../../../../campaigns/act_*/templates/assets/curtains/*.{gif,webp,png,jpg,jpeg}',
    '../../../../campaigns/shared/curtains/*.{gif,webp,png,jpg,jpeg}',
  ],
  {
    eager: true,
    query: '?url',
    import: 'default',
  }
);

export const CURTAIN_CLIPS: CurtainClip[] = Object.entries(clipFiles)
  .map(([path, url]) => {
    const fileName = path.split('/').pop() || 'curtain';
    return {
      id: path,
      title: fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
      url: url as string,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));
