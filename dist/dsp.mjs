import { INSTRUMENTS, activeEvents, durationOf, hash, rng, clamp } from './music.mjs';
const TAU=Math.PI*2;
const frequency=n=>440*2**((n-69)/12);
function polyBlep(t,dt){if(t<dt){t/=dt;return t+t-t*t-1;}if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1;}return 0;}
function wave(phase,kind,dt){
  const p=phase-Math.floor(phase);
  if(kind==='saw')return 2*p-1-polyBlep(p,dt);
  if(kind==='square')return (p<.5?1:-1)+polyBlep(p,dt)-polyBlep((p+.5)%1,dt);
  if(kind==='triangle')return 1-4*Math.abs(p-.5);
  return Math.sin(TAU*p);
}
function envelope(t,duration,patch){
  const a=patch.attack,d=patch.decay,s=patch.sustain,r=patch.release;
  const value=t<a?t/a:t<a+d?1-(1-s)*(t-a)/d:s;
  if(t>duration){const atRelease=duration<a?duration/a:duration<a+d?1-(1-s)*(duration-a)/d:s;return Math.max(0,atRelease*(1-(t-duration)/r));}
  return value;
}
// Render individual events directly into circular stereo buffers. A note's release and
// effect tail cross the loop boundary instead of being cut off or faded artificially.
export function renderTrack(project,track,{sampleRate=44100,intensity=project.config.intensity,ignoreMix=false}={}){
  const total=durationOf(project); const frames=Math.round(total*sampleRate);
  const left=new Float32Array(frames),right=new Float32Array(frames);
  const patch=INSTRUMENTS[track.instrument];const loop=project.config.form==='loop';
  const events=activeEvents(project,{intensity,track:track.id,ignoreMix});
  const randomSeed=hash(project.config.seed+track.id);
  const panL=Math.cos((track.pan+1)*Math.PI/4),panR=Math.sin((track.pan+1)*Math.PI/4);
  const cutoff=Math.min(sampleRate*.44,track.cutoff); const alpha=1-Math.exp(-TAU*cutoff/sampleRate);
  for(const e of events){
    const f=frequency(e.note);const dt=f/sampleRate; const start=Math.round(e.time*sampleRate);
    const percussion=['kick','noise'].includes(patch.type);
    const life=percussion?Math.min(3,track.attack+track.decay*(patch.type==='kick'?7:5)+track.release):Math.min(total,e.duration+track.release);
    const count=Math.ceil(life*sampleRate); const random=rng(randomSeed+':'+e.id);
    const pluckLength=clamp(Math.round(sampleRate/f),2,4096); let pluck=null;
    if(patch.type==='physical')pluck=Float32Array.from({length:pluckLength},()=>random()*2-1);
    let low=0,prevNoise=0,pluckIndex=0;
    for(let i=0;i<count;i++){
      const t=i/sampleRate;let sample=0;
      switch(patch.type){
        case 'kick': {
          const decay=track.decay;const pitch=patch.pitch||130;const lowFreq=42;
          const phase=lowFreq*t+(pitch-lowFreq)*.025*(1-Math.exp(-t/.025));
          sample=Math.sin(TAU*phase)*Math.exp(-t/decay)+(random()*2-1)*Math.exp(-t/.008)*.15;break;
        }
        case 'noise': {
          const noise=random()*2-1;const high=noise-prevNoise*.88;prevNoise=noise;
          if(patch.mode==='snare')sample=(high*.65+Math.sin(TAU*185*t)*Math.exp(-t/.04)*.35)*Math.exp(-t/(track.decay*.5));
          else if(patch.mode==='clap'){const flutter=[0,.011,.022,.035].reduce((s,offset)=>s+(t>=offset?Math.exp(-(t-offset)/.012):0),0);sample=high*.45*(flutter+Math.exp(-t/track.decay)*.3);}
          else sample=high*.42*Math.exp(-t/(track.decay*(patch.mode==='open'?3:.5)));
          break;
        }
        case 'subtractive': {
          const detune=track.detune;
          sample=wave(f*t,patch.wave,dt)*.5+wave((f+detune)*t,patch.wave,(f+detune)/sampleRate)*.5;break;
        }
        case 'additive': {let sum=0;for(let h=0;h<patch.harmonics.length;h++){if(f*(h+1)<sampleRate*.45){sample+=patch.harmonics[h]*Math.sin(TAU*f*(h+1)*t);sum+=patch.harmonics[h];}}sample/=sum||1;break;}
        case 'fm': {const index=track.fmIndex*Math.exp(-t/Math.max(.12,e.duration));sample=Math.sin(TAU*f*t+index*Math.sin(TAU*f*(track.fmRatio??patch.ratio)*t));break;}
        case 'wavetable': {
          const morph=patch.motion?.5+.45*Math.sin(TAU*t*.23):track.morph;
          sample=0;let sum=0;for(let h=1;h<=8;h++)if(f*h<sampleRate*.45){const gain=(h%2===1?1:.1+morph*.9)/h**(2-morph);sample+=Math.sin(TAU*f*h*t)*gain;sum+=gain;}sample/=sum||1;break;
        }
        case 'granular': {
          const density=track.grainDensity;const spread=patch.spread;
          for(let g=0;g<3;g++){
            const phase=(t*density+g/3)%1;const win=Math.sin(Math.PI*phase)**2;
            const grain=Math.floor(t*density+g/3);const drift=Math.sin((grain+g+randomSeed%31)*1.73)*spread;
            sample+=Math.sin(TAU*f*(1+drift)*t+g*2)*win/3;
          }break;
        }
        case 'physical': {
          sample=pluck[pluckIndex];const next=(pluckIndex+1)%pluckLength;
          pluck[pluckIndex]=(sample+pluck[next])*.5*patch.damping;pluckIndex=next;break;
        }
        case 'shepard': {
          // Four logarithmically spaced falling components. Edge voices lose gain
          // while new voices enter one octave above, producing continuous descent.
          const speed=.075,cycles=t*speed;
          const integral=u=>{const whole=Math.floor(u),fraction=u-whole;return whole*15/(4*Math.LN2)+(2**(4*fraction)-1)/(4*Math.LN2);};
          for(let k=0;k<4;k++){
            const initial=k/4,u=initial-cycles,fraction=u-Math.floor(u);
            const weight=Math.sin(Math.PI*fraction)**2;
            const phase=(integral(initial)-integral(u))/speed*f/4;
            if(f/4*2**(4*fraction)<sampleRate*.44)sample+=Math.sin(TAU*phase)*weight*.35;
          }break;
        }
      }
      low+=alpha*(sample-low);sample=track.filterType==='highpass'?sample-low:low;
      if(track.drive>0)sample=Math.tanh(sample*(1+track.drive*5))/(1+track.drive*1.5);
      const env=percussion?Math.min(1,t/track.attack)*Math.min(1,(life-t)/track.release):envelope(t,e.duration,track);
      // Remove residual DC and enforce exact zero at the end of each finite voice.
      const tail=Math.min(1,(count-i)/Math.max(1,sampleRate*.003));
      sample*=env*tail*e.velocity*track.volume*.46;
      const index=start+i;
      if(index>=frames&&!loop)break;
      left[index%frames]+=sample*panL;right[index%frames]+=sample*panR;
    }
  }
  applyEffects(left,right,track,project.config.bpm,sampleRate,loop);
  applyAutomation(left,right,track,sampleRate,loop);
  if(!loop){const fade=Math.min(frames,Math.round(sampleRate*.035));for(let i=0;i<fade;i++){const gain=i/fade;left[i]*=gain;right[i]*=gain;left[frames-1-i]*=gain;right[frames-1-i]*=gain;}}
  return {left,right,sampleRate,track:track.id,duration:frames/sampleRate};
}
function applyAutomation(left,right,track,rate,loop){
  const volume=track.automation?.volume||[],cutoff=track.automation?.cutoff||[];
  if(!volume.length&&!cutoff.length)return;
  const bars=Math.max(volume.length,cutoff.length),framesPerBar=left.length/bars;
  let lowL=0,lowR=0;
  // Warm the filter using the tail of the preceding loop to avoid a reset at sample 0.
  const process=(i,write)=>{
    const phase=i/framesPerBar,index=Math.floor(phase),fraction=phase-index;
    const interp=points=>points[index]*(1-fraction)+points[loop?(index+1)%points.length:Math.min(points.length-1,index+1)]*fraction;
    let l=left[i],r=right[i];
    if(cutoff.length){const alpha=1-Math.exp(-TAU*Math.min(rate*.44,interp(cutoff))/rate);lowL+=alpha*(l-lowL);lowR+=alpha*(r-lowR);l=lowL;r=lowR;}
    const gain=volume.length?interp(volume):1;
    if(write){left[i]=l*gain;right[i]=r*gain;}
  };
  if(loop&&cutoff.length)for(let i=Math.max(0,left.length-Math.round(rate*.2));i<left.length;i++)process(i,false);
  for(let i=0;i<left.length;i++)process(i,true);
}
function applyEffects(left,right,track,bpm,rate,loop){
  if(!track.delay&&!track.reverb)return;
  const dryL=left.slice(),dryR=right.slice(),n=left.length;
  const taps=[];
  if(track.delay)for(let k=1;k<=4;k++)taps.push({offset:Math.round(60/bpm*.75*rate*k),gain:track.delay*.48**(k-1),cross:k%2===1});
  if(track.reverb)for(let k=0;k<9;k++)taps.push({offset:Math.round((.031+k*.0277)*rate),gain:track.reverb*.5*Math.exp(-k*.32),cross:k%2===1});
  for(const {offset,gain,cross} of taps)for(let i=0;i<n;i++){
    if(!loop&&i<offset)continue;
    const j=(i-offset%n+n)%n;
    left[i]+=(cross?dryR[j]:dryL[j])*gain;right[i]+=(cross?dryL[j]:dryR[j])*gain;
  }
}
export function mixStems(stems,master=.8){
  if(!stems.length)throw new Error('Нет дорожек для микса');
  const left=new Float32Array(stems[0].left.length),right=new Float32Array(left.length);
  let peak=0;
  for(const s of stems)for(let i=0;i<left.length;i++){left[i]+=s.left[i]*master;right[i]+=s.right[i]*master;}
  for(let i=0;i<left.length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
  const gain=peak>.94?.94/peak:1;
  if(gain<1)for(let i=0;i<left.length;i++){left[i]*=gain;right[i]*=gain;}
  return {left,right,sampleRate:stems[0].sampleRate,peak:peak*gain,gain,duration:left.length/stems[0].sampleRate};
}
export function renderProject(project,options={}){
  const stems=project.tracks.map(t=>renderTrack(project,t,options));
  return {...mixStems(stems,project.config.master),stems};
}
