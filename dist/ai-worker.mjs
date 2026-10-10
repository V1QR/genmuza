import { AI_MODEL, AI_REVISION, SEMANTIC_ANCHORS, semanticText } from './intent.mjs';
let pipe,loading,anchors,busy=false;
async function load(){
  if(pipe)return pipe;if(loading)return loading;
  loading=(async()=>{
    const {pipeline,env}=await import('./vendor/transformers.js');
    env.backends.onnx.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;
    env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
    env.useBrowserCache=true;env.localModelPath=new URL('./models/',self.location.origin+'/').href;
    let local=false;try{local=(await fetch(env.localModelPath+AI_MODEL+'/onnx/model_quantized.onnx',{method:'HEAD'})).ok;}catch{}
    env.allowLocalModels=local;env.allowRemoteModels=!local;
    self.postMessage({type:'status',text:local?'Загружаю встроенные веса с устройства…':'Первое использование: загрузка модели ~118 МБ и tokenizer в кэш…'});
    pipe=await pipeline('feature-extraction',AI_MODEL,{dtype:'q8',device:'wasm',revision:local?'main':AI_REVISION,progress_callback:p=>{
      if(p.status==='progress')self.postMessage({type:'progress',file:p.file,loaded:p.loaded,total:p.total,progress:p.progress});
    }});
    self.postMessage({type:'status',text:'Подготовка смысловых ориентиров…'});
    anchors=[];for(let i=0;i<SEMANTIC_ANCHORS.length;i+=6){const output=await pipe(SEMANTIC_ANCHORS.slice(i,i+6).map(a=>a[2]),{pooling:'mean',normalize:true,truncation:true,max_length:128});anchors.push(...output.tolist());}
    self.postMessage({type:'ready',text:'MiniLM готова · вычисления на устройстве'});
    return pipe;
  })().catch(error=>{pipe=null;loading=null;throw error;});return loading;
}
function classify(vector,group){
  const scores=new Map();
  SEMANTIC_ANCHORS.forEach(([g,label],i)=>{if(g!==group)return;let dot=0;for(let j=0;j<vector.length;j++)dot+=vector[j]*anchors[i][j];scores.set(label,Math.max(scores.get(label)??-1,dot));});
  return [...scores].sort((a,b)=>b[1]-a[1])[0][0];
}
self.onmessage=async({data})=>{
  if(busy){self.postMessage({id:data.id,type:'error',error:'Модель уже выполняет задачу'});return;}busy=true;
  try{
    const model=await load();
    self.postMessage({type:'status',text:'Разбираю смысл описания на устройстве…'});
    const output=await model(semanticText(data.description),{pooling:'mean',normalize:true,truncation:true,max_length:256});
    const vector=output.tolist()[0];
    const plan={mood:classify(vector,'mood'),energy:classify(vector,'energy')};
    self.postMessage({id:data.id,type:'result',text:JSON.stringify(plan)});
  }catch(error){self.postMessage({id:data.id,type:'error',error:error.message});}finally{busy=false;}
};
