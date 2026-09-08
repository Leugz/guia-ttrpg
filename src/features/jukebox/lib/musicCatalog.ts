export interface JukeboxTrack {
  id: string;
  title: string;
  url: string;
}

const audioFiles = import.meta.glob(
  [
    '../../../../campaigns/act_*/templates/assets/music/*.{mp3,wav,ogg}',
    '../../../../campaigns/shared/music/*.{mp3,wav,ogg}',
  ],
  {
    eager: true,
    query: '?url',
    import: 'default',
  }
);

export const JUKEBOX_TRACKS: JukeboxTrack[] = Object.entries(audioFiles).map(
  ([path, url]) => {
    const fileName = path.split('/').pop() || 'Unknown Track';
    const title = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

    return {
      id: path,
      title,
      url: url as string,
    };
  }
);
