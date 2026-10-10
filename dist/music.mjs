export const VERSION = 1;
export const TRACKS = [
  { id:'kick', name:'Kick', role:'Бочка', color:'#c5f06e', instrument:'808 deep', volume:.8, pan:0, cutoff:8000, attack:.003, decay:.28, sustain:0, release:.08, delay:0, reverb:.03, drive:.25 },
  { id:'snare', name:'Snare', role:'Малый барабан', color:'#ff9876', instrument:'Snare studio', volume:.48, pan:0, cutoff:9000, attack:.001, decay:.14, sustain:0, release:.04, delay:0, reverb:.13, drive:.15 },
  { id:'hat', name:'Hi-hat', role:'Ритм', color:'#e0c579', instrument:'Closed hat', volume:.28, pan:.22, cutoff:12000, attack:.001, decay:.035, sustain:0, release:.025, delay:.05, reverb:.07, drive:0 },
  { id:'bass', name:'Bass', role:'Бас', color:'#89b4fa', instrument:'Reese bass', volume:.48, pan:0, cutoff:1200, attack:.008, decay:.12, sustain:.6, release:.08, delay:0, reverb:.02, drive:.3 },
  { id:'lead', name:'Lead', role:'Тема', color:'#c8a4ff', instrument:'Square lead', volume:.34, pan:-.16, cutoff:4500, attack:.008, decay:.1, sustain:.32, release:.12, delay:.18, reverb:.16, drive:.08 },
  { id:'pad', name:'Pad', role:'Гармония', color:'#77d7c2', instrument:'Warm pad', volume:.25, pan:.1, cutoff:2000, attack:.3, decay:.25, sustain:.5, release:.7, delay:.05, reverb:.35, drive:0 },
  { id:'bell', name:'Bell', role:'Контрмелодия', color:'#f0a6cb', instrument:'FM bell', volume:.25, pan:.35, cutoff:6000, attack:.003, decay:.35, sustain:.05, release:.55, delay:.25, reverb:.3, drive:0 }
];
// 32 genuine patches in 8 synthesis families. All sources are generated, never sampled files.
export const INSTRUMENTS = {
  '808 deep':{type:'kick', pitch:130, decay:.3}, '909 tight':{type:'kick', pitch:175, decay:.18}, 'Sub kick':{type:'kick', pitch:85, decay:.42}, 'Tom low':{type:'kick', pitch:160, decay:.24},
  'Snare studio':{type:'noise', mode:'snare'}, 'Clap digital':{type:'noise', mode:'clap'}, 'Closed hat':{type:'noise', mode:'hat'}, 'Open hat':{type:'noise', mode:'open'},
  'Reese bass':{type:'subtractive', wave:'saw', detune:3}, 'Acid bass':{type:'subtractive', wave:'saw', detune:0}, 'Square lead':{type:'subtractive', wave:'square', detune:0}, 'Warm pad':{type:'subtractive', wave:'saw', detune:1.7},
  'Sine sub':{type:'additive', harmonics:[1,.12]}, 'Organ':{type:'additive', harmonics:[1,.45,.2,.18,.08,.1]}, 'Glass choir':{type:'additive', harmonics:[1,0,.33,0,.12,0,.06]}, 'Hollow flute':{type:'additive', harmonics:[1,.04,.22,.02,.06]},
  'FM bell':{type:'fm', ratio:2.01, index:3.8}, 'FM brass':{type:'fm', ratio:1, index:2}, 'FM electric':{type:'fm', ratio:3, index:1.4}, 'FM metal':{type:'fm', ratio:3.51, index:5.5},
  'WT shimmer':{type:'wavetable', morph:.75}, 'WT velvet':{type:'wavetable', morph:.25}, 'WT pulse':{type:'wavetable', morph:1}, 'WT motion':{type:'wavetable', morph:.55, motion:true},
  'Grain mist':{type:'granular', grains:6, spread:.12}, 'Grain swarm':{type:'granular', grains:11, spread:.3}, 'Grain frost':{type:'granular', grains:4, spread:.02}, 'Grain dust':{type:'granular', grains:8, spread:.5},
  'Pluck string':{type:'physical', damping:.995}, 'Pluck harp':{type:'physical', damping:.985}, 'Pluck muted':{type:'physical', damping:.965}, 'Pluck wire':{type:'physical', damping:.999},
  'Shepard fall':{type:'shepard'}
};
export const SCALES = { minor:[0,2,3,5,7,8,10], major:[0,2,4,5,7,9,11], pentatonic:[0,3,5,7,10], phrygian:[0,1,3,5,7,8,10], dorian:[0,2,3,5,7,9,10], harmonic:[0,2,3,5,7,8,11] };
export const SCALE_NAMES = {minor:'Натуральный минор',major:'Мажор',pentatonic:'Минорная пентатоника',phrygian:'Фригийский',dorian:'Дорийский',harmonic:'Гармонический минор'};
export const ROOTS = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const ALGORITHMS = [
  ['square','Квадраты','n² mod 8','Модульные повторения'], ['permutation','Перестановка','x ← (5x + 3) mod 8','Детерминированный цикл'],
  ['triangle','Треугольные числа','n(n + 1) / 2 mod 7','Волнообразная тема'], ['mirror','Отражение','2c − x','Обращение интервалов'],
  ['cascade','Каскад','x[n − k] + 7k','Мотив с задержками'], ['euclid','Евклидов ритм','E(k, 16)','Равномерные акценты'],
  ['binary','Бинарный паттерн','10010101','Ритм по маске'], ['poly','Полиритм','step mod 3 = 0','Три поверх четырёх'],
  ['markov','Цепь Маркова','P(xₙ₊₁ | xₙ)','Вероятностное голосоведение'], ['cellular','Клеточный автомат','Rule 90','Развитие бинарных клеток'],
  ['logistic','Логистическая карта','x ← 3.79x(1 − x)','Управляемый хаос'], ['fractal','Фрактальная тема','Тью–Морс','Самоподобная фраза'],
  ['lsystem','L-система','A → AB, B → A','Рекурсивный мотив'], ['fibonacci','Фибоначчи','aₙ₊₂ = aₙ₊₁ + aₙ','Растущий цикл'],
  ['random','Seeded random','PRNG(seed)','Контролируемая случайность'],
  ['chebyshev','Расстояние Чебышёва','max(|Δr|, |Δc|)','Кольца игрового поля'],
  ['neighbors','8 соседей','4 − 3Δr + Δc','Обход соседних клеток'],
  ['shepard','Падение Шепарда','f × 2⁻ᵗ','Октавные слои с перекрытием']
];
export const PRESETS = {
  boss:{name:'Boss Fight',subtitle:'Напор · Reese · 808',bpm:120,root:9,scale:'minor',intensity:75,algorithm:'square', instruments:{},progression:[0,5,2,6]},
  dark:{name:'Dark Game',subtitle:'Глубина · пульс · тени',bpm:96,root:2,scale:'phrygian',intensity:48,algorithm:'triangle',instruments:{lead:'FM electric',bell:'FM metal'},progression:[0,1,5,0]},
  retro:{name:'Retro 8-bit',subtitle:'Пиксели · арпеджио',bpm:144,root:0,scale:'major',intensity:65,algorithm:'permutation',instruments:{bass:'Sine sub',lead:'Square lead',pad:'Organ',bell:'Hollow flute'},progression:[0,3,4,0]},
  ambient:{name:'Tension Ambient',subtitle:'Воздух · текстуры · ожидание',bpm:72,root:9,scale:'minor',intensity:22,algorithm:'mirror',instruments:{bass:'Sine sub',lead:'Pluck harp',pad:'Grain mist',bell:'WT shimmer'},progression:[0,5,3,0]},
  dungeon:{name:'Dungeon',subtitle:'Камень · холод · эхо',bpm:88,root:4,scale:'harmonic',intensity:38,algorithm:'fibonacci',instruments:{lead:'Pluck wire',pad:'Glass choir',bell:'FM bell'},progression:[0,5,3,4]},
  cyber:{name:'Cyber Chase',subtitle:'Скорость · кислота · неон',bpm:168,root:6,scale:'minor',intensity:82,algorithm:'euclid',instruments:{bass:'Acid bass',lead:'WT pulse',pad:'WT motion'},progression:[0,5,2,6]},
  forest:{name:'Forest Quest',subtitle:'Мягкость · дерево · свет',bpm:104,root:7,scale:'dorian',intensity:35,algorithm:'lsystem',instruments:{bass:'Sine sub',lead:'Hollow flute',pad:'WT velvet',bell:'Pluck string'},progression:[0,3,6,0]},
  orbit:{name:'Orbital Drift',subtitle:'Космос · FM · гранулы',bpm:80,root:0,scale:'pentatonic',intensity:30,algorithm:'logistic',instruments:{bass:'Sine sub',lead:'FM electric',pad:'Grain frost',bell:'Glass choir'},progression:[0,3,2,4]}
};
export const STATES = {exploration:{name:'Исследование',intensity:25},tension:{name:'Напряжение',intensity:50},combat:{name:'Бой',intensity:75},boss:{name:'Босс',intensity:100}};
export const DEFAULT_CONFIG = {preset:'boss',bpm:120,root:9,scale:'minor',bars:16,intensity:75,algorithm:'square',seed:'MUZA-2026',melodyRevision:0,drumRevision:0,form:'loop',progression:[0,5,2,6],binary:'10010101',density:65,swing:0,humanize:10,master:.8};
export const clone = value => JSON.parse(JSON.stringify(value));
export function hash(text) { let h=2166136261; for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0; }
export function rng(seed){let a=hash(seed);return ()=>{a+=0x6d2b79f5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
export function degreeNote(degree,root,scale,octave=4){const s=SCALES[scale];const index=((degree%s.length)+s.length)%s.length;return 12*(octave+1)+root+s[index]+12*Math.floor(degree/s.length);}
export function noteName(midi){return ROOTS[((midi%12)+12)%12]+(Math.floor(midi/12)-1);}
export function euclidean(pulses,steps=16,rotation=0){return Array.from({length:steps},(_,i)=>(((i+rotation)*pulses)%steps)<pulses);}
export function sequence(algorithm,length,seed){
  const random=rng(seed);let x=Math.floor(random()*8),a=0,b=1,z=.2+random()*.5,previous=0,cells=Array.from({length:16},(_,i)=>i===8?1:0),word='A';
  while(word.length<length)word=[...word].map(c=>c==='A'?'AB':'A').join('');
  return Array.from({length},(_,n)=>{
    switch(algorithm){
      case 'square': return n*n%8;
      case 'permutation': x=(5*x+3)%8;return x;
      case 'triangle': return n*(n+1)/2%7;
      case 'mirror': return n%8<4?n%4:7-n%8;
      case 'cascade': return (n%4+Math.floor(n/4))%8;
      case 'markov': {const r=random();previous=clamp(previous+(r<.18?-2:r<.45?-1:r<.64?0:r<.91?1:2),0,7);return previous;}
      case 'cellular': {const value=cells.reduce((s,v,i)=>s+v*i,0)%8;cells=cells.map((_,i)=>cells[(i+15)%16]^cells[(i+1)%16]);return value;}
      case 'logistic': z=3.79*z*(1-z);return Math.floor(z*8);
      case 'fractal': return (n.toString(2).split('').filter(v=>v==='1').length%2)*3+n%3;
      case 'lsystem': return (word[n]==='A'?0:3)+(n%4);
      case 'fibonacci': {const v=a%8;[a,b]=[b%56,(a+b)%56];return v;}
      case 'random': return Math.floor(random()*8);
      case 'chebyshev': return Math.max(Math.abs(n%5-2),Math.abs(Math.floor(n/5)%5-2))*2;
      case 'neighbors': {const v=[[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1]][n%8];return 4-3*v[0]+v[1];}
      case 'shepard': return 7-n%8;
      case 'euclid': return (n*3+Math.floor(n/4))%8;
      case 'binary': return (n*5+2)%8;
      case 'poly': return n*2%7;
      default: return n%8;
    }
  });
}
export function chordAt(config,bar){
  let previous=[57,60,64];
  for(let index=0;index<=Math.floor(bar/2);index++){
    const degree=config.progression[index%config.progression.length];
    const raw=[0,2,4].map(d=>degreeNote(degree+d,config.root,config.scale,3));
    let best=null,bestCost=Infinity;
    for(const a of [-24,-12,0,12])for(const b of [-24,-12,0,12])for(const c of [-24,-12,0,12]){
      const notes=[raw[0]+a,raw[1]+b,raw[2]+c].sort((a,b)=>a-b);
      if(notes[0]<48||notes[2]>76||notes[2]-notes[0]>19||new Set(notes).size<3)continue;
      const cost=notes.reduce((sum,n,i)=>sum+Math.abs(n-previous[i]),0)+Math.abs(notes[1]-62)*.12;
      if(cost<bestCost){best=notes;bestCost=cost;}
    }
    previous=best||raw;
  }
  return previous;
}
export function fitRegister(note,low,high,previous=null){
  const candidates=[];for(let shift=-48;shift<=48;shift+=12){const n=note+shift;if(n>=low&&n<=high)candidates.push(n);}
  const center=previous??(low+high)/2;return candidates.reduce((a,b)=>Math.abs(a-center)<=Math.abs(b-center)?a:b,candidates[0]??clamp(note,low,high));
}
export function sectionAt(config,bar){
  if(config.form==='loop')return bar>=config.bars/2&&bar<config.bars*.75?'Вариация':'Тема';
  if(bar<Math.max(1,config.bars/8))return 'Вступление';
  if(bar>=config.bars-Math.max(1,config.bars/8))return 'Финал';
  return bar>=config.bars/2&&bar<config.bars*.75?'Вариация':'Тема';
}
export function createTracks(preset='boss'){return TRACKS.map(t=>({...t,instrument:PRESETS[preset]?.instruments[t.id]||t.instrument,mute:false,solo:false,locked:false,filterType:'lowpass',fmIndex:INSTRUMENTS[PRESETS[preset]?.instruments[t.id]||t.instrument]?.index||2.5,fmRatio:INSTRUMENTS[PRESETS[preset]?.instruments[t.id]||t.instrument]?.ratio||2,detune:INSTRUMENTS[PRESETS[preset]?.instruments[t.id]||t.instrument]?.detune||0,morph:INSTRUMENTS[PRESETS[preset]?.instruments[t.id]||t.instrument]?.morph??.5,grainDensity:INSTRUMENTS[PRESETS[preset]?.instruments[t.id]||t.instrument]?.grains||6,automation:{volume:[],cutoff:[]}}));}
export function generate(config,oldProject=null,only=null){
  config=validateConfig(config);
  const tracks=oldProject?clone(oldProject.tracks):createTracks(config.preset);
  for(const t of tracks)for(const key of ['volume','cutoff'])if(t.automation?.[key]?.length)t.automation[key]=Array.from({length:config.bars},(_,i)=>t.automation[key][i%t.automation[key].length]);
  const events=[];
  let previousLead=null;
  const seconds=60/config.bpm/4;
  const melodicSeed=config.seed+':melody:'+config.melodyRevision;
  const motif=sequence(config.algorithm,8,melodicSeed);
  const melodic=rng(melodicSeed+':arrangement'); const drums=rng(config.seed+':drums:'+config.drumRevision);
  const motifOffset=Math.floor(melodic()*7);
  const add=(track,bar,step,note,duration,velocity,minIntensity=0)=>{
    const rand=['kick','snare','hat'].includes(track)?drums:melodic;
    const swing=step%2?config.swing/100*.45:0;
    const jitter=(rand()-.5)*config.humanize/100*.15;
    events.push({id:`${track}-${bar}-${step}-${events.length}`,track,bar,step,time:Math.max(0,(bar*16+step+swing+jitter)*seconds),note:clamp(Math.round(note),0,127),duration:duration*seconds,velocity:clamp(velocity*(1+(rand()-.5)*config.humanize/100),.05,1),minIntensity:clamp(minIntensity,0,100)});
  };
  for(let bar=0;bar<config.bars;bar++){
    const degree=config.progression[Math.floor(bar/2)%config.progression.length];
    const variation=sectionAt(config,bar)==='Вариация';
    const quiet=['Вступление','Финал'].includes(sectionAt(config,bar));
    const base=quiet?25:0;
    const chord=chordAt(config,bar);
    for(const note of chord)add('pad',bar,0,note,14,.58,0);
    const rhythm=config.algorithm==='euclid'?euclidean(5,16,bar%2):config.algorithm==='cellular'?sequence('cellular',16,config.seed+bar).map(v=>v%2===0):null;
    for(let s=0;s<16;s++){
      if(s===0||s===8||s===10&&variation||s===14&&bar%4===3)add('kick',bar,s,36,1.5,s===0?.95:.78,s===0?base:base+35);
      if(s===4||s===12)add('snare',bar,s,38,1,.8,base+40);
      if(variation&&s===15)add('snare',bar,s,38,.5,.42,base+75);
      if(s%2===0||drums()<.22)add('hat',bar,s,s===14?46:42,.4,s%4===0?.65:.38,base+(s%4===0?20:s%2===0?45:80));
      if(s%4===0||s===6||s===14)add('bass',bar,s,degreeNote(degree+(s===14?4:0),config.root,config.scale,1),s%4===0?2.8:1.5,s%4===0?.85:.55,base+(s%4===0?0:50));
      const trigger=config.algorithm==='poly'?(bar*16+s)%3===0:config.algorithm==='binary'?config.binary[(bar*16+s)%config.binary.length]==='1':rhythm?rhythm[s]:s%2===0;
      if(trigger){
        const i=config.algorithm==='poly'?Math.floor((bar*16+s)/3)%8:Math.floor(s/2)%8;const m=(motif[(i+(bar%4===3?2:0))%8]+motifOffset)%8;
        let d=config.algorithm==='mirror'&&bar%4>=2?-m:variation?7-m:m;
        // Chord tones on accented beats, bounded stepwise motion between them.
        if(s%4===0)d=[0,2,4][m%3];
        if(s===0&&bar%4===0)d=0;
        const note=fitRegister(degreeNote(degree+d,config.root,config.scale,4),60,84,previousLead);previousLead=note;
        const densityThreshold=clamp((100-config.density)*.5+(s%4===0?0:20),0,90);
        add('lead',bar,s,note,s%4===0?1.6:.85,s%4===0?.75:.52,quiet?65:densityThreshold);
        if(config.algorithm==='cascade'&&s<12)add('bell',bar,s+3,note+12,.7,.35,55);
      }
      if(s===3||s===11||variation&&s===7){
        // Answer phrases favour a chord tone in a different register.
        add('bell',bar,s,fitRegister(chord[(bar+Math.floor(s/4))%3]+24,72,96),1.8,.5,quiet?20:55);
      }
    }
    if(config.form==='song'&&bar===config.bars-1){
      for(let i=events.length-1;i>=0;i--)if(events[i].bar===bar&&events[i].step>7)events.splice(i,1);
      add('bell',bar,8,degreeNote(0,config.root,config.scale,4),6,.55,0);
    }
  }
  let result=events;
  if(oldProject){
    const replace=new Set(only==='melody'?['lead','bell']:only==='drums'?['kick','snare','hat']:tracks.filter(t=>!t.locked).map(t=>t.id));
    for(const t of tracks)if(t.locked)replace.delete(t.id);
    const ratio=oldProject.config.bpm/config.bpm;
    result=[...oldProject.events.filter(e=>!replace.has(e.track)&&e.bar<config.bars).map(e=>({...e,time:e.time*ratio,duration:e.duration*ratio})),...events.filter(e=>replace.has(e.track))];
  }
  result.sort((a,b)=>a.time-b.time||a.note-b.note||a.track.localeCompare(b.track));
  return {version:VERSION,config,tracks,events:result,motif,createdAt:oldProject?.createdAt||new Date().toISOString(),title:oldProject?.title||'Безымянная тема',...(oldProject?.intent?{intent:clone(oldProject.intent)}:{})};
}
export function durationOf(project){return project.config.bars*4*60/project.config.bpm;}
export function activeEvents(project,{intensity=project.config.intensity,track=null,ignoreMix=false}={}){
  const solo=project.tracks.some(t=>t.solo&&!t.mute);
  const audible=new Set(project.tracks.filter(t=>(!track||t.id===track)&&(ignoreMix||!t.mute&&(!solo||t.solo))).map(t=>t.id));
  return project.events.filter(e=>audible.has(e.track)&&e.minIntensity<=intensity);
}
export function assess(project){
  const melodic=project.events.filter(e=>['bass','lead','pad','bell'].includes(e.track));
  const scale=SCALES[project.config.scale];
  const inScale=melodic.filter(e=>scale.includes((e.note-project.config.root+120)%12)).length;
  const lead=melodic.filter(e=>e.track==='lead');let smooth=0;
  for(let i=1;i<lead.length;i++)if(Math.abs(lead[i].note-lead[i-1].note)<=7)smooth++;
  const activity=activeEvents(project).length;
  return {inScale:melodic.length?Math.round(inScale/melodic.length*100):100,smooth:lead.length>1?Math.round(smooth/(lead.length-1)*100):100,events:activity,chords:Math.ceil(project.config.bars/2)};
}
export function validateConfig(value){
  if(!value||typeof value!=='object')throw new Error('Настройки проекта отсутствуют');
  const c={...DEFAULT_CONFIG,...value};
  for(const [k,min,max] of [['bpm',60,200],['root',0,11],['intensity',0,100],['density',0,100],['swing',0,70],['humanize',0,100],['master',0,1],['melodyRevision',0,1e6],['drumRevision',0,1e6]]){
    if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<min||c[k]>max)throw new Error(`Недопустимый параметр: ${k}`);
  }
  if(![4,8,16,32].includes(c.bars))throw new Error('Длина: 4, 8, 16 или 32 такта');
  if(!Number.isInteger(c.root)||!Number.isInteger(c.melodyRevision)||!Number.isInteger(c.drumRevision))throw new Error('Тональность и версии должны быть целыми');
  if(!SCALES[c.scale]||!PRESETS[c.preset]||!ALGORITHMS.some(a=>a[0]===c.algorithm)||!['loop','song'].includes(c.form))throw new Error('Неизвестная гамма, стиль, алгоритм или форма');
  if(typeof c.seed!=='string'||!c.seed.length||c.seed.length>128)throw new Error('Seed должен содержать 1–128 символов');
  if(typeof c.binary!=='string'||!/^[01]{1,32}$/.test(c.binary)||!c.binary.includes('1'))throw new Error('Бинарный паттерн: 1–32 знака 0/1, хотя бы одна 1');
  if(!Array.isArray(c.progression)||!c.progression.length||c.progression.length>16||c.progression.some(d=>!Number.isInteger(d)||d<0||d>=SCALES[c.scale].length))throw new Error('Аккордовая прогрессия не соответствует гамме');
  return c;
}
export function validateProject(value){
  if(value?.version!==VERSION)throw new Error('Неподдерживаемая версия проекта');
  const config=validateConfig(value.config);
  if(!Array.isArray(value.tracks)||value.tracks.length!==7||new Set(value.tracks.map(t=>t.id)).size!==7)throw new Error('В проекте должно быть 7 уникальных дорожек');
  const tracks=value.tracks.map(t=>{
    const base=TRACKS.find(b=>b.id===t.id);if(!base||!INSTRUMENTS[t.instrument])throw new Error('Неизвестная дорожка или инструмент');
    for(const [k,a,b] of [['volume',0,1],['pan',-1,1],['cutoff',60,18000],['attack',.001,2],['decay',.01,2],['sustain',0,1],['release',.01,3],['delay',0,.6],['reverb',0,.7],['drive',0,1],['fmIndex',0,10],['fmRatio',.25,8],['detune',0,12],['morph',0,1],['grainDensity',2,16]]){
      if(t[k]!==undefined&&(typeof t[k]!=='number'||!Number.isFinite(t[k])||t[k]<a||t[k]>b))throw new Error(`Параметр инструмента: ${k}`);
    }
    if(t.filterType!==undefined&&!['lowpass','highpass'].includes(t.filterType))throw new Error('Неизвестный фильтр');
    if(t.automation!==undefined){for(const [key,a,b] of [['volume',0,1],['cutoff',60,18000]]){const points=t.automation[key];if(!Array.isArray(points)||![0,config.bars].includes(points.length)||points.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<a||v>b))throw new Error('Некорректная автоматизация '+key);}}
    return {...createTracks(config.preset).find(b=>b.id===t.id),...t,name:base.name,role:base.role,color:base.color,mute:!!t.mute,solo:!!t.solo,locked:!!t.locked};
  });
  if(!Array.isArray(value.events)||value.events.length>20000)throw new Error('Слишком много нот');
  const duration=config.bars*240/config.bpm;
  const events=value.events.map((e,i)=>{
    if(!TRACKS.some(t=>t.id===e.track))throw new Error('Дорожка ноты отсутствует');
    for(const [k,a,b] of [['time',0,duration],['note',0,127],['duration',.001,duration],['velocity',.01,1],['minIntensity',0,100],['bar',0,config.bars-1],['step',0,15]])if(typeof e[k]!=='number'||!Number.isFinite(e[k])||e[k]<a||e[k]>b)throw new Error(`Некорректная нота ${i}: ${k}`);
    if(!Number.isInteger(e.note)||!Number.isInteger(e.bar)||!Number.isInteger(e.step))throw new Error('Нота и шаг должны быть целыми');
    return {...e,id:String(e.id||`import-${i}`).slice(0,100)};
  });
  const intent=value.intent&&typeof value.intent==='object'?{description:String(value.intent.description||'').slice(0,2000),source:String(value.intent.source||'').slice(0,80),title:String(value.intent.title||'').slice(0,80),explanation:String(value.intent.explanation||'').slice(0,500)}:null;
  return {...(intent?{intent}:{}),version:VERSION,config,tracks,events,motif:sequence(config.algorithm,8,config.seed+':melody:'+config.melodyRevision),title:String(value.title||'Импортированный проект').slice(0,100),createdAt:String(value.createdAt||new Date().toISOString())};
}
