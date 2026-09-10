import {JSDOM,VirtualConsole} from '../../../prototype/node_modules/jsdom/lib/api.js';
import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('./',import.meta.url);
const dom=new JSDOM(await readFile(new URL('Wheelhouse-Release-1-Journey-Atlas.html',base),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://atlas.example/',virtualConsole:new VirtualConsole()});
const data=dom.window.eval('screens.map(s=>({...s,html:doc(s)}))');
await writeFile(new URL('evidence/render-input.json',base),JSON.stringify(data));
dom.window.close();
