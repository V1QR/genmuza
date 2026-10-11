import english from './locales/en.mjs';

export const LANGUAGES = ['ru', 'en'];
export const LANGUAGE_KEY = 'genmuza-language';
const catalog = new Map(Object.entries(english));
for (const [source, target] of Object.entries(english)) {
  // Scale names occur in both headings and inline metadata.
  if (/^[А-ЯЁ][а-яё]/.test(source)) catalog.set(source[0].toLowerCase() + source.slice(1), target[0].toLowerCase() + target.slice(1));
}
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp('(?<![А-Яа-яЁё])(?:' + [...catalog.keys()].sort((a,b)=>b.length-a.length).map(escapeRegExp).join('|') + ')(?![А-Яа-яЁё])', 'g');
let language = 'ru';
export function chooseLanguage(saved, browserLanguage='ru') {
  return LANGUAGES.includes(saved) ? saved : /^ru(?:-|$)/i.test(browserLanguage) ? 'ru' : 'en';
}
export function translate(text, locale=language) {
  const value = String(text);
  return locale === 'en' ? value.replace(pattern, match => catalog.get(match)) : value;
}
export const getLanguage = () => language;

// Bind source text to nodes rather than mutating musical data or user inputs.
// MutationObserver covers async model/player messages and newly rendered panels.
export function initLanguage(onChange=()=>{}) {
  const selector = document.getElementById('language');
  let saved;
  try { saved = localStorage.getItem(LANGUAGE_KEY); } catch {}
  language = chooseLanguage(saved, navigator.language);
  const textBindings = new WeakMap(), attributeBindings = new WeakMap();
  const attributes = ['title', 'aria-label', 'placeholder'];
  const skip = node => node.parentElement?.closest('[data-i18n-skip],script,style,textarea,pre');
  function bindText(node) {
    if (skip(node)) return;
    const current = node.data;
    let binding = textBindings.get(node);
    if (!binding || current !== binding.rendered) binding = {source:current};
    binding.rendered = translate(binding.source);
    textBindings.set(node,binding);
    if (current !== binding.rendered) node.data = binding.rendered;
  }
  function bindAttributes(node) {
    if (node.closest('[data-i18n-skip]')) return;
    const bindings = attributeBindings.get(node) || {};
    for (const name of attributes) {
      if (!node.hasAttribute(name)) continue;
      const current = node.getAttribute(name);
      let binding = bindings[name];
      if (!binding || current !== binding.rendered) binding = {source:current};
      binding.rendered = translate(binding.source);
      bindings[name] = binding;
      if (current !== binding.rendered) node.setAttribute(name,binding.rendered);
    }
    attributeBindings.set(node,bindings);
  }
  function refresh(root) {
    if (root.nodeType === Node.TEXT_NODE) return bindText(root);
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) bindAttributes(root);
    const walker = document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      node.nodeType === Node.TEXT_NODE ? bindText(node) : bindAttributes(node);
    }
  }
  const observer = new MutationObserver(records=>{
    observer.disconnect();
    // Only visit changed nodes, never scan the full studio on every animation frame.
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(node=>roots.add(node));
      else if (record.type === 'attributes') bindAttributes(record.target);
      else roots.add(record.target);
    }
    roots.forEach(refresh);
    observe();
  });
  const observe = ()=>observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  function apply() {
    observer.disconnect();
    document.documentElement.lang = language;
    selector.value = language;
    onChange(language);
    refresh(document);
    observe();
  }
  selector.addEventListener('change',()=>{
    language = chooseLanguage(selector.value);
    try { localStorage.setItem(LANGUAGE_KEY,language); } catch {}
    apply();
  });
  apply();
}
