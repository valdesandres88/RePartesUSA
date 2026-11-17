// Read-only review markup. Review text is escaped and submitted only from authenticated forms.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const stars=n=>'<span class="stars" aria-label="'+esc(n)+' out of five stars">'+('★'.repeat(Number(n)||0))+('☆'.repeat(5-(Number(n)||0)))+'</span>';
export function reviewList(data){
 if(!data)return '<p>Loading reviews…</p>';
 if(!data.count)return '<div class="empty">There are no published reviews yet. We never invent ratings or testimonials.</div>';
 return '<div class="panel"><h3>'+esc(data.average.toFixed(1))+' / 5 '+stars(Math.round(data.average))+' · '+esc(data.count)+' reviews</h3>'+
 data.reviews.map(x=>'<article class="review"><div>'+stars(x.rating)+' <small>'+esc(new Date(x.created_at).toLocaleDateString())+'</small></div><h3>'+esc(x.title)+'</h3><p>'+esc(x.comment)+'</p><small>'+(x.subject==='part'?'Verified purchaser':'Website member')+'</small></article>').join('')+'</div>';
}
export function reviewForm(kind,id=''){
 return '<form class="panel" id="review" data-subject="'+esc(kind)+'" data-id="'+esc(id)+'">'+
  '<label>Rating<select name="rating" required><option value="5">★★★★★ — 5</option><option value="4">★★★★☆ — 4</option><option value="3">★★★☆☆ — 3</option><option value="2">★★☆☆☆ — 2</option><option value="1">★☆☆☆☆ — 1</option></select></label>'+
  '<label>Review title<input name="title" required minlength="3" maxlength="120"></label>'+
  '<label>Your genuine experience<textarea name="comment" rows="5" required minlength="20" maxlength="2000"></textarea></label>'+
  '<p>We moderate reviews. Never submit false testimonials, advertising, or private personal information.</p><button class="primary">Submit review</button></form>';
}
