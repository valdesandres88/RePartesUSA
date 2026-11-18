import {db,stripe,respond} from './shared.mjs';
import {checkoutCredentialsCompatible} from './payment-guards.mjs';
import {recoverReservations} from '../lib/order-recovery.mjs';
export async function handler(event){
 if(event.httpMethod!=='POST')return respond({error:'Method not allowed'},405);
 const expected=process.env.CRON_SECRET;
 if(!expected||event.headers.authorization!==`Bearer ${expected}`)return respond({error:'Unauthorized'},403);
 const mode=process.env.CHECKOUT_MODE;
 if(!checkoutCredentialsCompatible(mode,process.env.STRIPE_SECRET_KEY))return respond({error:'Stripe environment is not configured'},503);
 return respond(await recoverReservations({database:db(),client:stripe({timeout:5000,maxNetworkRetries:0}),mode}));
}
