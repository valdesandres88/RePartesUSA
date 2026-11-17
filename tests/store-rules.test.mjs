import test from 'node:test';
import assert from 'node:assert/strict';
import {daysAfter,canRequestReturn,canDispatchReturn,normalReferralCode} from '../netlify/functions/store-rules.mjs';

test('30 calendar days after verified delivery is inclusive, 31 is not',()=>{
 const delivered='2026-11-01';
 assert.equal(canRequestReturn(delivered,new Date('2026-11-01T22:00:00Z')),true);
 assert.equal(canRequestReturn(delivered,new Date('2026-12-01T22:00:00Z')),true);
 assert.equal(canRequestReturn(delivered,new Date('2026-12-02T00:00:00Z')),false);
 assert.equal(canRequestReturn(delivered,new Date('2026-10-31T23:59:59Z')),false);
});
test('Validates calendar dates (not impossible or malformed input)',()=>{
 for(const d of ['',null,'2026-02-30','2026-13-01','11/01/2026'])
  assert.equal(canRequestReturn(d,new Date('2026-11-18T00:00:00Z')),false);
 assert.equal(daysAfter('2026-11-01',new Date('2026-11-02T09:00:00Z')),1);
});
test('Return dispatch authorization allows 14 days',()=>{
 assert.equal(canDispatchReturn('2026-11-01T10:00:00Z',new Date('2026-11-15T21:00:00Z')),true);
 assert.equal(canDispatchReturn('2026-11-01T10:00:00Z',new Date('2026-11-16T01:00:00Z')),false);
});
test('Referral code is strict uppercase 12 hex character string',()=>{
 assert.equal(normalReferralCode(' abcdef012345 '),'ABCDEF012345');
 assert.equal(normalReferralCode('a/b/../../../'),'null'===true?'x':null);
 assert.equal(normalReferralCode('123'),null);
});
