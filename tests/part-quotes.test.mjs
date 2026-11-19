import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteDetails,quotePhotoPaths,readPartQuotes} from '../netlify/lib/part-quotes.mjs';

const id='e087581e-9c73-4be3-ba36-da11d08b8765';
const request_id='593e42ce-9f00-464a-9076-8ac9c42cf28c';
const token='b63abe7d-a40e-4282-8af4-92e7534616f7';
const path=request_id+'/'+id+'/'+token+'.jpg';
const valid={
 id,request_id,seller_name:' Parts Shop ',total:'125.49',condition:'used',fulfillment:'pickup',
 fulfillment_details:'Hialeah',availability:'Today',warranty:'30 days',part_number:'AB-1234',
 fitment_notes:'OEM number checked'
};

test('Owner quotes require a total and actual fulfillment, warranty and fitment details',()=>{
 assert.equal(quoteDetails(valid).total_cents,12549);
 assert.equal(quoteDetails(valid).seller_name,'Parts Shop');
 for(const patch of [{total:'1.001'},{total:'0'},{condition:'unknown'},{fulfillment:'both'},{fitment_notes:''},{warranty:''}]){
  assert.throws(()=>quoteDetails({...valid,...patch}),{status:400});
 }
});

test('Only private photo paths scoped to the quote and request are accepted',()=>{
 assert.deepEqual(quotePhotoPaths([path],valid),[path]);
 for(const paths of [[],[path,path],[path.replace(id,token)],[path.replace('.jpg','.svg')],['https://example.com/photo.jpg']]){
  assert.throws(()=>quotePhotoPaths(paths,valid),{status:400});
 }
});

function comparisonDb(){
 const calls=[];
 return {calls,from(table){
  const query={select(columns){calls.push([table,'select',columns]);return query},
   eq(column,value){calls.push([table,'eq',column,value]);return query},
   order(){return query},
   async maybeSingle(){
    if(calls.at(-1)[3]!==token)return {data:null};
    return {data:{id:request_id,vehicle_year:2011,make:'Ram',model:'1500',part:'Alternator',email:'private@example.com',phone:'private',details:'private'}};
   },
   then(resolve){return resolve({data:[{seller_name:'Parts Shop',total_cents:12549,photo_paths:[path]}]});}
  };
  return query;
 },storage:{from(bucket){
  assert.equal(bucket,'quote-photos');
  return {async createSignedUrls(paths,seconds){
   assert.deepEqual(paths,[path]);
   assert.equal(seconds,300);
   return {data:[{path,signedUrl:'https://storage.example/signed-photo'}]};
  }};
 }}};
}

test('Private comparison requires the share token and returns only eligible quotes and buyer-facing data',async()=>{
 const db=comparisonDb();
 await assert.rejects(readPartQuotes(request_id,db),{status:404});
 assert.ok(!db.calls.some(([table])=>table==='part_request_quotes'));
 assert.deepEqual(await readPartQuotes(token,db),{
  request:{vehicle_year:2011,make:'Ram',model:'1500',part:'Alternator'},
  offers:[{seller_name:'Parts Shop',total_cents:12549,photos:['https://storage.example/signed-photo']}]
 });
 assert.ok(db.calls.some(call=>call[0]==='part_request_quotes'&&call[2]==='active'&&call[3]===true));
 assert.ok(db.calls.some(call=>call[0]==='part_request_quotes'&&call[2]==='request_id'&&call[3]===request_id));
});
