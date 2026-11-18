import {db,stripe} from './shared.mjs';
import {checkoutCredentialsCompatible} from './payment-guards.mjs';
import {recoverReservations} from '../lib/order-recovery.mjs';
export default async function(){
 const mode=process.env.CHECKOUT_MODE;
 if(!checkoutCredentialsCompatible(mode,process.env.STRIPE_SECRET_KEY))throw Error('Reservation recovery: Stripe environment is not configured');
 const result=await recoverReservations({database:db(),client:stripe({timeout:5000,maxNetworkRetries:0}),mode});
 console.log('Reservation recovery summary',JSON.stringify(result));
}
export const config={schedule:'*/15 * * * *'};
