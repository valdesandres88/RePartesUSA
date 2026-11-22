import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../public/navigation.js',import.meta.url),'utf8');
function setup({referrer='',state=null,length=1,path='/',hash='#owner'}={}){
 let backs=0,scrolled=false;const listeners={};
 const location={origin:'https://example.com',pathname:path,hash,href:'https://example.com'+path+hash};
 const history={state,length,replaceState:s=>{history.state=s},back:()=>backs++};
 const scope={URL,location,history,document:{referrer,addEventListener:(event,fn)=>listeners[event]=fn},window:{addEventListener:(event,fn)=>listeners[event]=fn,scrollTo:()=>{scrolled=true}}};
 vm.runInNewContext(code,scope);
 const click=()=>listeners.click({target:{closest:()=>({})},preventDefault(){}});
 return {history,location,listeners,click,backs:()=>backs,scrolled:()=>scrolled};
}
test('Back after internal navigation uses native history',()=>{
 const s=setup();s.history.state=null;s.history.length=2;s.listeners.hashchange({oldURL:'https://example.com/#home'});s.click();assert.equal(s.backs(),1);
});
test('Reload and browser Back preserve the previous history entry',()=>{
 const s=setup({state:{repartesNavigation:{previous:'https://example.com/#sell'}},length:4});s.listeners.hashchange({oldURL:'https://example.com/#owner'});s.click();assert.equal(s.history.state.repartesNavigation.previous,'https://example.com/#sell');assert.equal(s.backs(),1);
});
test('Direct links and off-site referrers fall back to the website home',()=>{
 for(const referrer of ['', 'https://outside.example/path']){const s=setup({referrer,length:5});s.click();assert.equal(s.backs(),0);assert.equal(s.location.href,'/#home');}
});
test('Standalone guide returns to its internal referring page',()=>{
 const s=setup({referrer:'https://example.com/#catalog',length:2,path:'/guides/used-auto-parts.html',hash:''});s.click();assert.equal(s.backs(),1);
});
test('Back at a directly opened home page scrolls up',()=>{
 const s=setup({hash:'#home'});s.click();assert.equal(s.scrolled(),true);
});


test('Mobile menu uses a compact navigation with a dedicated close action',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(main,/class="market-menu-title"/);
 assert.match(main,/data-menu-close/);
 assert.match(main,/href="#amazon-parts"/);
 assert.match(css,/\.market-header \.market-menu nav\{[\s\S]*?flex-direction:column/);
 assert.match(css,/\.market-menu:not\(\[open\]\) nav\{display:none\}/);
});

test('Menu survives rerenders and view state is saved for Safari interruptions',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/menuWasOpen/);
 assert.match(main,/rebuiltMenu\.open=true/);
 assert.match(main,/visibilitychange/);
 assert.match(main,/sessionStorage\.setItem\(viewRecoveryKey/);
 assert.match(main,/restoreViewState\(\)/);
});
