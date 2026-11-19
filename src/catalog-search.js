// Match published records only. A text match is never a vehicle fitment guarantee.
export const normalizeSearch=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const normalizePartNumber=value=>normalizeSearch(value).replaceAll(' ','');
export function matchesPartNumber(record,query){
 const number=normalizePartNumber(query);
 return number!==''&&number===normalizePartNumber(record.part_number);
}
export function matchesSearch(record,query){
 const tokens=normalizeSearch(query).split(' ').filter(Boolean);
 const text=normalizeSearch([record.title,record.description,record.make,record.model,record.part_number,record.shop_name].join(' '));
 const compact=text.replaceAll(' ','');
 return tokens.every(token=>{
  if(/^(19|20)\d{2}$/.test(token)&&record.year_min&&record.year_max)return +token>=+record.year_min&&+token<=+record.year_max;
  return text.includes(token)||(/\d/.test(token)&&compact.includes(token));
 });
}
export function publishedOffers(settings){
 return (Array.isArray(settings?.monetization_offers)?settings.monetization_offers:[]).filter(x=>x&&['affiliate','sponsored'].includes(x.kind)&&['home','part'].includes(x.placement)&&/^https:\/\//.test(x.url||''));
}
