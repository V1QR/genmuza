import { durationOf } from './music.mjs';
export class Renderer {
  constructor(){this.worker=new Worker(new URL('./render-worker.mjs',import.meta.url),{type:'module'});this.next=0;this.jobs=new Map();this.worker.onmessage=({data})=>{const job=this.jobs.get(data.id);if(!job)return;this.jobs.delete(data.id);data.error?job.reject(new Error(data.error)):job.resolve(data.audio);};this.worker.onerror=()=>{for(const job of this.jobs.values())job.reject(new Error('Не удалось запустить аудиорендер'));this.jobs.clear();};}
  render(project,options={}){return new Promise((resolve,reject)=>{const id=++this.next;this.jobs.set(id,{resolve,reject});this.worker.postMessage({id,project,options});});}
}
export class Player {
  constructor(renderer,onChange=()=>{}){this.renderer=renderer;this.onChange=onChange;this.playing=false;this.loop=true;this.generation=0;this.sources=[];this.pending=null;}
  async init(){
    if(!this.context){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Браузер не поддерживает Web Audio API');
      this.context=new Audio();this.compressor=this.context.createDynamicsCompressor();this.compressor.threshold.value=-3;this.compressor.knee.value=3;this.compressor.ratio.value=16;this.compressor.attack.value=.003;this.compressor.release.value=.08;
      this.master=this.context.createGain();this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;this.compressor.connect(this.master);this.master.connect(this.analyser);this.analyser.connect(this.context.destination);
    }
    await this.context.resume();
  }
  setMaster(value){if(this.master)this.master.gain.setTargetAtTime(value,this.context.currentTime,.03);}
  setLoop(value){this.loop=value;for(const s of this.sources)s.source.loop=value;}
  async play(project){
    await this.init();this.stop();const token=++this.generation;this.onChange('render');
    const audio=await this.renderer.render(project,{sampleRate:22050});
    if(token!==this.generation)return;
    this.project=project;this.audio=audio;this.duration=durationOf(project);this.started=this.context.currentTime+.08;this.playing=true;this.sources=[this.startBuffer(audio,this.started,0)];this.onChange('play');
  }
  startBuffer(audio,when,offset){
    const buffer=this.context.createBuffer(2,audio.left.length,audio.sampleRate);buffer.copyToChannel(audio.left,0);buffer.copyToChannel(audio.right,1);
    const source=this.context.createBufferSource();source.buffer=buffer;source.loop=this.loop;const gain=this.context.createGain();source.connect(gain);gain.connect(this.compressor);gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(1,when+.03);source.start(when,Math.max(0,offset)%buffer.duration);
    const item={source,gain};source.onended=()=>{this.sources=this.sources.filter(s=>s!==item);source.disconnect();gain.disconnect();if(this.playing&&!this.loop&&!this.sources.length){this.playing=false;this.onChange('stop');}};return item;
  }
  async update(project,{quantized=true}={}){
    if(!this.playing)return;
    const token=++this.generation;this.pending='render';this.onChange('pending');
    const audio=await this.renderer.render(project,{sampleRate:22050});
    if(token!==this.generation||!this.playing)return;
    const barSeconds=240/this.project.config.bpm;
    const now=this.context.currentTime;
    const when=quantized?this.started+Math.ceil((now+.1-this.started)/barSeconds)*barSeconds:now+.1;
    const position=(when-this.started)%this.duration;
    if(!this.loop&&when-this.started>=this.duration){this.pending=null;this.onChange('play');return;}
    const old=this.sources.slice();const next=this.startBuffer(audio,when,position);this.sources.push(next);
    for(const s of old){s.gain.gain.cancelScheduledValues(when);s.gain.gain.setValueAtTime(1,when);s.gain.gain.linearRampToValueAtTime(0,when+.065);try{s.source.stop(when+.07);}catch{}}
    if(this.pendingTimer)clearTimeout(this.pendingTimer);
    this.pending={when};this.onChange('pending');
    this.pendingTimer=setTimeout(()=>{if(token!==this.generation)return;this.project=project;this.audio=audio;this.pending=null;this.onChange('play');},Math.max(0,(when-now)*1000));
  }
  stop(){
    this.generation++;if(this.pendingTimer)clearTimeout(this.pendingTimer);this.pending=null;
    for(const s of this.sources){try{s.source.stop();}catch{}s.source.disconnect();s.gain.disconnect();}
    this.sources=[];this.playing=false;this.onChange('stop');
  }
  position(){if(!this.playing||!this.context)return 0;return Math.max(0,this.context.currentTime-this.started)%this.duration;}
  async sting(notes=[69,72,76],type='safe'){
    await this.init();const time=this.context.currentTime+.02;
    notes.forEach((midi,i)=>{
      const osc=this.context.createOscillator(),gain=this.context.createGain();osc.type=type==='hit'?'sawtooth':'sine';osc.frequency.value=440*2**((midi-69)/12);gain.gain.setValueAtTime(0,time+i*.1);gain.gain.linearRampToValueAtTime(.09,time+i*.1+.005);gain.gain.exponentialRampToValueAtTime(.0001,time+i*.1+.65);osc.connect(gain);gain.connect(this.compressor);osc.start(time+i*.1);osc.stop(time+i*.1+.7);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    });
  }
}
