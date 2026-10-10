import { activeEvents, durationOf, TRACKS } from './music.mjs';
const encoder=new TextEncoder();
export function wav(audio){
  const n=audio.left.length; const data=new ArrayBuffer(44+n*4); const view=new DataView(data);
  const text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+n*4,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,audio.sampleRate,true);view.setUint32(28,audio.sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,n*4,true);
  for(let i=0;i<n;i++)for(let c=0;c<2;c++){const v=Math.max(-1,Math.min(1,(c?audio.right:audio.left)[i]));view.setInt16(44+i*4+c*2,Math.round(v*(v<0?32768:32767)),true);}
  return new Uint8Array(data);
}
function variable(value){const bytes=[value&127];while(value>>=7)bytes.unshift((value&127)|128);return bytes;}
const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
const chunk=(name,bytes)=>[...encoder.encode(name),...u32(bytes.length),...bytes];
export function midi(project){
  const ppq=480,tempo=Math.round(60e6/project.config.bpm),total=Math.round(durationOf(project)*project.config.bpm/60*ppq);
  const conductor=[0,255,81,3,(tempo>>16)&255,(tempo>>8)&255,tempo&255,0,255,88,4,4,2,24,8,...variable(total),255,47,0];
  const chunks=[chunk('MTrk',conductor)];
  const channelFor={kick:9,snare:9,hat:9,bass:0,lead:1,pad:2,bell:3};
  const programs={bass:38,lead:80,pad:89,bell:10};
  const events=activeEvents(project);
  for(const track of project.tracks){
    const channel=channelFor[track.id];const name=encoder.encode(track.name);const bytes=[0,255,3,...variable(name.length),...name];
    if(channel!==9)bytes.push(0,192|channel,programs[track.id]);
    bytes.push(0,176|channel,7,channel===9?127:Math.round(track.volume*127),0,176|channel,10,channel===9?64:Math.round((track.pan+1)*63.5));
    const list=[];
    if(channel!==9&&track.automation?.volume?.length)for(let bar=0;bar<project.config.bars;bar++)list.push({tick:bar*ppq*4,type:-1,data:[176|channel,11,Math.round(track.automation.volume[bar]*127)]});
    if(channel!==9&&track.automation?.cutoff?.length)for(let bar=0;bar<project.config.bars;bar++)list.push({tick:bar*ppq*4,type:-1,data:[176|channel,74,Math.round(Math.log(track.automation.cutoff[bar]/60)/Math.log(300)*127)]});
    for(const e of events.filter(e=>e.track===track.id)){
      const time=Math.round(e.time*project.config.bpm/60*ppq);
      const expression=channel===9?track.volume*(track.automation?.volume?.[e.bar]??1):1;
      list.push({tick:time,type:1,data:[144|channel,e.note,Math.max(1,Math.round(e.velocity*expression*127))]});
      list.push({tick:Math.min(total,time+Math.round(e.duration*project.config.bpm/60*ppq)),type:0,data:[128|channel,e.note,0]});
    }
    list.sort((a,b)=>a.tick-b.tick||a.type-b.type);let last=0;
    for(const e of list){bytes.push(...variable(Math.max(0,e.tick-last)),...e.data);last=e.tick;}
    bytes.push(...variable(Math.max(0,total-last)),255,47,0);chunks.push(chunk('MTrk',bytes));
  }
  return Uint8Array.from([...chunk('MThd',[0,1,0,chunks.length,(ppq>>8)&255,ppq&255]),...chunks.flat()]);
}
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
// ZIP STORE, UTF-8 names. No CDN or compression service; stems remain lossless.
export function zip(files){
  const parts=[],central=[];let offset=0;
  for(const [filename,data] of files){
    const name=encoder.encode(filename),bytes=typeof data==='string'?encoder.encode(data):data;
    const crc=crc32(bytes);const header=new Uint8Array(30+name.length);const v=new DataView(header.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);header.set(name,30);
    parts.push(header,bytes);
    const record=new Uint8Array(46+name.length),r=new DataView(record.buffer);
    r.setUint32(0,0x02014b50,true);r.setUint16(4,20,true);r.setUint16(6,20,true);r.setUint16(8,0x800,true);r.setUint32(16,crc,true);r.setUint32(20,bytes.length,true);r.setUint32(24,bytes.length,true);r.setUint16(28,name.length,true);r.setUint32(42,offset,true);record.set(name,46);central.push(record);offset+=header.length+bytes.length;
  }
  const centralLength=central.reduce((s,v)=>s+v.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralLength,true);e.setUint32(16,offset,true);
  const result=new Uint8Array(offset+centralLength+22);let pos=0;for(const p of [...parts,...central,end]){result.set(p,pos);pos+=p.length;}return result;
}
export function projectJSON(project){return JSON.stringify(project,null,2);}
