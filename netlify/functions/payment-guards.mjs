export function checkoutCredentialsCompatible(mode,secret){
 if(typeof secret!=='string')return false;
 return (mode==='test'&&secret.startsWith('sk_test_'))||(mode==='live'&&secret.startsWith('sk_live_'));
}
export function paidSessionMatchesOrder(session,order){
 if(!session||!order)return false;
 const oid=session.metadata?.order_id||session.client_reference_id;
 return session.payment_status==='paid'&&oid===order.id&&typeof order.stripe_session_id==='string'&&order.stripe_session_id===session.id&&session.currency==='usd'&&session.amount_subtotal===order.amount_cents&&typeof session.payment_intent==='string'&&session.payment_intent.startsWith('pi_');
}
