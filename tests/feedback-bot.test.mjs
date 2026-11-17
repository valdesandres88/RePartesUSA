import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
async function collect(scenario){
 const temp=await mkdtemp(join(tmpdir(),'repartes-feedback-test-'));
 try{
  const mock=`globalThis.fetch=async(input)=>{const url=new URL(input);let data;if(url.pathname.endsWith('/pulls')){data=${JSON.stringify(scenario.pulls||[])}}else if(url.searchParams.get('action')==='site'){data={listings:[]}}else{data={reviews:${JSON.stringify(scenario.reviews||[])}}}return {ok:true,json:async()=>data}};`;
  await writeFile(join(temp,'mock.mjs'),mock);
  const result=spawnSync(process.execPath,['--import',join(temp,'mock.mjs'),'scripts/feedback-bot.mjs','collect'],{encoding:'utf8',env:{...process.env,RUNNER_TEMP:temp,GITHUB_OUTPUT:join(temp,'outputs'),GITHUB_REPOSITORY:'example/repartes',GH_TOKEN:'test-only'}});
  assert.equal(result.status,0,result.stderr);
  const outputs=await readFile(join(temp,'outputs'),'utf8');
  const prompt=await readFile(join(temp,'repartes-feedback-prompt.txt'),'utf8').catch(()=>'');
  return {outputs,prompt};
 }finally{await rm(temp,{recursive:true,force:true})}
}
test('Bot does not invent feedback or start an AI task without a negative review',async()=>{
 const result=await collect({reviews:[{id:'happy',rating:5,title:'Great'}]});assert.equal(result.outputs,'ready=false\n');assert.equal(result.prompt,'');
});
test('Bot uses actual negative feedback and removes email addresses',async()=>{
 const result=await collect({reviews:[{id:'real-review',rating:2,subject:'website',title:'Broken form',comment:'Cannot save. Email customer@example.com',created_at:'2026-11-17'}]});
 assert.match(result.outputs,/ready=true/);assert.match(result.prompt,/Cannot save/);assert.doesNotMatch(result.prompt,/customer@example.com/);assert.match(result.prompt,/UNTRUSTED CUSTOMER DATA/);
});
test('Bot pauses when an improvement pull request is awaiting review',async()=>{
 const result=await collect({pulls:[{head:{ref:'feedback-bot/previous'}}],reviews:[{id:'real-review',rating:1}]});assert.equal(result.outputs,'ready=false\n');
});
