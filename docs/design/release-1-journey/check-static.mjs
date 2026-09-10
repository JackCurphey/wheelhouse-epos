import { JSDOM, VirtualConsole } from '../../../prototype/node_modules/jsdom/lib/api.js';
import { readFile,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=new URL('./',import.meta.url),path=n=>new URL(n,url);
const html=await readFile(path('Wheelhouse-Release-1-Journey-Atlas.html'),'utf8');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented: (navigation|Window's scrollTo|window.scrollTo)/.test(e.message))errors.push(e.message);});
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://atlas.example/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLElement.prototype.scrollTo=function(){};w.HTMLElement.prototype.scrollIntoView=function(){};}});
const w=dom.window;
await new Promise(r=>setTimeout(r,100));
assert.equal(errors.length,0,errors.join('\n'));
const states=w.eval('screens');assert.ok(states.length>60);
assert.equal(new Set(states.map(s=>s.id)).size,states.length);
for(const s of states){assert.ok(states.some(t=>t.id===s.next),'Missing next '+s.id);for(const [,id]of s.branches)assert.ok(states.some(t=>t.id===id),'Missing branch '+id);for(const m of s.body.matchAll(/parent\.jump\('([^']+)'\)/g))assert.ok(states.some(t=>t.id===m[1]),'Broken action '+m[1]);const screen=new JSDOM(w.doc(s),{runScripts:'dangerously',virtualConsole:vc});assert.ok(screen.window.document.querySelector('h1'));screen.window.close();}
assert.equal(w.document.querySelectorAll('.card').length,states.length);
w.jump('approval');assert.ok(w.document.querySelector('#viewer').open);
const q=new JSDOM(w.doc(states.find(s=>s.id==='approval')),{runScripts:'dangerously',virtualConsole:vc});
const d=q.window.document;assert.equal(d.querySelector('.qtotal').textContent,'£111.00');d.querySelector('.qcable').checked=true;q.window.quoteTotal();assert.equal(d.querySelector('.qtotal').textContent,'£123.00');d.querySelector('.qpart').checked=false;q.window.quoteTotal();assert.ok(d.querySelector('.qsubmit').disabled);d.querySelector('.qfit').checked=false;q.window.quoteTotal();assert.equal(d.querySelector('.qtotal').textContent,'£77.00');assert.equal(d.querySelector('.qsubmit').disabled,false);
w.approve(true,false);assert.match(w.document.querySelector('#full-screen').srcdoc,/class="agreedTotal">£77.00/);w.closeViewer();assert.equal(w.document.querySelector('#viewer').open,false);
w.lane('book');assert.equal(w.document.querySelectorAll('.lane').length,1);w.all();assert.equal(w.document.querySelectorAll('.card').length,states.length);
const input=w.document.querySelector('#search');input.value='printer';input.dispatchEvent(new w.Event('input'));assert.ok(w.document.querySelectorAll('.card').length>0);assert.ok(w.document.querySelectorAll('.card').length<states.length);
w.all();w.jump('service');w.document.querySelector('#review-status').value='change';w.document.querySelector('#review-note').value='Make the service explanation shorter.';w.saveCurrentReview({preventDefault(){}});
assert.match(w.localStorage.getItem('wheelhouse-r1-screen-feedback'),/service explanation/);assert.equal(w.document.querySelector('#feedback-count').textContent,'Review feedback · 1');assert.ok(w.document.querySelector('[data-screen="service"] .feedback-mark'));
w.openFeedback();assert.equal(w.document.querySelector('#feedback-panel').hidden,false);assert.match(w.document.querySelector('#feedback-list').textContent,/Make the service explanation shorter/);assert.match(w.feedbackMarkdown(),/## 01 \/ Choose a service/);assert.match(w.feedbackMarkdown(),/Change requested/);w.closeFeedback();
const unlabeled=[];for(const s of states){const x=new JSDOM(w.doc(s));for(const el of x.window.document.querySelectorAll('input,select,textarea,button')){if(!el.textContent.trim()&&!el.closest('label')&&!el.getAttribute('aria-label'))unlabeled.push({screen:s.id,element:el.outerHTML.slice(0,100)});}x.window.close();}
assert.deepEqual(unlabeled,[]);assert.deepEqual(errors,[]);
await writeFile(path('screen-index.json'),JSON.stringify(states.map(({body,...s})=>s),null,2)+'\n');
const result={screenCount:states.length,checks:['HTML and JavaScript execute without errors','Unique screen IDs','All next, branch and button destinations resolve','Every screen has a heading','Line-approval arithmetic and dependency validation','Approval confirmation reflects selection','Modal open and close','Chapter filtering and search','Per-screen feedback save, badge, summary and Markdown export','Every form control has a label'],browserRendering:'Blocked: local Chromium and Chrome abort under the managed sandbox. No browser layout or screenshot validation claimed.',errors};
await writeFile(path('verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));q.window.close();dom.window.close();
