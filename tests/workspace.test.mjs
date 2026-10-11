import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, generate, validateProject, createVariants, extractFragment, phraseAt, clone } from '../dist/music.mjs';
import { readLibrary, storeProject } from '../dist/library.mjs';
import { Player } from '../dist/player.mjs';

test('expressive phrases leave breathing space and resolve on their chord',()=>{
  const project=generate({...DEFAULT_CONFIG,bars:8,humanize:0});
  assert.deepEqual([0,1,2,3].map(bar=>phraseAt(project.config,bar).name),['Вопрос','Ответ','Развитие','Каденция']);
  const lead=bar=>project.events.filter(e=>e.track==='lead'&&e.bar===bar);
  assert.notDeepEqual(lead(0).map(e=>e.step),lead(1).map(e=>e.step));
  assert.ok(lead(3).length<8);
  assert.ok(lead(3).at(-1).duration>60/project.config.bpm/2);
  assert.equal(validateProject(project).config.phrasing,'expressive');
  assert.equal(validateProject({...project,config:Object.fromEntries(Object.entries(project.config).filter(([key])=>key!=='phrasing'))}).config.phrasing,'expressive');
});

test('three variants preserve protected work, remain reproducible and leave the original intact',()=>{
  const project=generate({...DEFAULT_CONFIG,bars:4});project.tracks.find(t=>t.id==='lead').locked=true;project.events.find(e=>e.track==='lead').note=81;
  const before=clone(project),variants=createVariants(project,3,2);
  assert.deepEqual(project,before);assert.deepEqual(variants,createVariants(project,3,2));
  assert.equal(new Set(variants.map(p=>p.config.seed)).size,3);
  for(const candidate of variants){assert.deepEqual(candidate.events.filter(e=>e.track==='lead'),project.events.filter(e=>e.track==='lead'));assert.deepEqual(candidate.tracks,project.tracks);assert.equal(candidate.config.bpm,project.config.bpm);validateProject(candidate);}
  assert.notDeepEqual(variants[0].events.filter(e=>e.track==='hat'),variants[1].events.filter(e=>e.track==='hat'));
});

test('saved fragment retains exact notes, timing, patches and the selected automation',()=>{
  const project=generate({...DEFAULT_CONFIG,bars:16,humanize:0});
  const track=project.tracks.find(t=>t.id==='lead');track.automation.volume=Array.from({length:16},(_,i)=>i/16);track.automation.cutoff=Array.from({length:16},(_,i)=>1000+i*200);
  const fragment=extractFragment(project,4,4),offset=4*240/project.config.bpm;
  assert.deepEqual(fragment.events,project.events.filter(e=>e.bar>=4&&e.bar<8).map(e=>({...e,bar:e.bar-4,time:e.time-offset})));
  assert.deepEqual(fragment.tracks.find(t=>t.id==='lead').automation.volume,[.25,.3125,.375,.4375]);
  assert.equal(fragment.config.bars,4);assert.equal(fragment.config.form,'loop');validateProject(fragment);
  assert.throws(()=>extractFragment(project,14,4));assert.throws(()=>extractFragment(project,1,4));
});

test('library deduplicates saves, preserves favorites at capacity and recovers valid records',()=>{
  const p=generate({...DEFAULT_CONFIG,bars:4});const entry={id:'one',savedAt:'2026-10-10'};
  let records=storeProject([],p,{...entry,favorite:true});records=storeProject(records,p,{id:'two',savedAt:'later'});
  assert.equal(records.length,1);assert.equal(records[0].id,'one');assert.equal(records[0].favorite,true);
  records=Array.from({length:30},(_,i)=>({id:String(i),project:generate({...DEFAULT_CONFIG,bars:4,seed:String(i)}),favorite:i<29,savedAt:'2026-10-10'}));
  const inserted=storeProject(records,p,{id:'new',favorite:true,savedAt:'now'});assert.equal(inserted.length,30);assert.ok(inserted.every(item=>item.favorite));assert.ok(!inserted.some(item=>item.id==='29'));
  assert.throws(()=>storeProject(inserted,generate({...DEFAULT_CONFIG,bars:4,seed:'another'}),{id:'another',favorite:true}));
  assert.equal(readLibrary([null,{project:{broken:true}},...inserted]).length,28);
});

test('rapid game transitions cancel the pending source and use a longer crossfade',async()=>{
  const calls=[],param=()=>({value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(value,time){calls.push(['ramp',value,time]);}});
  const node=()=>({connect(){},disconnect(){}}),created=[];
  const audio={left:new Float32Array(8),right:new Float32Array(8),sampleRate:8000};
  const player=new Player({render:async()=>audio});player.context={currentTime:.2,createBuffer:()=>({duration:8,copyToChannel(){}}),createGain:()=>({...node(),gain:param()}),createBufferSource:()=>{const source={...node(),start(){},stop(...args){calls.push(['stop',created.indexOf(source),...args]);}};created.push(source);return source;}};
  player.compressor=node();player.playing=true;player.started=0;player.duration=8;player.project=generate({...DEFAULT_CONFIG,bars:4});
  const original={source:{...node(),stop(){}},gain:{...node(),gain:param()},when:0};player.sources=[original];
  await player.update({...player.project,config:{...player.project.config,intensity:25}});
  player.context.currentTime=.3;await player.update({...player.project,config:{...player.project.config,intensity:100}});
  assert.equal(player.sources.length,2);assert.ok(calls.some(call=>call[0]==='stop'&&call[1]===0&&call.length===2));assert.ok(calls.some(call=>call[0]==='ramp'&&call[2]===2.45));player.stop();
});
