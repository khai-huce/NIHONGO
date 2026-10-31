import { z } from 'zod';
export const handwritingInput = z.object({
  strokes: z.array(z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(1).max(512)).min(1).max(40),
}).strict().refine(v => v.strokes.reduce((n, s) => n + s.length, 0) <= 4096, 'Quá nhiều điểm vẽ. Hãy xóa và viết lại một chữ.');
export type Strokes = z.infer<typeof handwritingInput>['strokes'];

/** Preserve aspect ratio, center ink, white-on-black as required by DaKanji. */
export function rasterize(strokes: Strokes): Float32Array {
  const points = strokes.flat();
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
  const scale = 50 / Math.max(width, height, 0.05);
  const project = ([x,y]: number[]) => [(x-minX-width/2)*scale+31.5,(y-minY-height/2)*scale+31.5];
  const pixels = new Float32Array(64*64);
  for (const stroke of strokes) {
    const projected = stroke.map(project);
    for (let i=0;i<projected.length;i++) {
      const [ax,ay] = projected[Math.max(0,i-1)], [bx,by] = projected[i];
      const dx=bx-ax, dy=by-ay, length=dx*dx+dy*dy;
      for(let y=Math.max(0,Math.floor(Math.min(ay,by)-2));y<=Math.min(63,Math.ceil(Math.max(ay,by)+2));y++) {
        for(let x=Math.max(0,Math.floor(Math.min(ax,bx)-2));x<=Math.min(63,Math.ceil(Math.max(ax,bx)+2));x++) {
          const t=length ? Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/length)) : 0;
          const coverage=Math.max(0,Math.min(1,1.8-Math.hypot(x-ax-t*dx,y-ay-t*dy)));
          pixels[y*64+x]=Math.max(pixels[y*64+x],coverage*255);
        }
      }
    }
  }
  return pixels;
}
