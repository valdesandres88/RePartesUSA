import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesSearch,publishedOffers} from '../src/catalog-search.js';
test('Part finder supports word order, year ranges and punctuation in part numbers',()=>{
 const record={title:'Alternator',make:'Dodge',model:'Ram 1500',year_min:2009,year_max:2012,part_number:'AB-1234'};
 assert.ok(matchesSearch(record,'2011 ram alternator'));
 assert.ok(matchesSearch(record,'ab1234'));
 assert.ok(matchesSearch(record,'Alternator DODGE'));
 assert.ok(!matchesSearch(record,'2015 ram'));
 assert.ok(!matchesSearch(record,'turbo ram'));
});
test('Search includes saved offers without creating inventory or assuming fitment',()=>{
 const offer={title:'Amazon Turbo Mouthpiece Duramax 6.6L LLY 2004–2005',description:'Check compatibility.',kind:'affiliate',placement:'home',url:'https://link.amazon/example'};
 assert.ok(matchesSearch(offer,'2005 turbo Duramax'));
 assert.ok(!matchesSearch(offer,'2006 Duramax'));
 assert.equal(publishedOffers({monetization_offers:[offer,{...offer,url:'javascript:alert(1)'},{...offer,placement:'private'}]}).length,1);
 assert.deepEqual(publishedOffers({}),[]);
});
