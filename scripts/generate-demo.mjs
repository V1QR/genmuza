import { mkdir, writeFile } from 'node:fs/promises';
import { generate, DEFAULT_CONFIG, clone } from '../dist/music.mjs';
import { renderProject } from '../dist/dsp.mjs';
import { wav, projectJSON } from '../dist/formats.mjs';
const root=new URL('../dist/media/',import.meta.url);await mkdir(root,{recursive:true});
const project=generate({...clone(DEFAULT_CONFIG),bars:16,seed:'GENMUZA-DEMO-2026',phrasing:'expressive'});
const rate=44100,seconds=24,fade=.45;
const buffers=[25,75,100].map(intensity=>renderProject({...project,config:{...project.config,intensity}},{sampleRate:rate}));
const left=new Float32Array(seconds*rate),right=new Float32Array(left.length);
for(let i=0;i<left.length;i++){
  const t=i/rate,index=Math.min(2,Math.floor(t/8)),mix=index?Math.min(1,(t-index*8)/fade):1;
  const ending=Math.min(1,(seconds-t)/.2),beginning=Math.min(1,t/.03);
  for(const [key,out] of [['left',left],['right',right]])out[i]=((index?buffers[index-1][key][i]*(1-mix):0)+buffers[index][key][i]*mix)*ending*beginning;
}
await writeFile(new URL('demo.wav',root),wav({left,right,sampleRate:rate}));
await writeFile(new URL('demo-project.json',root),projectJSON(project));
console.log('24-second adaptive demo generated: exploration → combat → boss');
