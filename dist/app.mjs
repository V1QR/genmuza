import { translate as t, initLanguage, getLanguage } from './i18n.mjs';
import { DEFAULT_CONFIG, PRESETS, TRACKS, SCALES, SCALE_NAMES, ROOTS, ALGORITHMS, INSTRUMENTS, STATES, clone, clamp, generate, sequence, createTracks, noteName, chordAt, sectionAt, phraseAt, durationOf, activeEvents, assess, degreeNote, validateProject, createVariants, extractFragment, hash } from './music.mjs';
import { wav, midi, zip, projectJSON } from './formats.mjs';
import { Renderer, Player } from './player.mjs';
import { parseModelPlan, quickPlan, planToProject } from './intent.mjs';
import { readLibrary, storeProject, projectKey } from './library.mjs';
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=v=>`${String(Math.floor(v/60)).padStart(2,'0')}:${String(Math.floor(v%60)).padStart(2,'0')}`;
let project=generate(clone(DEFAULT_CONFIG)),bar=0,view='studio',pianoTrack='lead',synthTrack='lead',selected=null,follow=true,history=[],renderTimer,saveTimer,toastTimer,currentState='combat',busyExport=false;
let storageAvailable=true;
let automationTrack='lead',automationParam='volume',automationBar=0;
let intentPlan=null,aiWorker=null,aiBusy=false,aiSequence=0,aiStarted=0,aiTimer;
let variants=[],variantRound=0,previewVariant=null,demoTimers=[],demoRun=0,demoOriginal=null;
try{const stored=localStorage.getItem('genmuza-session');if(stored)project=validateProject(JSON.parse(stored));}catch(error){storageAvailable=false;console.warn('Session could not be restored:',error.message);}
const renderer=new Renderer();
const player=new Player(renderer,status=>{
  $('play').disabled=status==='render';$('play').textContent=player.playing?'❚❚':'▶';$('play').setAttribute('aria-label',player.playing?'Остановить':'Воспроизвести');
  const message={render:'Рендер аудио…',play:'Воспроизведение',stop:'Композиция готова',pending:player.pending==='render'?'Подготовка перехода…':'Переход на следующем такте'}[status];
  $('transport-status').textContent=status==='play'&&previewVariant!==null?'Вариант '+String.fromCharCode(65+previewVariant)+' · прослушивание':message||'Готово';
  $('director-status').textContent=status==='pending'?'Переход по такту':STATES[currentState]?.name||'Свободная интенсивность';
});
function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').className=error?'error':'';$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function run(action){return async(...args)=>{try{await action(...args);}catch(error){toast(error.message,true);$('play').disabled=false;if(!player.playing)$('transport-status').textContent='Не удалось воспроизвести';}};}
function remember(){history.push(clone(project));if(history.length>35)history.shift();$('undo').disabled=false;}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('genmuza-session',projectJSON(demoOriginal||project));storageAvailable=true;$('save-state').textContent='Сохранено на устройстве';}catch{$('save-state').textContent='Сохраните JSON';storageAvailable=false;}},300);}
function changed({audio=true,quantized=true}={}){persist();renderStudio();if(audio&&player.playing){clearTimeout(renderTimer);renderTimer=setTimeout(()=>player.update(clone(project),{quantized}).catch(e=>toast(e.message,true)),220);}}
function optionList(items,selectedValue){return items.map(([v,n])=>`<option value="${escape(v)}" ${String(selectedValue)===String(v)?'selected':''}>${escape(n)}</option>`).join('');}
$('root').innerHTML=optionList(ROOTS.map((n,i)=>[i,n]),project.config.root);
$('scale').innerHTML=optionList(Object.entries(SCALE_NAMES),project.config.scale);
$('algorithm').innerHTML=optionList(ALGORITHMS.map(a=>[a[0],`${a[1]} · ${a[2]}`]),project.config.algorithm);
const presetSelector=document.createElement('select');presetSelector.id='preset-selector';presetSelector.setAttribute('aria-label','Музыкальный стиль');presetSelector.innerHTML=optionList(Object.entries(PRESETS).map(([id,p])=>[id,p.name]),project.config.preset);$('preset-badge').replaceWith(presetSelector);
for(const id of ['piano-track','synth-track'])$(id).innerHTML=optionList(TRACKS.filter(t=>id==='synth-track'||!['kick','snare','hat'].includes(t.id)).map(t=>[t.id,t.name]),id==='synth-track'?synthTrack:pianoTrack);
$('automation-track').innerHTML=optionList(TRACKS.map(t=>[t.id,t.name]),automationTrack);
$('preset-list').innerHTML=Object.entries(PRESETS).map(([id,p])=>`<button class="preset" data-preset="${id}">${p.name}<small>${p.subtitle}</small></button>`).join('');
$('algorithm-grid').innerHTML=ALGORITHMS.map((a,i)=>`<button class="algo-card" data-algorithm="${a[0]}"><span class="algo-number">${String(i+1).padStart(2,'0')}</span><h3>${a[1]}</h3><code>${escape(a[2])}</code><p>${a[3]}</p></button>`).join('');
$('game-states').innerHTML=Object.entries(STATES).map(([id,s])=>`<button class="game-state" data-state="${id}">${s.name}<small>${s.intensity}% · ${s.intensity<40?'пространство':s.intensity<65?'пульсация':s.intensity<90?'ритм и бас':'все слои'}</small></button>`).join('');
function syncConfig(){for(const id of ['bpm','root','scale','bars','form','seed','intensity','algorithm','binary','density','swing','humanize','phrasing'])$(id).value=project.config[id];$('preset-selector').value=project.config.preset;$('master').value=project.config.master*100;$('progression').value=project.config.progression.map(n=>n+1).join(' ');for(const id of ['intensity','density','swing','humanize'])$(id+'-value').textContent=project.config[id]+'%';}
function renderStudio(){
  const c=project.config;bar=Math.min(bar,c.bars-1);
  const metric=assess(project);const duration=durationOf(project);
  $('composition-name').setAttribute('data-i18n-skip','');$('composition-name').textContent=(project.title==='Безымянная тема'?PRESETS[c.preset].name:project.title)+' · '+ROOTS[c.root]+' '+t(SCALE_NAMES[c.scale]).toLowerCase();
  $('duration-label').textContent=time(duration);$('transport-total').textContent='/ '+time(duration);$('transport-bpm').textContent=c.bpm+' BPM';
  $('event-count').textContent=metric.events+' активных событий';$('scale-score').textContent=metric.inScale+'% нот в гамме';
  $('bar-label').textContent=`ТАКТ ${String(bar+1).padStart(2,'0')} / ${c.bars}`;
  $('arrangement-bars').innerHTML=Array.from({length:c.bars},(_,i)=>{const section=sectionAt(c,i);return `<button class="arr-bar ${i===bar?'selected':''} ${section==='Вариация'?'variation':''} ${['Вступление','Финал'].includes(section)?'quiet':''}" data-bar="${i}" title="Такт ${i+1}: ${section}; ${chordAt(c,i).map(noteName).join(' / ')}">${String(i+1).padStart(2,'0')}<small>${c.progression[Math.floor(i/2)%c.progression.length]+1}</small></button>`;}).join('');
  $('chord-label').textContent=sectionAt(c,bar)+(c.phrasing==='expressive'?' · '+phraseAt(c,bar).name:'')+' · '+chordAt(c,bar).map(noteName).join(' / ');
  const fragmentSelect=$('fragment-start'),fragmentValue=fragmentSelect.value===''?Math.floor(bar/4)*4:Number(fragmentSelect.value);
  fragmentSelect.innerHTML=optionList(Array.from({length:c.bars/4},(_,i)=>[i*4,`${i*4+1}–${i*4+4}`]),Math.min(fragmentValue,c.bars-4));
  const stepEvents=project.events.filter(e=>e.bar===bar);const solo=project.tracks.some(t=>t.solo&&!t.mute);
  $('sequencer').innerHTML=`<div class="sequence-header"><span>ДОРОЖКА / ИНСТРУМЕНТ</span>${Array.from({length:16},(_,s)=>`<span>${s+1}</span>`).join('')}<span>ГРОМКОСТЬ</span></div>`+project.tracks.map(t=>{
    const disabled=t.mute||solo&&!t.solo;
    return `<div class="track-row" style="--track-color:${t.color}"><div class="track-info"><span class="track-dot" style="background:${t.color}"></span><button data-edit-track="${t.id}" title="Настроить ${t.name}">${t.name}<small>${t.instrument}</small></button><div class="track-toggles"><button data-mix="mute" data-track="${t.id}" class="${t.mute?'on':''}" aria-label="Mute ${t.name}" aria-pressed="${t.mute}">M</button><button data-mix="solo" data-track="${t.id}" class="${t.solo?'on':''}" aria-label="Solo ${t.name}" aria-pressed="${t.solo}">S</button><button data-mix="locked" data-track="${t.id}" class="${t.locked?'on':''}" aria-label="Защитить ${t.name}" aria-pressed="${t.locked}">◇</button></div></div>${Array.from({length:16},(_,s)=>{const e=stepEvents.filter(e=>e.track===t.id&&e.step===s);const active=e.some(e=>e.minIntensity<=c.intensity);return `<button data-step="${s}" data-track="${t.id}" aria-label="${t.name} шаг ${s+1}" aria-pressed="${e.length>0}" class="step ${s%4===0?'beat':''} ${e.length?'on':''} ${e.length&&(!active||disabled)?'inactive':''}" title="${t.name}: ${e.length?e.map(n=>noteName(n.note)).join(', '):'пауза'}"></button>`;}).join('')}<label class="track-mix"><input type="range" min="0" max="100" value="${Math.round(t.volume*100)}" data-volume="${t.id}" aria-label="Громкость ${t.name}"><span>${Math.round(t.volume*100)}</span></label></div>`;
  }).join('');
  $('formula-label').textContent=ALGORITHMS.find(a=>a[0]===c.algorithm)[2];$('motif-label').textContent=project.motif.join(' · ');
  document.querySelectorAll('[data-preset]').forEach(e=>e.classList.toggle('active',e.dataset.preset===c.preset));
  document.querySelectorAll('[data-algorithm]').forEach(e=>{e.classList.toggle('active',e.dataset.algorithm===c.algorithm);e.setAttribute('aria-pressed',String(e.dataset.algorithm===c.algorithm));});
  document.querySelectorAll('[data-state]').forEach(e=>{e.classList.toggle('active',e.dataset.state===currentState);e.setAttribute('aria-pressed',String(e.dataset.state===currentState));});
  renderPiano();
  renderAutomation();
}
function automationPoints(){const t=project.tracks.find(t=>t.id===automationTrack);t.automation??={volume:[],cutoff:[]};return t.automation[automationParam].length?t.automation[automationParam]:Array.from({length:project.config.bars},()=>automationParam==='volume'?1:18000);}
function autoPercent(v){return automationParam==='volume'?v*100:Math.log(v/60)/Math.log(300)*100;}
function autoValue(percent){return automationParam==='volume'?percent/100:60*300**(percent/100);}
function renderAutomation(){
  automationBar=Math.min(automationBar,project.config.bars-1);$('automation-bar').innerHTML=optionList(Array.from({length:project.config.bars},(_,i)=>[i,String(i+1).padStart(2,'0')]),automationBar);
  const points=automationPoints();const value=points[automationBar];$('automation-value').value=autoPercent(value);$('automation-output').textContent=automationParam==='volume'?Math.round(value*100)+'%':Math.round(value)+' Hz';
  const canvas=$('automation-canvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='#2d3a3d';ctx.lineWidth=1;const x=i=>20+i/points.length*(w-40),y=v=>h-22-autoPercent(v)/100*(h-40);
  ctx.font='10px Consolas';ctx.fillStyle='#667b82';ctx.beginPath();
  for(let i=0;i<points.length;i++){ctx.moveTo(x(i),14);ctx.lineTo(x(i),h-18);if(points.length<=16||i%2===0)ctx.fillText(String(i+1),x(i)-2,h-5);}ctx.stroke();
  ctx.strokeStyle='#c5f06e';ctx.lineWidth=2;ctx.beginPath();points.forEach((v,i)=>i===0?ctx.moveTo(x(i),y(v)):ctx.lineTo(x(i),y(v)));ctx.lineTo(w-20,y(project.config.form==='loop'?points[0]:points.at(-1)));ctx.stroke();
  points.forEach((v,i)=>{ctx.fillStyle=i===automationBar?'#e6ffbc':'#7d9e50';ctx.beginPath();ctx.arc(x(i),y(v),i===automationBar?4:2.5,0,Math.PI*2);ctx.fill();});
}
function editAutomation(percent){const t=project.tracks.find(t=>t.id===automationTrack);const points=automationPoints();t.automation[automationParam]=points.slice();t.automation[automationParam][automationBar]=autoValue(clamp(percent,0,100));renderAutomation();persist();}
function renderPiano(){
  const events=project.events.filter(e=>e.track===pianoTrack&&e.bar===bar);const anchor=pianoTrack==='bass'?36:pianoTrack==='pad'?60:pianoTrack==='bell'?84:72;
  const high=events.length?clamp(Math.max(...events.map(e=>e.note))+2,11,127):anchor+5;
  const low=events.length?clamp(Math.min(high-11,Math.min(...events.map(e=>e.note))-2),0,115):anchor-6;
  const rows=[];for(let note=high;note>=low;note--){rows.push(`<div class="piano-row"><span class="piano-key ${[1,3,6,8,10].includes(note%12)?'black':''}">${noteName(note)}</span>${Array.from({length:16},(_,s)=>{const event=events.find(e=>e.note===note&&e.step===s);return `<button class="piano-cell ${s%4===0?'beat':''} ${event?'note':''} ${event?.id===selected?'selected':''} ${event&&event.minIntensity>project.config.intensity?'inactive':''}" data-note="${note}" data-piano-step="${s}" aria-label="${noteName(note)} шаг ${s+1}" title="${noteName(note)}, шаг ${s+1}" ${event?`style="--note-width:${Math.min(800,event.duration/(60/project.config.bpm/4)*100)}%"`:''}></button>`;}).join('')}</div>`);}
  $('piano-roll').innerHTML=rows.join('');
  const event=project.events.find(e=>e.id===selected);
  $('note-label').textContent=event?`${noteName(event.note)} · шаг ${event.step+1} · ${Math.round(event.velocity*100)}%`:'Клик по сетке добавляет ноту';
  if(event){const length=event.duration/(60/project.config.bpm/4);const options=[.5,1,2,4,8];$('note-length').value=options.reduce((a,b)=>Math.abs(b-length)<Math.abs(a-length)?b:a);$('note-velocity').value=event.velocity*100;}
  $('delete-note').disabled=!event;
}
function addNote(track,step,note=null){
  const degree=project.config.progression[Math.floor(bar/2)%project.config.progression.length];
  const midiNote=note??(['kick','snare','hat'].includes(track)?{kick:36,snare:38,hat:42}[track]:degreeNote(degree,project.config.root,project.config.scale,track==='bass'?1:track==='pad'?3:4));
  const event={id:'edit-'+crypto.randomUUID(),track,bar,step,note:midiNote,time:(bar*16+step)*60/project.config.bpm/4,duration:Number($('note-length').value)*60/project.config.bpm/4,velocity:Number($('note-velocity').value)/100,minIntensity:0};
  project.events.push(event);project.events.sort((a,b)=>a.time-b.time);return event;
}
function regenerate(only=null){remember();if(only==='melody')project.config.melodyRevision++;if(only==='drums')project.config.drumRevision++;project=generate(project.config,project,only);selected=null;changed();toast(only==='melody'?'Мелодия обновлена. Остальные дорожки сохранены.':only==='drums'?'Ударные обновлены. Остальные дорожки сохранены.':'Композиция создана. Нажмите ▶ для прослушивания.');}
async function selectPreset(id){
  player.stop();remember();const p=PRESETS[id];const c={...clone(project.config),preset:id,bpm:p.bpm,root:p.root,scale:p.scale,intensity:p.intensity,algorithm:p.algorithm,progression:p.progression};
  const previous=clone(project);previous.tracks=previous.tracks.map(t=>t.locked?t:createTracks(id).find(n=>n.id===t.id));
  project=generate(c,previous);currentState=closestState(p.intensity);selected=null;syncConfig();renderSynth();changed();toast(p.name+' — новая аранжировка с текущим seed');
}
function closestState(value){return Object.keys(STATES).reduce((a,b)=>Math.abs(STATES[a].intensity-value)<Math.abs(STATES[b].intensity-value)?a:b);}
function setView(name){if(demoOriginal&&name!=='director')stopDemo();if(view==='variants'&&name!=='variants'&&previewVariant!==null){player.stop();previewVariant=null;}view=name;document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!=='view-'+name);document.querySelectorAll('.nav').forEach(e=>e.classList.toggle('active',e.dataset.view===name));const titles={variants:['Варианты темы','Выберите тему на слух.','Три варианта одной идеи. Сравните, сохраните и продолжите редактирование.'],intent:['Музыка по описанию','Сначала — настроение. Затем — музыка.','Встроенная нейросеть превращает ваши слова в управляемую музыкальную схему.'],studio:['Композитор','Сочините свой игровой мир.','Один мотив. Тысячи вариаций. Полный контроль над звуком.'],lab:['Лаборатория','У музыки есть формула.','18 алгоритмов. Гармоническая опора. Воспроизводимый результат.'],synth:['Синтезаторы','Придайте теме свой голос.','33 тембра из девяти семейств синтеза. Ни одного готового сэмпла.'],director:['Игровой дирижёр','Музыка следует за игрой.','Синхронные состояния, музыкальные события и готовый API.'],projects:['Проекты и экспорт','От идеи — к игровому треку.','Сохраните тему, откройте её в DAW или заберите отдельные слои.']}[name];$('view-title').textContent=titles[0];$('page-title').textContent=titles[1];$('page-description').textContent=titles[2];if(name==='synth')renderSynth();if(name==='projects')renderLibrary();if(name==='variants')renderVariants();}
function log(message){const node=document.createElement('div');node.textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+'  '+message;$('event-log').prepend(node);while($('event-log').children.length>30)$('event-log').lastElementChild.remove();}
async function setIntensity(value){if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Intensity: число 0–100');remember();project.config.intensity=clamp(Math.round(value),0,100);currentState=closestState(project.config.intensity);syncConfig();changed({audio:false});if(player.playing)await player.update(clone(project));log('Интенсивность → '+project.config.intensity+'%');}
async function setState(id){if(!STATES[id])throw new Error('Неизвестное игровое состояние');await setIntensity(STATES[id].intensity);currentState=id;renderStudio();$('director-status').textContent=player.pending?'Переход по такту':STATES[id].name;log('Состояние → '+STATES[id].name);}
async function trigger(type){if(!['safe','hit','victory'].includes(type))throw new Error('Событие: safe, hit или victory');const c=project.config;const notes=type==='victory'?[0,2,4,7].map(n=>degreeNote(n,c.root,c.scale,4)):type==='hit'?[degreeNote(0,c.root,c.scale,1),degreeNote(1,c.root,c.scale,1)]:[degreeNote(0,c.root,c.scale,5)];await player.sting(notes,type);log({safe:'Безопасный ход · колокол',hit:'Попадание · низкий удар',victory:'Победа · разрешение темы'}[type]);if(type==='hit'&&$('auto-director').checked)await setState('combat');if(type==='victory')await setState('exploration');}
let directorTimer;
function updateGame(input){
  for(const k of ['risk','health'])if(input[k]!==undefined&&(typeof input[k]!=='number'||!Number.isFinite(input[k])||input[k]<0||input[k]>1))throw new Error(k+': число 0–1');
  if(input.enemies!==undefined&&(!Number.isInteger(input.enemies)||input.enemies<0||input.enemies>20))throw new Error('enemies: целое 0–20');
  if(input.risk!==undefined)$('risk').value=input.risk*100;if(input.health!==undefined)$('health').value=input.health*100;if(input.enemies!==undefined)$('enemies').value=input.enemies;
  $('risk-value').textContent=$('risk').value+'%';$('health-value').textContent=$('health').value+'%';
  const danger=clamp(Number($('risk').value)*.7+(100-Number($('health').value))*.18+Number($('enemies').value)*5,0,100);
  const state=danger>=82?'boss':danger>=58?'combat':danger>=30?'tension':'exploration';
  clearTimeout(directorTimer);directorTimer=setTimeout(()=>{if(state!==currentState)setState(state).catch(e=>toast(e.message,true));},350);
  return {state,danger};
}
const types={kick:'Синус с падением частоты и коротким шумовым импульсом.',noise:'Детерминированный шум, фильтрация и ударная огибающая.',subtractive:'Осцилляторы с подавлением алиасинга PolyBLEP. Расстройка измеряется в герцах.',additive:'Сумма гармоник с разными амплитудами. Ультразвуковые гармоники исключаются.',fm:'Частотная модуляция: синусоидальная несущая и модулятор с заданным отношением частот.',wavetable:'Морфинг гармонических форм волн; Motion медленно меняет спектр.',granular:'Перекрывающиеся синтетические зерна с оконной огибающей и расстройкой.',physical:'Karplus–Strong: шум возбуждает короткую петлю обратной связи с затуханием.',shepard:'Четыре падающих октавных компонента с плавным изменением амплитуд.'};
const patchParameters=[['volume','Громкость',0,1,.01,'%'],['pan','Панорама',-1,1,.01,''],['cutoff','Частота фильтра',60,18000,10,'Hz'],['attack','Attack',.001,2,.001,'s'],['decay','Decay',.01,2,.01,'s'],['sustain','Sustain',0,1,.01,'%'],['release','Release',.01,3,.01,'s'],['drive','Saturation',0,1,.01,'%'],['delay','Delay',0,.6,.01,'%'],['reverb','Reverb',0,.7,.01,'%']];
function renderSynth(){
  const track=project.tracks.find(t=>t.id===synthTrack);const patch=INSTRUMENTS[track.instrument];$('synth-track').value=synthTrack;
  $('instrument-grid').innerHTML=Object.entries(INSTRUMENTS).map(([name,p])=>`<button class="instrument ${name===track.instrument?'active':''}" data-instrument="${name}">${name}<small>${p.type}</small></button>`).join('');
  $('patch-name').textContent=track.name+' / '+track.instrument;$('patch-description').textContent=types[patch.type];
  const parameters=patchParameters.filter(p=>!['kick','noise'].includes(patch.type)||p[0]!=='sustain');if(patch.type==='fm')parameters.push(['fmIndex','FM index',0,10,.1,''],['fmRatio','FM ratio',.25,8,.01,'']);if(patch.type==='subtractive')parameters.push(['detune','Расстройка',0,12,.1,'Hz']);if(patch.type==='wavetable')parameters.push(['morph','Морфинг',0,1,.01,'%']);if(patch.type==='granular')parameters.push(['grainDensity','Зёрен в секунду',2,16,1,'']);
  $('patch-controls').className='patch-controls';$('patch-controls').innerHTML=`<label>Фильтр <select id="filter-type"><option value="lowpass" ${track.filterType==='lowpass'?'selected':''}>Low-pass</option><option value="highpass" ${track.filterType==='highpass'?'selected':''}>High-pass</option></select></label>`+parameters.map(([id,name,min,max,step,unit])=>`<label>${name}<output data-patch-output="${id}">${patchValue(track[id],unit)}</output><input data-patch="${id}" data-unit="${unit}" aria-label="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${track[id]}"></label>`).join('');
  drawEnvelope();
}
function patchValue(v,unit){return unit==='%'?Math.round(v*100)+'%':unit==='s'?v.toFixed(2)+' s':unit==='Hz'?Math.round(v)+' Hz':v.toFixed(1);}
function drawEnvelope(){const canvas=$('envelope'),ctx=canvas.getContext('2d'),t=project.tracks.find(t=>t.id===synthTrack);const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);const total=t.attack+t.decay+.45+t.release;const x=s=>15+s/total*(w-30),y=v=>h-18-v*(h-32);ctx.strokeStyle='#475948';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(15,h-18);ctx.lineTo(w-15,h-18);ctx.stroke();ctx.strokeStyle='#c5f06e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(0),y(0));ctx.lineTo(x(t.attack),y(1));ctx.lineTo(x(t.attack+t.decay),y(t.sustain));ctx.lineTo(x(t.attack+t.decay+.45),y(t.sustain));ctx.lineTo(x(total),y(0));ctx.stroke();}
function download(bytes,name,type){const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const sdkSource=`// GenMuza browser bridge. Embed the studio at the SAME origin; targetOrigin must be explicit.
export class GenMuzaBridge {
  constructor(iframe, targetOrigin) { this.target = iframe.contentWindow; this.origin = targetOrigin; }
  send(action, value) { this.target.postMessage({ type: 'genmuza', action, value }, this.origin); }
  setState(state) { this.send('state', state); }
  setIntensity(value) { this.send('intensity', value); }
  updateGame(value) { this.send('game', value); }
  trigger(event) { this.send('event', event); }
}
`;
const kitInstructions=`ГенМуза Game Kit
Содержимое: mix.wav, stems/*.wav, composition.mid, project.json, genmuza-bridge.mjs.
Все WAV: stereo PCM16, 44100 Hz. Длина соответствует BPM и числу тактов.
Stems включают текущие инструменты, эффекты и интенсивность. Для всех слоёв выберите 100% перед экспортом.
Для синхронных Exploration/Combat экспортируйте несколько комплектов при разных intensity.
Unity: загрузите WAV как Decompress On Load, запустите AudioSource.PlayScheduled с одним AudioSettings.dspTime для всех stems. loop=true; меняйте volume слоёв на границе такта с коротким fade. Disable Normalize в импортере, чтобы сохранить баланс.
Godot: импорт WAV Loop Mode Forward, запустите AudioStreamPlayer для stems одновременно; используйте AudioServer.get_time_since_last_mix и get_output_latency для музыкальной позиции; менять volume_db слоёв по тактам.
MIDI передаёт ноты, velocity, темп и приблизительные GM-программы, не наши синтезаторы.
Браузер: window.GenMuza.play/setState/setIntensity/trigger/updateGame; genmuza-bridge.mjs для iframe того же origin. После загрузки нужен пользовательский клик для AudioContext.
Защита от клиппинга применяется к mix; при суммировании stems обеспечьте headroom.
`;
const kitInstructionsEN=`GenMuza Game Kit
Contents: mix.wav, stems/*.wav, composition.mid, project.json, genmuza-bridge.mjs.
All WAV files: stereo PCM16, 44100 Hz. Duration follows the BPM and bar count.
Stems include the current instruments, effects and intensity. Select 100% intensity before exporting all layers.
For synchronized Exploration/Combat versions, export several kits at different intensities.
Unity: import WAV as Decompress On Load. Start AudioSource.PlayScheduled using the same AudioSettings.dspTime for all stems. Enable loop; change layer volume at bar boundaries with a short fade. Disable Normalize on import to preserve the balance.
Godot: import WAV with Loop Mode Forward. Start stem AudioStreamPlayers together; use AudioServer.get_time_since_last_mix and get_output_latency to estimate musical position. Change layer volume_db at bar boundaries.
MIDI carries notes, velocity, tempo and approximate GM programs, rather than the studio's synthesizers.
Browser: window.GenMuza.play/setState/setIntensity/trigger/updateGame; use genmuza-bridge.mjs for a same-origin iframe. AudioContext needs a user click after loading.
Clipping protection applies to the mix; allow headroom when summing stems.
`;
async function exportProject(format){
  if(busyExport)return;const snapshot=clone(project);const filename='genmuza-'+snapshot.config.seed.replace(/[^a-zA-Z0-9_-]/g,'_');
  if(format==='json'){download(projectJSON(snapshot),filename+'.json','application/json');toast('Проект сохранён в JSON');return;}
  if(format==='midi'){download(midi(snapshot),filename+'.mid','audio/midi');toast('MIDI экспортирован: 7 дорожек и tempo map');return;}
  busyExport=true;document.querySelectorAll('[data-export]').forEach(e=>e.disabled=true);$('export-progress').textContent='Рендер 44.1 kHz… Интерфейс остаётся доступен.';toast('Готовлю аудио для экспорта…');
  try{
    const ignoreMix=$('export-ignore-mix').checked;
    const audio=await renderer.render(snapshot,{sampleRate:44100,ignoreMix});
    if(format==='wav')download(wav(audio),filename+'.wav','audio/wav');
    else{
      $('export-progress').textContent='Упаковка 7 дорожек…';
      const files=[['mix.wav',wav(audio)],['composition.mid',midi(ignoreMix?{...snapshot,tracks:snapshot.tracks.map(t=>({...t,mute:false,solo:false}))}:snapshot)],['project.json',projectJSON(snapshot)],['genmuza-bridge.mjs',sdkSource],['README.txt',getLanguage()==='en'?kitInstructionsEN:kitInstructions]];
      for(const stem of audio.stems)files.push(['stems/'+stem.track+'.wav',wav(stem)]);
      download(zip(files),filename+'-game-kit.zip','application/zip');
    }
    $('export-progress').textContent=`Готово · ${time(audio.duration)} · peak ${(20*Math.log10(Math.max(.000001,audio.peak))).toFixed(1)} dBFS`;
    toast(format==='wav'?'WAV готов: stereo PCM16, 44.1 kHz':'Game Kit готов: WAV, 7 stems, MIDI, JSON и SDK');
  }finally{busyExport=false;document.querySelectorAll('[data-export]').forEach(e=>e.disabled=false);}
}
function library(){try{return readLibrary(JSON.parse(localStorage.getItem('genmuza-library')||'[]'));}catch{return [];}}
function saveProject(snapshot=project,favorite=false){
  try{const items=storeProject(library(),snapshot,{favorite,id:crypto.randomUUID(),savedAt:new Date().toISOString()});localStorage.setItem('genmuza-library',JSON.stringify(items));renderLibrary();renderVariants();toast(favorite?'Тема сохранена в избранном':'Проект сохранён в библиотеке браузера');}
  catch(error){download(projectJSON(snapshot),'genmuza-backup.json','application/json');toast(error.message||'Хранилище заполнено. Скачана резервная копия JSON.',true);}
}
function openProject(value){stopDemo();player.stop();previewVariant=null;remember();project=validateProject(value);selected=null;bar=0;currentState=closestState(project.config.intensity);syncConfig();renderSynth();changed({audio:false});setView('studio');}
function renderLibrary(){
  const items=library().filter(item=>!$('favorites-only').checked||item.favorite);$('project-list').innerHTML=items.length?'':'<div class="empty-library">Здесь появятся сохранённые темы. Отметьте ★, чтобы добавить тему в избранное.</div>';
  for(const item of items){const row=document.createElement('div');row.className='project-row';const info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');name.setAttribute('data-i18n-skip','');name.textContent=item.project.title==='Безымянная тема'?PRESETS[item.project.config.preset]?.name||'Проект':item.project.title;meta.innerHTML=`${item.project.config.bpm} BPM · ${item.project.config.bars} тактов · <span data-i18n-skip>${escape(item.project.config.seed)}</span>`;info.append(name,meta);
    const star=document.createElement('button');star.className='favorite-button';star.textContent=item.favorite?'★':'☆';star.setAttribute('aria-label','Избранное: '+name.textContent);star.setAttribute('aria-pressed',String(item.favorite));star.onclick=run(()=>{const records=library();const match=records.find(i=>i.id===item.id);match.favorite=!match.favorite;localStorage.setItem('genmuza-library',JSON.stringify(records));renderLibrary();renderVariants();});
    const open=document.createElement('button');open.className='subtle';open.textContent='Открыть';open.onclick=run(()=>openProject(item.project));const backup=document.createElement('button');backup.className='text-btn';backup.textContent='JSON';backup.onclick=()=>download(projectJSON(item.project),'genmuza-project.json','application/json');row.append(star,info,open,backup);$('project-list').append(row);
  }
}
function renderVariants(){
  const saved=new Set(library().filter(item=>item.favorite).map(item=>projectKey(item.project)));
  $('variant-list').innerHTML=variants.length?variants.map((p,i)=>`<article class="panel variant-card"><div class="variant-letter">${String.fromCharCode(65+i)}</div><h2 data-i18n-skip>${escape(p.title)}</h2><p>${p.config.bpm} BPM · ${p.config.bars} тактов · ${escape(SCALE_NAMES[p.config.scale])}</p><div class="variant-notes" aria-hidden="true">${p.events.filter(e=>e.track==='lead'&&e.bar<4).slice(0,36).map(e=>`<span style="height:${20+(e.note%24)*2}px"></span>`).join('')}</div><small class="mono" data-i18n-skip>${escape(p.config.seed)}</small><div class="variant-actions"><button class="primary small" data-variant-play="${i}" aria-label="Прослушать вариант ${String.fromCharCode(65+i)}">▶ Прослушать</button><button class="subtle small" data-variant-use="${i}">Редактировать</button><button class="favorite-button" data-variant-favorite="${i}" aria-label="Сохранить вариант ${String.fromCharCode(65+i)} в избранное" aria-pressed="${saved.has(projectKey(p))}">${saved.has(projectKey(p))?'★':'☆'}</button></div></article>`).join(''):'<div class="empty-library">Нажмите «Создать 3 варианта». Текущая композиция останется в композиторе.</div>';
}
function buildVariants(){stopDemo();player.stop();previewVariant=null;variants=createVariants(project,3,++variantRound);try{localStorage.setItem('genmuza-variants',JSON.stringify({round:variantRound,projects:variants}));}catch{toast('Варианты доступны до закрытия страницы. Сохраните понравившийся в JSON.',true);}renderVariants();setView('variants');}
function stopDemo(){demoRun++;demoTimers.forEach(clearTimeout);demoTimers=[];if(!demoOriginal)return;player.stop();project=demoOriginal;demoOriginal=null;currentState=closestState(project.config.intensity);syncConfig();changed({audio:false});$('director-status').textContent=STATES[currentState].name;$('demo-status').textContent='Демо остановлено. Ваша композиция восстановлена.';$('demo-stop').hidden=true;$('demo-start').disabled=false;}
async function startDemo(){
  stopDemo();player.stop();previewVariant=null;setView('director');demoOriginal=clone(project);const token=++demoRun;project=generate({...clone(DEFAULT_CONFIG),bars:16,intensity:25,seed:'GENMUZA-DEMO-2026',phrasing:'expressive'});currentState='exploration';syncConfig();renderStudio();$('demo-start').disabled=true;$('demo-stop').hidden=false;$('demo-status').textContent='Исследование → бой → босс · 24 секунды';
  try{await player.play(clone(project));if(token!==demoRun)return;
    const transition=async id=>{if(token!==demoRun)return;project.config.intensity=STATES[id].intensity;currentState=id;syncConfig();renderStudio();$('demo-status').textContent=STATES[id].name+' · та же тема, новые слои';await player.update(clone(project));};
    demoTimers=[setTimeout(run(()=>transition('combat')),6000),setTimeout(run(()=>transition('boss')),14000),setTimeout(()=>{if(token===demoRun){stopDemo();$('demo-status').textContent='Демо завершено. Попробуйте свою тему или сравните три варианта.';}},24000)];
  }catch(error){if(token===demoRun)stopDemo();throw error;}
}
try{const saved=JSON.parse(localStorage.getItem('genmuza-variants')||'null');if(saved&&Array.isArray(saved.projects)){variants=saved.projects.slice(0,3).map(validateProject);variantRound=Number.isInteger(saved.round)?saved.round:0;}}catch{}
document.addEventListener('click',run(async e=>{
  const target=e.target.closest('button');if(!target)return;
  if(target.dataset.view)setView(target.dataset.view);
  if(target.dataset.variantPlay!==undefined){stopDemo();const index=Number(target.dataset.variantPlay);previewVariant=index;await player.play(clone(variants[index]));renderVariants();}
  if(target.dataset.variantUse!==undefined)openProject(variants[Number(target.dataset.variantUse)]);
  if(target.dataset.variantFavorite!==undefined){const value=variants[Number(target.dataset.variantFavorite)],records=library(),match=records.find(item=>projectKey(item.project)===projectKey(value));if(match?.favorite){match.favorite=false;localStorage.setItem('genmuza-library',JSON.stringify(records));renderLibrary();renderVariants();}else saveProject(value,true);}
  if(target.dataset.preset)await selectPreset(target.dataset.preset);
  if(target.dataset.bar!==undefined){bar=Number(target.dataset.bar);selected=null;follow=false;$('follow').classList.remove('active');$('follow').setAttribute('aria-pressed','false');renderStudio();}
  if(target.dataset.step!==undefined){remember();const step=Number(target.dataset.step),track=target.dataset.track;const found=project.events.some(n=>n.bar===bar&&n.step===step&&n.track===track);if(found)project.events=project.events.filter(n=>!(n.bar===bar&&n.step===step&&n.track===track));else selected=addNote(track,step).id;changed();}
  if(target.dataset.pianoStep!==undefined){const step=Number(target.dataset.pianoStep),note=Number(target.dataset.note);const found=project.events.find(n=>n.track===pianoTrack&&n.bar===bar&&n.step===step&&n.note===note);if(found){selected=found.id;renderPiano();}else{remember();selected=addNote(pianoTrack,step,note).id;changed();}}
  if(target.dataset.mix){remember();const t=project.tracks.find(t=>t.id===target.dataset.track);t[target.dataset.mix]=!t[target.dataset.mix];changed({audio:target.dataset.mix!=='locked'});}
  if(target.dataset.editTrack){synthTrack=target.dataset.editTrack;setView('synth');}
  if(target.dataset.algorithm){remember();project.config.algorithm=target.dataset.algorithm;project=generate(project.config,project);syncConfig();changed();toast('Алгоритм применён: '+ALGORITHMS.find(a=>a[0]===target.dataset.algorithm)[1]);}
  if(target.dataset.instrument){remember();const t=project.tracks.find(t=>t.id===synthTrack),p=INSTRUMENTS[target.dataset.instrument];t.instrument=target.dataset.instrument;t.detune=p.detune||0;t.fmIndex=p.index||2.5;t.fmRatio=p.ratio||2;t.morph=p.morph??.5;t.grainDensity=p.grains||6;renderSynth();changed();}
  if(target.dataset.state){stopDemo();await setState(target.dataset.state);}
  if(target.dataset.event){stopDemo();await trigger(target.dataset.event);}
  if(target.dataset.export)await exportProject(target.dataset.export);
}));
for(const id of ['bpm','root','scale','bars','form','seed','algorithm','binary','density','swing','humanize','progression','phrasing'])$(id).addEventListener('change',run(()=>{
  const before=clone(project);try{
    const value=id==='progression'?$('progression').value.trim().split(/[\s,;]+/).map(n=>Number(n)-1):['bpm','root','bars','density','swing','humanize'].includes(id)?Number($(id).value):$(id).value;
    const next={...project.config,[id]:value};if(id==='scale')next.progression=next.progression.map(n=>n%SCALES[next.scale].length);
    const newProject=generate(next,project);if(['bpm','bars','form'].includes(id))player.stop();remember();project=newProject;selected=null;syncConfig();changed();
  }catch(error){project=before;syncConfig();throw error;}
}));
for(const id of ['density','swing','humanize'])$(id).addEventListener('input',()=>$(id+'-value').textContent=$(id).value+'%');
let intensityStart=null;$('intensity').addEventListener('pointerdown',()=>intensityStart=clone(project));
$('intensity').addEventListener('input',()=>{$('intensity-value').textContent=$('intensity').value+'%';});
$('intensity').addEventListener('change',run(()=>setIntensity(Number($('intensity').value))));
$('preset-selector').addEventListener('change',run(e=>selectPreset(e.target.value)));
$('master').addEventListener('input',()=>{project.config.master=Number($('master').value)/100;const previous=player.project?.config.master||.8;player.setMaster(project.config.master/previous);persist();});
// Store an undo snapshot on focus, rather than filling history on each range event.
document.addEventListener('focusin',e=>{if(e.target.dataset.volume||e.target.dataset.patch)remember();});
document.addEventListener('input',e=>{
  if(e.target.dataset.volume){const t=project.tracks.find(t=>t.id===e.target.dataset.volume);t.volume=Number(e.target.value)/100;e.target.nextElementSibling.textContent=e.target.value;persist();if(player.playing){clearTimeout(renderTimer);renderTimer=setTimeout(()=>player.update(clone(project)).catch(e=>toast(e.message,true)),300);}}
  if(e.target.dataset.patch){const t=project.tracks.find(t=>t.id===synthTrack);t[e.target.dataset.patch]=Number(e.target.value);document.querySelector(`[data-patch-output="${e.target.dataset.patch}"]`).textContent=patchValue(Number(e.target.value),e.target.dataset.unit);drawEnvelope();persist();if(player.playing){clearTimeout(renderTimer);renderTimer=setTimeout(()=>player.update(clone(project)).catch(e=>toast(e.message,true)),300);}}
});
document.addEventListener('change',e=>{if(e.target.id==='filter-type'){remember();project.tracks.find(t=>t.id===synthTrack).filterType=e.target.value;changed();}});
$('piano-track').addEventListener('change',e=>{pianoTrack=e.target.value;selected=null;renderPiano();});$('synth-track').addEventListener('change',e=>{synthTrack=e.target.value;renderSynth();});
$('automation-track').onchange=e=>{automationTrack=e.target.value;renderAutomation();};$('automation-param').onchange=e=>{automationParam=e.target.value;renderAutomation();};$('automation-bar').onchange=e=>{automationBar=Number(e.target.value);renderAutomation();};
$('automation-value').onfocus=remember;$('automation-value').oninput=e=>editAutomation(Number(e.target.value));$('automation-value').onchange=()=>changed();
$('reset-automation').onclick=()=>{remember();project.tracks.find(t=>t.id===automationTrack).automation[automationParam]=[];changed();};
function automationFromPointer(e){const rect=$('automation-canvas').getBoundingClientRect();automationBar=clamp(Math.floor((e.clientX-rect.left)/rect.width*project.config.bars),0,project.config.bars-1);const relative=(e.clientY-rect.top)/rect.height;editAutomation((98-relative*120)/80*100);}
$('automation-canvas').onpointerdown=e=>{remember();$('automation-canvas').setPointerCapture(e.pointerId);automationFromPointer(e);};$('automation-canvas').onpointermove=e=>{if(e.buttons===1)automationFromPointer(e);};$('automation-canvas').onpointerup=()=>changed();
for(const id of ['note-length','note-velocity'])$(id).addEventListener('change',()=>{const event=project.events.find(e=>e.id===selected);if(!event)return;remember();if(id==='note-length')event.duration=Number($('note-length').value)*60/project.config.bpm/4;else event.velocity=Number($('note-velocity').value)/100;changed();});
$('delete-note').onclick=()=>{if(!selected)return;remember();project.events=project.events.filter(e=>e.id!==selected);selected=null;changed();};
$('generate').onclick=run(()=>regenerate());$('regenerate-melody').onclick=run(()=>regenerate('melody'));$('regenerate-drums').onclick=run(()=>regenerate('drums'));
$('new-seed').onclick=run(()=>{remember();project.config.seed='MUZA-'+crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();project.config.melodyRevision=0;project.config.drumRevision=0;project=generate(project.config,project);syncConfig();changed();});
$('play').onclick=run(async()=>{if(demoOriginal){stopDemo();return;}if(player.playing)player.stop();else{const playingProject=previewVariant!==null?variants[previewVariant]:project;await player.play(clone(playingProject));player.setMaster(1);}});$('stop').onclick=()=>{stopDemo();player.stop();};
$('loop').onclick=()=>{player.setLoop(!player.loop);$('loop').classList.toggle('active',player.loop);$('loop').setAttribute('aria-pressed',String(player.loop));};
$('follow').onclick=()=>{follow=!follow;$('follow').classList.toggle('active',follow);$('follow').setAttribute('aria-pressed',String(follow));};
$('undo').onclick=()=>{if(!history.length)return;player.stop();project=history.pop();selected=null;syncConfig();renderSynth();changed({audio:false});$('undo').disabled=!history.length;toast('Последнее изменение отменено');};$('undo').disabled=true;
$('save-project').onclick=()=>saveProject();$('export-top').onclick=()=>setView('projects');$('import-project').onclick=()=>$('file-input').click();
$('create-variants').onclick=run(buildVariants);$('compare-current').onclick=run(buildVariants);$('favorites-only').onchange=renderLibrary;
$('favorite-current').onclick=()=>saveProject(project,true);$('save-fragment').onclick=run(()=>saveProject(extractFragment(project,Number($('fragment-start').value)),true));
$('demo-start').onclick=run(startDemo);$('demo-stop').onclick=stopDemo;$('intro-demo').onclick=run(startDemo);
$('file-input').addEventListener('change',run(async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>8e6)throw new Error('Размер проекта превышает 8 МБ');const imported=validateProject(JSON.parse(await file.text()));player.stop();remember();project=imported;bar=0;selected=null;syncConfig();changed({audio:false});renderSynth();setView('studio');toast('Импорт завершён: ноты и тембры восстановлены');}finally{e.target.value='';}}));
$('new-project').onclick=run(()=>{saveProject();player.stop();remember();project=generate(clone(DEFAULT_CONFIG));bar=0;selected=null;syncConfig();changed({audio:false});renderSynth();setView('studio');});
$('rename').onclick=()=>{const name=window.prompt(t('Название композиции'),project.title);if(name?.trim()){remember();project.title=name.trim().slice(0,100);changed({audio:false});}};
$('audition').onclick=run(async()=>{await player.init();const t=project.tracks.find(t=>t.id===synthTrack);const c={...clone(project.config),bars:4,bpm:200,intensity:100,master:.7,form:'song'};const preview={...clone(project),config:c,events:[{id:'audition',track:t.id,bar:0,step:0,time:0,note:['kick','snare','hat'].includes(t.id)?{kick:36,snare:38,hat:42}[t.id]:degreeNote(0,c.root,c.scale,t.id==='bass'?2:4),duration:.75,velocity:.8,minIntensity:0}],tracks:project.tracks.map(p=>({...p,mute:p.id!==t.id,solo:false}))};$('audition').disabled=true;try{const audio=await renderer.render(preview,{sampleRate:22050});const buffer=player.context.createBuffer(2,audio.left.length,audio.sampleRate);buffer.copyToChannel(audio.left,0);buffer.copyToChannel(audio.right,1);const source=player.context.createBufferSource();source.buffer=buffer;source.connect(player.compressor);source.start();source.onended=()=>source.disconnect();}finally{$('audition').disabled=false;}});
for(const id of ['risk','health','enemies'])$(id).addEventListener('input',run(()=>{ $('risk-value').textContent=$('risk').value+'%';$('health-value').textContent=$('health').value+'%';if($('auto-director').checked)updateGame({risk:Number($('risk').value)/100,health:Number($('health').value)/100,enemies:Number($('enemies').value)});}));
$('auto-director').onchange=run(()=>{if($('auto-director').checked)updateGame({risk:Number($('risk').value)/100,health:Number($('health').value)/100,enemies:Number($('enemies').value)});});
$('copy-api').onclick=run(async()=>{await navigator.clipboard.writeText("await GenMuza.play();\nawait GenMuza.setState('combat');\nawait GenMuza.setIntensity(85);\nawait GenMuza.trigger('victory');\nGenMuza.updateGame({ risk: 0.7, health: 0.4, enemies: 6 });");toast('Пример API скопирован');});
$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable||$('help-dialog').open)return;if(e.code==='Space'){e.preventDefault();$('play').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click();}});
window.GenMuza=Object.freeze({version:'1.2.0',play:()=>player.play(clone(project)),stop:()=>{stopDemo();player.stop();},setState,setIntensity,trigger,updateGame,getProject:()=>clone(project),loadProject:openProject,exportProject});
// The bridge only accepts messages from the embedding parent at the same origin.
window.addEventListener('message',run(async e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='genmuza')return;const {action,value}=e.data;if(action==='state')await setState(value);if(action==='intensity')await setIntensity(value);if(action==='event')await trigger(value);if(action==='game')updateGame(value);}));
let lastStep=-1,lastBar=-1;const waveData=new Uint8Array(1024);
function animate(){
  const position=player.position();$('play-time').textContent=time(position);$('play-progress').style.width=(player.playing?position/durationOf(project)*100:0)+'%';
  const step=Math.floor(position/(60/project.config.bpm/4))%16,currentBar=Math.floor(position/(240/project.config.bpm))%project.config.bars;
  if(player.playing&&follow&&currentBar!==lastBar){bar=currentBar;renderStudio();lastBar=currentBar;lastStep=-1;}
  if(step!==lastStep||!player.playing){document.querySelectorAll('.step.current').forEach(e=>e.classList.remove('current'));if(player.playing&&bar===currentBar)document.querySelectorAll(`[data-step="${step}"]`).forEach(e=>e.classList.add('current'));lastStep=step;}
  const canvas=$('scope'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#273639';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=canvas.width;x+=30){ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);}ctx.moveTo(0,canvas.height/2);ctx.lineTo(canvas.width,canvas.height/2);ctx.stroke();
  if(player.analyser)player.analyser.getByteTimeDomainData(waveData);
  ctx.strokeStyle=player.playing?'#c5f06e':'#53664a';ctx.lineWidth=1.5;ctx.beginPath();for(let x=0;x<canvas.width;x++){const sample=player.playing?(waveData[Math.floor(x/canvas.width*waveData.length)]-128)/128:Math.sin(x*.075)*Math.sin(x*.014)*.08;const y=canvas.height/2+sample*canvas.height*.45;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();requestAnimationFrame(animate);
}
const intentExamples={forest:'Ночной лес. Спокойно, немного таинственно. 80 BPM, без ударных, мягкие колокольчики и тёплая подложка.',boss:'Финальная битва с огромным механическим боссом. 140 BPM, мощный бас, тревожная мелодия, плотные ударные. На ощущение опасности, но с надеждой.',space:'Одинокий корабль дрейфует в космосе. Медленная, светлая и воздушная музыка, редкие ноты, без ударных. 70 BPM.'};
$('plan-root').innerHTML=optionList(ROOTS.map((n,i)=>[i,n]),0);$('plan-scale').innerHTML=optionList(Object.entries(SCALE_NAMES),'minor');
function showIntentPlan(plan){
  intentPlan=plan;$('intent-empty').hidden=true;$('intent-plan').hidden=false;
  $('intent-title').setAttribute('data-i18n-skip','');$('intent-title').textContent=plan.title==='Тема по описанию'?t(plan.title):plan.title;$('intent-explanation').textContent=plan.explanation;$('intent-source').textContent=plan.source;
  for(const k of ['bpm','intensity','root','scale','bars','density'])$('plan-'+k).value=plan[k];$('plan-drums').checked=plan.drums;
  const details=[['Музыкальный мир',PRESETS[plan.preset].name],['Мотив',ALGORITHMS.find(a=>a[0]===plan.algorithm)[1]],['Гармония',plan.progression.map(n=>n+1).join(' → ')],['Тембры',Object.entries(plan.instruments).map(([t,n])=>TRACKS.find(x=>x.id===t).name+': '+n).join(' · ')||'Тембры выбранного мира']];
  $('intent-details').replaceChildren();for(const [label,value] of details){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('intent-details').append(dt,dd);}
}
function setAIBusy(busy){aiBusy=busy;$('intent-description').disabled=busy;document.querySelectorAll('[data-intent-example]').forEach(b=>b.disabled=busy);$('intent-analyze').disabled=busy;$('intent-cancel').hidden=!busy;$('intent-mode').disabled=busy;if(!busy){clearInterval(aiTimer);$('intent-progress').hidden=true;}}
function getAIWorker(){
  if(aiWorker)return aiWorker;
  aiWorker=new Worker(new URL('./ai-worker.mjs',import.meta.url),{type:'module'});
  aiWorker.onmessage=({data})=>{
    if(data.type==='status'||data.type==='ready')$('intent-status').textContent=data.text;
    if(data.type==='progress'){if(data.total){$('intent-progress').hidden=false;$('intent-progress').max=data.total;$('intent-progress').value=data.loaded;$('intent-status').textContent=`Подготовка ${data.file?.split('/').at(-1)} · ${Math.round(data.progress)}%`;}}
    if(data.type==='tokens'){$('intent-progress').hidden=true;$('intent-status').textContent=`Модель составляет план · ${data.count} токенов · ${Math.round((Date.now()-aiStarted)/1000)} с`;}
    if(data.type==='result'&&data.id===aiSequence){try{showIntentPlan(parseModelPlan(data.text,$('intent-description').value));$('intent-status').textContent='План готов. Проверьте параметры и создайте музыку.';}catch(error){console.warn('Model plan:',data.text);$('intent-status').textContent=error.message;toast(error.message,true);}finally{setAIBusy(false);}}
    if(data.type==='error'&&data.id===aiSequence){setAIBusy(false);$('intent-status').textContent='Не удалось выполнить разбор: '+data.error;toast(data.error,true);aiWorker.terminate();aiWorker=null;}
  };
  aiWorker.onerror=e=>{setAIBusy(false);$('intent-status').textContent='Ошибка модели: '+(e.message||'недостаточно памяти или недоступен WASM');aiWorker?.terminate();aiWorker=null;};
  return aiWorker;
}
$('intent-analyze').onclick=()=>{
  const description=$('intent-description').value.trim();if(description.length<5){toast('Опишите сцену хотя бы в нескольких словах.',true);$('intent-description').focus();return;}
  if($('intent-mode').value==='rules'){showIntentPlan(quickPlan(description));$('intent-status').textContent='Готов быстрый план по правилам. Нейросеть не использовалась.';return;}
  setAIBusy(true);aiStarted=Date.now();$('intent-status').textContent='Подготовка локальной модели…';$('intent-progress').hidden=false;$('intent-progress').removeAttribute('value');
  try{getAIWorker().postMessage({id:++aiSequence,type:'analyze',description});}catch(error){setAIBusy(false);$('intent-status').textContent=error.message;}
};
$('intent-cancel').onclick=()=>{aiSequence++;aiWorker?.terminate();aiWorker=null;setAIBusy(false);$('intent-status').textContent='Разбор отменён. Можно изменить описание и повторить.';};
document.querySelectorAll('[data-intent-example]').forEach(button=>button.onclick=()=>{$('intent-description').value=t(intentExamples[button.dataset.intentExample]);});
$('intent-apply').onclick=run(()=>{
  if(!intentPlan)return;const plan=clone(intentPlan);for(const k of ['bpm','intensity','root','bars','density'])plan[k]=Number($('plan-'+k).value);plan.scale=$('plan-scale').value;plan.drums=$('plan-drums').checked;plan.progression=plan.progression.map(n=>n%SCALES[plan.scale].length);
  const next=planToProject(plan);player.stop();remember();project=next;bar=0;selected=null;currentState=closestState(plan.intensity);syncConfig();renderSynth();changed({audio:false});setView('studio');toast('Музыка создана по плану. Нажмите ▶ для прослушивания.');
});
syncConfig();renderStudio();renderSynth();renderLibrary();renderVariants();
initLanguage(()=>{renderStudio();renderSynth();renderLibrary();renderVariants();if(intentPlan)$('intent-title').textContent=intentPlan.title==='Тема по описанию'?t(intentPlan.title):intentPlan.title;});
persist();requestAnimationFrame(animate);
