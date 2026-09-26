export function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onloadedmetadata = () => resolve(audio.duration);
    audio.onerror = reject;
    audio.preload = 'metadata';
    audio.load();
  });
}
