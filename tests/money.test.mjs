import {test} from 'node:test';import {strict as assert} from 'node:assert';import {money,dollarsToCents,calcFee} from '../src/money.js';
test('Money format',()=>assert.equal(money(123456),'$1,234.56'));
test('Valid decimal money',()=>assert.equal(dollarsToCents('10.99'),1099));
test('Reject invalid decimal money',()=>assert.ok(Number.isNaN(dollarsToCents('0.999'))));
test('Fee precise cents',()=>assert.equal(calcFee(10000,1500),1500));
