export const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);
export const dollarsToCents=value=>{const s=String(value).trim();if(!/^(0|[1-9]\d{0,6})(\.\d{1,2})?$/.test(s))return NaN;return Math.round(Number(s)*100);};
export const calcFee=(priceCents,basisPoints)=>Math.round(priceCents*basisPoints/10000);
