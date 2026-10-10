import { renderProject } from './dsp.mjs';
self.onmessage=({data})=>{
  try {
    const audio=renderProject(data.project,data.options);
    const transfer=[audio.left.buffer,audio.right.buffer,...audio.stems.flatMap(s=>[s.left.buffer,s.right.buffer])];
    self.postMessage({id:data.id,audio},transfer);
  } catch(error){self.postMessage({id:data.id,error:error.message});}
};
