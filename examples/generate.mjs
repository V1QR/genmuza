import { writeFile, mkdir } from 'node:fs/promises';
import { generate, DEFAULT_CONFIG, PRESETS, clone } from '../dist/music.mjs';
import { renderProject } from '../dist/dsp.mjs';
import { wav, midi, zip, projectJSON } from '../dist/formats.mjs';
await mkdir(new URL('./audio/',import.meta.url),{recursive:true});
for(const preset of ['boss','ambient','retro']){
  const p=PRESETS[preset];const project=generate({...clone(DEFAULT_CONFIG),...p,preset,bars:4});
  const audio=renderProject(project);const base=new URL('./audio/'+preset,import.meta.url);
  await writeFile(new URL(base.href+'.wav'),wav(audio));
  await writeFile(new URL(base.href+'.mid'),midi(project));
  await writeFile(new URL(base.href+'.json'),projectJSON(project));
  console.log(`${p.name}: ${audio.duration.toFixed(2)}s, peak ${audio.peak.toFixed(3)}`);
}
