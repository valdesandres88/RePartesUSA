import {db,unwrap} from './shared.mjs';

export default async function(){
 const cutoff=new Date(Date.now()-120*86400000).toISOString();
 unwrap(await db().from('site_analytics_events').delete().lt('created_at',cutoff));
}

export const config={schedule:'25 9 * * *'};
