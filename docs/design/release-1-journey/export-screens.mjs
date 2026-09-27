import {JSDOM,VirtualConsole} from 'jsdom';
import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('./',import.meta.url);
const dom=new JSDOM(await readFile(new URL('Wheelhouse-Release-1-Screen-Designs.html',base),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://screen-designs.example/',virtualConsole:new VirtualConsole()});
const data=dom.window.eval('screens.map(s=>({...s,html:doc(s)}))');
await writeFile(new URL('evidence/render-input.json',base),JSON.stringify(data));
dom.window.close();
