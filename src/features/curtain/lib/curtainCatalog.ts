export type CurtainClipKind = 'video' | 'image';

export interface CurtainClip {
  id: string;
  title: string;
  url: string;
  kind: CurtainClipKind;
}

/**
 * `mp4` first on purpose: the same loop costs a fraction of what a GIF does,
 * which matters when the whole catalog ships inside the bundle.
 */
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv', 'mov'];

/** Works on both the source path and the hashed URL Vite emits for it. */
export const isVideoClip = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const extension = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  return extension ? VIDEO_EXTENSIONS.includes(extension) : false;
};

/**
 * Bundled the same way the jukebox bundles music, so every machine at the
 * table resolves the same URL and nothing has to travel over the socket.
 *
 * Drop files into `campaigns/shared/curtains/` (or an act's
 * `assets/curtains/`) and they show up here after the next build.
 */
const clipFiles = import.meta.glob(
  [
    '../../../../campaigns/act_*/templates/assets/curtains/*.{mp4,webm,gif,webp,png,jpg,jpeg}',
    '../../../../campaigns/shared/curtains/*.{mp4,webm,gif,webp,png,jpg,jpeg}',
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
      // Read off the source path: it always keeps the real extension, even
      // when the emitted asset name gets a content hash.
      kind: isVideoClip(path) ? 'video' : 'image',
    } satisfies CurtainClip;
  })
  .sort((a, b) => a.title.localeCompare(b.title));
