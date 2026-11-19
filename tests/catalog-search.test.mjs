import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesPartNumber,matchesSearch,publishedOffers} from '../src/catalog-search.js';
test('Part finder supports word order, year ranges and punctuation in part numbers',()=>{
 const record={title:'Alternator',make:'Dodge',model:'Ram 1500',year_min:2009,year_max:2012,part_number:'AB-1234'};
 assert.ok(matchesSearch(record,'2011 ram alternator'));
 assert.ok(matchesSearch(record,'ab1234'));
 assert.ok(matchesSearch(record,'Alternator DODGE'));
 assert.ok(!matchesSearch(record,'2015 ram'));
 assert.ok(!matchesSearch(record,'turbo ram'));
});
test('OEM mode compares the complete published part number and ignores common separators',()=>{
 const record={title:'Alternator AB-1234 for Ram',part_number:' 00-AB 1234 '};
 assert.ok(matchesPartNumber(record,'00ab1234'));
 assert.ok(matchesPartNumber(record,'00/AB.1234'));
 for(const query of ['', '---', 'AB-1234', 'AB', '00-AB-12345']){
  assert.ok(!matchesPartNumber(record,query));
 }
 assert.ok(!matchesPartNumber({title:record.title},'AB-1234'));
 assert.ok(matchesPartNumber({part_number:'2011',year_min:2020,year_max:2022},'2011'));
});
test('Search includes saved offers without creating inventory or assuming fitment',()=>{
 const offer={title:'Amazon Turbo Mouthpiece Duramax 6.6L LLY 2004–2005',description:'Check compatibility.',kind:'affiliate',placement:'home',url:'https://link.amazon/example'};
 assert.ok(matchesSearch(offer,'2005 turbo Duramax'));
 assert.ok(!matchesSearch(offer,'2006 Duramax'));
 assert.equal(publishedOffers({monetization_offers:[offer,{...offer,url:'javascript:alert(1)'},{...offer,placement:'private'}]}).length,1);
 assert.deepEqual(publishedOffers({}),[]);
});
