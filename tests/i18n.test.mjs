import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseLanguage,translate} from '../dist/i18n.mjs';
import {SCALE_NAMES,ALGORITHMS,PRESETS,STATES} from '../dist/music.mjs';

test('saved language wins; unsupported preferences fall back to browser language',()=>{
  assert.equal(chooseLanguage('en','ru-RU'),'en');
  assert.equal(chooseLanguage('ru','en-US'),'ru');
  assert.equal(chooseLanguage('invalid','ru-RU'),'ru');
  assert.equal(chooseLanguage(null,'en-GB'),'en');
  assert.equal(chooseLanguage(null,'de-DE'),'en');
});
test('English catalog covers static UI, scales, states, presets and algorithm descriptions',()=>{
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  const labels=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]).filter(s=>s.trim()!=='Русский');
  labels.push(...Object.values(SCALE_NAMES),...Object.values(STATES).map(s=>s.name),...Object.values(PRESETS).map(p=>p.subtitle));
  labels.push(...ALGORITHMS.flatMap(a=>a.slice(1)));
  for(const label of labels) assert.doesNotMatch(translate(label,'en'),/[А-Яа-яЁё]/,label);
});
test('dynamic labels translate without changing musical numbers or code; Russian stays exact',()=>{
  const source='ТАКТ 03 / 16 · натуральный минор · 112 активных событий';
  assert.equal(translate(source,'en'),'BAR 03 / 16 · natural minor · 112 active events');
  assert.equal(translate(source,'ru'),source);
  assert.equal(translate('await GenMuza.setState("combat");','en'),'await GenMuza.setState("combat");');
  assert.equal(translate('My custom scene','en'),'My custom scene');
});
