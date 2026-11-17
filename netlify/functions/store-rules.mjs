// Server-side, UTC-calendar-day validation for 30-day returns and 14-day dispatch.
const MS_PER_DAY=86400000;
export function daysAfter(date,today=new Date()){
 const input=typeof date==='string'?date.slice(0,10):'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input))return NaN;
 const start=Date.parse(input+'T00:00:00Z');
 if(!Number.isFinite(start)||new Date(start).toISOString().slice(0,10)!==input)return NaN;
 const now=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate());
 return Math.round((now-start)/MS_PER_DAY);
}
export function canRequestReturn(deliveredAt,today=new Date()){
 const days=daysAfter(deliveredAt,today);
 return Number.isInteger(days)&&days>=0&&days<=30;
}
export function canDispatchReturn(authorizedAt,today=new Date()){
 const days=daysAfter(authorizedAt,today);
 return Number.isInteger(days)&&days>=0&&days<=14;
}
export function normalReferralCode(value){
 const code=typeof value==='string'?value.trim().toUpperCase():'';
 return /^[A-Z0-9]{12}$/.test(code)?code:null;
}
