import { PRESETS, ALGORITHMS, INSTRUMENTS, ROOTS, SCALES, DEFAULT_CONFIG, clone, clamp, createTracks, generate, hash } from './music.mjs';
export const AI_MODEL='Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const AI_REVISION='2c4055b12046f11709e9df2c122e59ffbdc2f900';
export function semanticText(description){return description.slice(0,1500).replace(/\d{2,3}\s*(?:bpm|бпм)/gi,'');}
export const SEMANTIC_ANCHORS=[
  ['mood','calm','Спокойствие, уют, тишина и безопасность. Чтение у камина, тепло и защищённость.'],
  ['mood','calm','Мягкая расслабляющая музыка для отдыха, сна и медитации.'],
  ['mood','tense','Тревожность, страх, угроза, опасность, тяжёлая битва и напряжение.'],
  ['mood','tense','Нервы на пределе, преследование, паника. Нужно спасаться и выжить.'],
  ['mood','heroic','Героическая победа, мужество, решительность и надежда.'],
  ['mood','heroic','Эпическое приключение. Герой преодолевает трудности и побеждает.'],
  ['mood','sad','Печаль, одиночество, потеря, тоска, меланхолия.'],
  ['mood','sad','Грустная музыка, воспоминания о прошлом и слёзы.'],
  ['mood','bright','Радость, веселье, счастье, солнечный день и лёгкость.'],
  ['mood','bright','Светлая, добрая, игривая и жизнерадостная музыка.'],
  ['mood','mysterious','Таинственность, загадка, неизвестность, исследование древних руин.'],
  ['mood','mysterious','Ночной лес. Скрытые тайны, волшебство, любопытство и осторожность.'],
  ['energy','low','Тихая, почти незаметная, медленная музыка. Мало нот, мягкий фон для чтения и отдыха.'],
  ['energy','low','Воздушная нежная атмосфера, спокойная подложка, плавное движение и расслабление.'],
  ['energy','medium','Умеренная энергия, ровная пульсация, ходьба и исследование. Ненавязчивый ритм.'],
  ['energy','medium','Обычное приключение, размеренное движение вперёд, умеренный темп и активность.'],
  ['energy','high','Высокая энергия, мощный бас, плотные ударные, агрессивный бой с боссом и напор.'],
  ['energy','high','Быстрая динамичная музыка для погони, экшена, сражения и кульминации.']
];
export function parseModelPlan(text,description){
  const clean=String(text).replace(/<think>[\s\S]*?<\/think>/g,'').replace(/```(?:json)?|```/g,'').trim();
  const start=clean.indexOf('{');if(start<0)throw new Error('Модель не выдала JSON-план. Попробуйте короче описать сцену.');
  let depth=0,inString=false,escaped=false,end=-1;
  for(let i=start;i<clean.length;i++){const ch=clean[i];if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;}else if(ch==='"')inString=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0){end=i+1;break;}}
  if(end<0)throw new Error('План модели обрезан. Попробуйте более короткое описание.');
  let value;try{value=JSON.parse(clean.slice(start,end));}catch{throw new Error('Модель вернула некорректный JSON. Повторите разбор.');}
  return normalizePlan(value,description,'MiniLM · семантический разбор');
}
export function normalizePlan(value,description,source='Встроенная MiniLM'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Музыкальный план отсутствует');
  const mood=['calm','tense','heroic','sad','bright','mysterious'].includes(value.mood)?value.mood:null;
  const semanticPreset={calm:'ambient',sad:'ambient',bright:'forest',mysterious:'dungeon',tense:value.energy==='high'?'boss':'dark',heroic:value.energy==='high'?'boss':'forest'}[mood]||'ambient';
  const preset=explicitPreset(description)||(Object.hasOwn(PRESETS,value.preset)?value.preset:semanticPreset);const base=PRESETS[preset];
  const number=(name,fallback,a,b)=>typeof value[name]==='number'&&Number.isFinite(value[name])?clamp(Math.round(value[name]),a,b):fallback;
  const rootText=String(value.root??ROOTS[base.root]).replace('#','♯');const root=ROOTS.includes(rootText)?ROOTS.indexOf(rootText):base.root;
  const scale=Object.hasOwn(SCALES,value.scale)?value.scale:/calm|bright|heroic/.test(mood||'')&&['forest','orbit','ambient'].includes(preset)?'major':base.scale;
  let bpm=number('bpm',base.bpm,60,200);const explicit=description.match(/(\d{2,3})\s*(?:bpm|бпм|уд(?:аров)?\s*(?:\/|в)\s*мин)/i);if(explicit)bpm=clamp(Number(explicit[1]),60,200);
  const bars=[4,8,16,32].includes(value.bars)?value.bars:16;
  const progression=Array.isArray(value.progression)&&value.progression.length>0?value.progression.flat(1).slice(0,8).filter(Number.isInteger).map(n=>clamp(n-1,0,SCALES[scale].length-1)):base.progression.map(n=>n%SCALES[scale].length);
  const patches=Array.isArray(value.instruments)?value.instruments.find(x=>x&&typeof x==='object')||{}:value.instruments||{};
  const instruments={};for(const track of ['bass','lead','pad','bell']){const requested=patches[track]||value[track];const name=Object.keys(INSTRUMENTS).find(n=>n.toLowerCase()===String(requested||'').replace(/_/g,' ').trim().toLowerCase());if(name)instruments[track]=name;}
  const energyScores={low:25,medium:55,high:90};const energy=Object.hasOwn(energyScores,value.energy)?energyScores[value.energy]:number('energy',base.intensity,0,100);
  let intensity=number('intensity',energy,0,100),density=number('density',intensity<40?30:intensity>75?75:55,0,100);
  const strong=/плотн[а-яё]*\s+ударн|мощн[а-яё]*\s+ударн|dense\s+drums|битв|финальн[а-яё]*\s+бой/i.test(description);
  const calm=/спокой|расслаб|почти\s+незамет|уют|тишин|calm|gentle/i.test(description)||['calm','sad'].includes(mood);
  if(strong){intensity=Math.max(intensity,80);density=Math.max(density,70);}else if(calm){intensity=Math.min(intensity,35);density=Math.min(density,35);}
  const noDrums=/без\s+(?:ударн|барабан)|no\s+drums/i.test(description);const drums=noDrums?false:strong?true:typeof value.drums==='boolean'?value.drums:intensity>=40;
  if(!instruments.lead&&['calm','sad'].includes(mood))instruments.lead='Warm pad';
  if(/колокол|колоколь|bells/i.test(description))instruments.lead='FM bell';if(/флейт|flute/i.test(description))instruments.lead='Hollow flute';if(/мощн[а-яё]*\s+бас|heavy\s+bass/i.test(description))instruments.bass='Reese bass';if(/т[её]пл[а-яё]*\s+(?:подлож|пад)|warm\s+pad/i.test(description))instruments.pad='Warm pad';
  const moods={calm:'Спокойное',tense:'Напряжённое',heroic:'Героическое',sad:'Печальное',bright:'Светлое',mysterious:'Таинственное'};
  const explanation=value.explanation||`${moods[mood]||'Игровое'} настроение · ${bpm} BPM · ${intensity<40?'редкая аранжировка':intensity>75?'плотная аранжировка':'умеренная пульсация'} · ${drums?'с ударными':'без ударных'}.`;
  return {title:String(value.title||'Тема по описанию').slice(0,80),preset,bpm,root,scale,bars,intensity,density,algorithm:ALGORITHMS.some(a=>a[0]===value.algorithm)?value.algorithm:base.algorithm,drums,progression:progression.length?progression:[0,3,4,0].map(n=>n%SCALES[scale].length),instruments,explanation:String(explanation).slice(0,500),description:description.slice(0,2000),source};
}
function explicitPreset(text){return /босс|boss/i.test(text)?'boss':/кибер|cyber|погон|chase/i.test(text)?'cyber':/ретро|8.?bit|8.?бит|пиксел/i.test(text)?'retro':/лес|forest/i.test(text)?'forest':/космос|space|orbit/i.test(text)?'orbit':/подзем|dungeon/i.test(text)?'dungeon':/мрач|dark|хоррор|horror/i.test(text)?'dark':null;}
export function planToProject(plan){
  const config={...clone(DEFAULT_CONFIG),preset:plan.preset,bpm:plan.bpm,root:plan.root,scale:plan.scale,bars:plan.bars,intensity:plan.intensity,density:plan.density,algorithm:plan.algorithm,progression:plan.progression,seed:'TEXT-'+hash(plan.description).toString(36).toUpperCase()};
  const p=generate(config);p.title=plan.title;
  for(const t of p.tracks){const instrument=plan.instruments[t.id];if(instrument){t.instrument=instrument;const patch=INSTRUMENTS[instrument];t.detune=patch.detune||0;t.fmIndex=patch.index||2.5;t.fmRatio=patch.ratio||2;t.morph=patch.morph??.5;t.grainDensity=patch.grains||6;}
    if(!plan.drums&&['kick','snare','hat'].includes(t.id))t.mute=true;
  }
  p.intent=clone(plan);return p;
}
// Explicitly offered as a rules mode; it never masquerades as neural inference.
export function quickPlan(description){
  const text=description.toLowerCase();let preset=/босс|boss/.test(text)?'boss':/кибер|cyber|погон|chase/.test(text)?'cyber':/ретро|8.?bit|8.?бит|пиксел/.test(text)?'retro':/лес|forest|светл|добрый/.test(text)?'forest':/космос|space|orbit/.test(text)?'orbit':/подзем|dungeon/.test(text)?'dungeon':/мрач|dark|хоррор|horror/.test(text)?'dark':'ambient';
  const p=PRESETS[preset];return normalizePlan({...p,title:'Тема по описанию',preset,density:p.intensity,drums:!(/без\s+(?:ударн|барабан)/.test(text)),root:ROOTS[p.root],progression:p.progression.map(n=>n+1),explanation:'Быстрый разбор ключевых слов: выбран музыкальный мир и базовая аранжировка.'},description,'Правила · без нейросети');
}
