import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, PRESETS, ALGORITHMS, INSTRUMENTS, TRACKS, clone, generate, assess, validateProject, sequence, durationOf, activeEvents } from '../dist/music.mjs';
import { renderProject, renderTrack } from '../dist/dsp.mjs';
import { wav, midi, zip, crc32 } from '../dist/formats.mjs';
test('video formulas reproduce their actual sequences',()=>{
  assert.deepEqual(sequence('square',8,'x'),[0,1,4,1,0,1,4,1]);
  assert.deepEqual(sequence('triangle',8,'x'),[0,1,3,6,3,1,0,0]);
  assert.equal(new Set(sequence('permutation',8,'x')).size,8);
  assert.deepEqual(sequence('neighbors',8,'x'),[6,7,8,5,2,1,0,3]);
});
test('100 seeds × 18 algorithms × 8 styles have finite, tonal, nonempty compositions',()=>{
  for(const [preset,p] of Object.entries(PRESETS))for(const [algorithm] of ALGORITHMS)for(let seed=0;seed<100;seed++){
    const c={...clone(DEFAULT_CONFIG),preset,root:p.root,scale:p.scale,progression:p.progression,algorithm,seed:String(seed),bars:4};
    const project=generate(c);assert.ok(project.events.length>30);assert.equal(assess(project).inScale,100);
    for(const e of project.events){assert.ok(Number.isFinite(e.time)&&e.time>=0&&e.time<durationOf(project));assert.ok(Number.isInteger(e.note)&&e.note>=0&&e.note<=127);assert.ok(e.duration>0&&e.velocity>0&&e.velocity<=1);}
    assert.equal(new Set(project.events.map(e=>e.track)).size,7);
  }
});
test('seed reproduces every event and all synthesis settings',()=>{
  const a=generate(clone(DEFAULT_CONFIG)),b=generate(clone(DEFAULT_CONFIG));assert.deepEqual(a.events,b.events);assert.deepEqual(a.tracks,b.tracks);
});
test('melody and drums regenerate in isolation; locked tracks retain edits',()=>{
  const base=generate(clone(DEFAULT_CONFIG));base.tracks.find(t=>t.id==='lead').locked=true;base.events.find(e=>e.track==='lead').note=80;
  const melody=generate({...base.config,melodyRevision:1},base,'melody');
  const unaffected=p=>p.events.filter(e=>!['lead','bell'].includes(e.track));assert.deepEqual(unaffected(base),unaffected(melody));assert.deepEqual(base.events.filter(e=>e.track==='lead'),melody.events.filter(e=>e.track==='lead'));
  const drums=generate({...base.config,drumRevision:1},base,'drums');assert.deepEqual(base.events.filter(e=>!['kick','snare','hat'].includes(e.track)),drums.events.filter(e=>!['kick','snare','hat'].includes(e.track)));assert.notDeepEqual(base.events.filter(e=>e.track==='hat'),drums.events.filter(e=>e.track==='hat'));
});
test('intensity is a layer selection and preserves musical events',()=>{
  const project=generate(clone(DEFAULT_CONFIG));const low=activeEvents(project,{intensity:25}),high=activeEvents(project,{intensity:100});assert.ok(high.length>low.length);assert.ok(low.length>0);assert.ok(low.every(e=>high.some(h=>h.id===e.id)));
  project.tracks.find(t=>t.id==='lead').solo=true;assert.ok(activeEvents(project).every(e=>e.track==='lead'));project.tracks.find(t=>t.id==='lead').mute=true;assert.ok(activeEvents(project).every(e=>e.track!=='lead'));
});
test('polyrhythm and binary masks continue across bar boundaries',()=>{
  const p=generate({...clone(DEFAULT_CONFIG),bars:4,algorithm:'poly'});
  assert.ok(p.events.filter(e=>e.track==='lead').every(e=>(e.bar*16+e.step)%3===0));
  assert.ok(p.events.some(e=>e.track==='lead'&&e.bar===1&&e.step===2));
  const binary=generate({...clone(DEFAULT_CONFIG),bars:4,algorithm:'binary',binary:'101'});
  assert.ok(binary.events.filter(e=>e.track==='lead').every(e=>'101'[(e.bar*16+e.step)%3]==='1'));
});
test('automation reaches exact silence and survives changes in arrangement length',()=>{
  const p=generate({...clone(DEFAULT_CONFIG),bars:4});const t=p.tracks.find(t=>t.id==='lead');t.automation={volume:[0,0,0,0],cutoff:[1000,1500,2000,1500]};
  const audio=renderTrack(p,t,{sampleRate:8000});assert.ok(audio.left.every(v=>v===0));
  const long=generate({...p.config,bars:8},p);assert.deepEqual(long.tracks.find(t=>t.id==='lead').automation.volume,[0,0,0,0,0,0,0,0]);assert.equal(validateProject(long).tracks.find(t=>t.id==='lead').automation.cutoff.length,8);
});
test('voice leading keeps chord voices close and locked notes follow changed BPM',()=>{
  const p=generate({...clone(DEFAULT_CONFIG),bars:4});const pad=p.events.filter(e=>e.track==='pad');assert.ok(pad.every(e=>e.note>=48&&e.note<=76));
  p.tracks.find(t=>t.id==='lead').locked=true;const faster=generate({...p.config,bpm:180},p);const a=p.events.filter(e=>e.track==='lead'),b=faster.events.filter(e=>e.track==='lead');assert.deepEqual(a.map(e=>e.note),b.map(e=>e.note));assert.ok(b.every((e,i)=>Math.abs(e.time-a[i].time*2/3)<1e-10));
});
test('all 33 instruments render finite, non-silent audio',()=>{
  const p=generate({...clone(DEFAULT_CONFIG),bars:4,bpm:200,intensity:100});
  for(const [name,patch] of Object.entries(INSTRUMENTS)){
    const t={...p.tracks.find(t=>t.id==='lead'),instrument:name,fmIndex:patch.index||2.5,detune:patch.detune||0};
    const one={...p,events:[{id:'test-note',track:'lead',time:0,note:69,duration:.4,velocity:.8,minIntensity:0,bar:0,step:0}]};
    const audio=renderTrack(one,t,{sampleRate:8000});let peak=0;
    for(const v of audio.left){assert.ok(Number.isFinite(v),name);peak=Math.max(peak,Math.abs(v));}assert.ok(peak>.0001,name);
  }
});
test('stereo WAV has exact loop duration, peak headroom, deterministic samples and continuous seam',()=>{
  const p=generate({...clone(DEFAULT_CONFIG),bars:4,intensity:100});const a=renderProject(p,{sampleRate:44100});const b=renderProject(p,{sampleRate:44100});
  assert.equal(a.left.length,352800);assert.equal(a.right.length,352800);assert.ok(a.peak<=.940001);assert.deepEqual(a.left,b.left);assert.deepEqual(a.right,b.right);
  const bytes=wav(a),v=new DataView(bytes.buffer);assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint16(34,true),16);assert.equal(v.getUint32(40,true),a.left.length*4);assert.equal(bytes.length,44+352800*4);
  for(const channel of [a.left,a.right]){const jump=Math.abs(channel[0]-channel.at(-1));assert.ok(jump<.035,'seam discontinuity: '+jump);}
});
test('MIDI contains conductor, 7 tracks, tempo and well-formed chunk boundaries',()=>{
  const bytes=midi(generate({...clone(DEFAULT_CONFIG),bars:4}));const v=new DataView(bytes.buffer);assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'MThd');assert.equal(v.getUint16(8),1);assert.equal(v.getUint16(10),8);assert.equal(v.getUint16(12),480);
  let pos=14,count=0;while(pos<bytes.length){assert.equal(new TextDecoder().decode(bytes.slice(pos,pos+4)),'MTrk');const length=v.getUint32(pos+4);assert.ok(length>3);pos+=8+length;count++;}assert.equal(pos,bytes.length);assert.equal(count,8);
});
test('ZIP exports lossless entries with CRC and import preserves edits',()=>{
  const a=new TextEncoder().encode('music');const packed=zip([['hello.txt',a],['project.json','{}']]);assert.equal(new DataView(packed.buffer).getUint32(14,true),crc32(a));assert.equal(new DataView(packed.buffer).getUint32(packed.length-22,true),0x06054b50);
  const original=generate({...clone(DEFAULT_CONFIG),bars:4});original.events[0].velocity=.23;original.title='Тест';const loaded=validateProject(JSON.parse(JSON.stringify(original)));assert.deepEqual(loaded.events,original.events);assert.equal(loaded.title,'Тест');
  assert.throws(()=>validateProject({...original,events:[{...original.events[0],note:NaN}]}));assert.throws(()=>generate({...DEFAULT_CONFIG,bpm:0}));assert.throws(()=>generate({...DEFAULT_CONFIG,binary:'alert(1)'}));
});
