import test from 'node:test';import assert from 'node:assert/strict';import {checkoutCredentialsCompatible,paidSessionMatchesOrder} from '../netlify/functions/payment-guards.mjs';
const paid={id:'cs_live_1',client_reference_id:'123',metadata:{order_id:'123'},payment_status:'paid',currency:'usd',amount_subtotal:34900,payment_intent:'pi_123'};
const order={id:'123',stripe_session_id:'cs_live_1',amount_cents:34900};
test('Checkout credentials must match test/live explicitly',()=>{
 assert.equal(checkoutCredentialsCompatible('test','sk_test_123'),true);
 assert.equal(checkoutCredentialsCompatible('live','sk_live_123'),true);
 assert.equal(checkoutCredentialsCompatible('disabled','sk_live_123'),false);
 assert.equal(checkoutCredentialsCompatible('live','sk_test_123'),false);
 assert.equal(checkoutCredentialsCompatible('test','sk_live_123'),false);
 assert.equal(checkoutCredentialsCompatible('live','pk_live_123'),false);
});
test('Restricted keys retain the same environment boundary',()=>{
 assert.equal(checkoutCredentialsCompatible('test','rk_test_123'),true);
 assert.equal(checkoutCredentialsCompatible('live','rk_live_123'),true);
 for(const [mode,key] of [['test','rk_live_123'],['live','rk_test_123'],['disabled','rk_test_123'],['test','rk_test_'],['test',null],['test','rk_test_123\n']]) assert.equal(checkoutCredentialsCompatible(mode,key),false);
});
test('Valid paid session matches original order',()=>assert.equal(paidSessionMatchesOrder(paid,order),true));
test('Never accept unpaid, mismatched amounts, currency or foreign Checkout',()=>{
 for(const patch of [{payment_status:'unpaid'},{amount_subtotal:3},{currency:'eur'},{id:'cs_other'},{metadata:{order_id:'other'}},{payment_intent:null}]) assert.equal(paidSessionMatchesOrder({...paid,...patch},order),false);
});
test('Do not accept Checkout before it is durably attached to an order',()=>assert.equal(paidSessionMatchesOrder(paid,{...order,stripe_session_id:null}),false));
