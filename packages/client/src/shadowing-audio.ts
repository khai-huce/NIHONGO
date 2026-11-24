export async function readFallbackAudio(audio: File | null): Promise<string | undefined> {
  if (!audio) return undefined;
      if (audio.size > 1024 * 1024 || !audio.size) throw new Error('Chọn MP3 tối đa 1 MiB.');
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Chưa đọc được MP3.'));
        reader.readAsDataURL(audio);
      });
    
}
