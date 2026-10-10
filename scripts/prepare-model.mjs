import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { AI_MODEL as model, AI_REVISION as revision } from '../dist/intent.mjs';
const root=new URL('../models/'+model+'/',import.meta.url);
for(const file of ['config.json','tokenizer_config.json','tokenizer.json','onnx/model_quantized.onnx']){
  const url='https://huggingface.co/'+model+'/resolve/'+revision+'/'+file;
  const target=new URL(file,root);await mkdir(new URL('.',target),{recursive:true});
  const response=await fetch(url);if(!response.ok)throw new Error(`${file}: HTTP ${response.status}`);
  const expected=Number(response.headers.get('content-length')||0);
  try{const existing=await stat(target);if(expected&&existing.size===expected){console.log('Ready: '+file);continue;}}catch{}
  console.log('Downloading '+file+(expected?' ('+(expected/1e6).toFixed(0)+' MB)':''));
  let count=0,last=0;const stream=Readable.fromWeb(response.body);
  stream.on('data',chunk=>{count+=chunk.length;if(count-last>50e6){console.log(`${file}: ${(count/1e6).toFixed(0)} MB`);last=count;}});
  await pipeline(stream,createWriteStream(fileURLToPath(target)));
  if(expected&&(await stat(target)).size!==expected)throw new Error('Incomplete download: '+file);
}
console.log('Embedded model ready. No Ollama or cloud inference required.');
