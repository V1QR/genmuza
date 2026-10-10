import test from 'node:test';
import assert from 'node:assert/strict';
import {parseModelPlan,quickPlan,planToProject,normalizePlan,semanticText} from '../dist/intent.mjs';
import {validateProject,activeEvents,generate,DEFAULT_CONFIG,PRESETS} from '../dist/music.mjs';
import {projectJSON} from '../dist/formats.mjs';
test('neural JSON plan tolerates wrappers, honors explicit tempo and absence of drums',()=>{
  const p=parseModelPlan('```json\n{"title":"Ночной {лес}","preset":"forest","bpm":110,"root":"F#","scale":"minor","bars":8,"drums":true,"instruments":{"lead":"FM bell","pad":"Warm pad"}}\n```','Ночной лес, 80 BPM, без ударных');
  assert.equal(p.bpm,80);assert.equal(p.root,6);assert.equal(p.drums,false);
  const project=planToProject(p);assert.equal(project.tracks.find(t=>t.id==='lead').instrument,'FM bell');
  assert.ok(!activeEvents(project).some(e=>['kick','snare','hat'].includes(e.track)));
  const restored=validateProject(JSON.parse(projectJSON(project)));assert.equal(restored.intent.description,p.description);assert.match(restored.intent.source,/MiniLM/);
  assert.equal(generate(restored.config,restored).intent.description,p.description);
});
test('explicit music constraints correct inconsistent model choices',()=>{
  const plan=parseModelPlan('{"preset":"ambient","energy":20,"mood":"heroic","lead":"Warm pad"}','Битва с боссом, 140 BPM, мощный бас, плотные ударные');
  assert.equal(plan.preset,'boss');assert.equal(plan.bpm,140);assert.ok(plan.intensity>=80);assert.ok(plan.density>=70);assert.equal(plan.drums,true);assert.equal(plan.instruments.bass,'Reese bass');
});
test('categorical model energy is mapped to arrangement separately from explicit tempo',()=>{
  const description='Уютное чтение у камина, 72 BPM';
  const p=parseModelPlan('{"preset":"ambient","energy":"low","mood":"calm","lead":"Warm pad"}',description);
  assert.equal(p.intensity,25);assert.equal(p.bpm,72);assert.equal(p.instruments.lead,'Warm pad');
  assert.ok(!semanticText(description).includes('72'));
});
test('a calm neural mood produces a quiet theme even with inconsistent energy',()=>{
  const p=parseModelPlan('{"mood":"calm","energy":"high"}','Ощущение тепла и защищённости. 72 BPM.');
  assert.equal(p.preset,'ambient');assert.ok(p.intensity<=35);assert.ok(p.density<=35);assert.equal(p.drums,false);assert.equal(p.scale,'major');
});
test('model output is constrained to known music settings and never executed',()=>{
  assert.throws(()=>parseModelPlan('not JSON','scene'));assert.throws(()=>parseModelPlan('{"bpm":90','scene'));
  const p=normalizePlan({preset:'__proto__',mood:'__proto__',energy:'constructor',scale:'constructor',bpm:Infinity,density:-90,bars:999,algorithm:'javascript:',progression:[-100,999,'eval'],instruments:{lead:'<script>',pad:'Warm pad'}},'Тихая музыка');
  assert.equal(p.preset,'ambient');assert.equal(p.density,0);assert.equal(p.bars,16);assert.equal(p.instruments.lead,undefined);
  assert.doesNotThrow(()=>validateProject(planToProject(p)));
  assert.match(quickPlan('Босс 150 BPM').source,/без нейросети/);
});
test('song arrangements can be saved and reloaded at every intensity',()=>{
  for(const preset of Object.keys(PRESETS))for(const intensity of [0,35,75,100]){
    const p=generate({...DEFAULT_CONFIG,preset,form:'song',intensity});
    assert.doesNotThrow(()=>validateProject(JSON.parse(projectJSON(p))));
  }
});
