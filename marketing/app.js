/* نُبل وابتكار للتسويق — سلوك الموقع المشترك */
/* Meta Pixel — موقع نبل وابتكار للتسويق (993831000407341) */
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
var nublC=null;try{nublC=localStorage.getItem('nubl_consent')}catch(e){}
if(nublC!=='yes')fbq('consent','revoke');
fbq('init','993831000407341');fbq('track','PageView');
window.nublTrack=function(ev,data){try{fbq('track',ev,data||{})}catch(e){}};
(function(){
  // mobile nav
  var b=document.querySelector('.burger'),m=document.querySelector('.mnav');
  if(b&&m){b.addEventListener('click',function(){m.classList.toggle('open');b.setAttribute('aria-expanded',m.classList.contains('open'))});}

  // reveal on scroll
  var els=document.querySelectorAll('.rv');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.08,rootMargin:'0px 0px -40px 0px'});
    els.forEach(function(el,i){el.style.transitionDelay=(Math.min(i%4,3)*70)+'ms';io.observe(el)});
  }else{els.forEach(function(el){el.classList.add('in')})}

  // lightbox
  var lb=document.querySelector('.lightbox');
  if(lb){
    var img=lb.querySelector('img');
    document.querySelectorAll('[data-lb]').forEach(function(a){a.addEventListener('click',function(ev){ev.preventDefault();img.src=a.getAttribute('href');lb.classList.add('open')})});
    lb.addEventListener('click',function(ev){if(ev.target===lb||ev.target.tagName==='BUTTON'){lb.classList.remove('open');img.src=''}});
    document.addEventListener('keydown',function(ev){if(ev.key==='Escape'){lb.classList.remove('open')}});
  }

  // packages tabs
  var tabs=document.getElementById('sector-tabs');
  if(tabs&&window.SECTORS){
    var S=window.SECTORS,T=window.TERMS,n=function(x){return Number(x).toLocaleString('en-US')};
    function feat(r,months){
      var L=[];
      L.push('<b class="num">'+r[2]+'</b> منشوراً شهرياً');
      L.push('<b class="num">'+r[3]+'</b> تصميماً شهرياً');
      L.push('<b class="num">'+r[4]+'</b> منصات مُدارة');
      L.push('إدارة إعلانات حتى <b class="num">'+n(r[5])+'</b> ر.س ميزانية شهرياً');
      L.push('مطبوعات وإنتاج بقيمة <b class="num">'+n(r[6])+'</b> ر.س '+(months>1?'خلال العقد':'في الشهر'));
      L.push(months>=6?'تقرير شهري + مراجعة استراتيجية':'تقرير شهري بمؤشرات أداء');
      return L.map(function(x){return '<li><i class="star"></i><span>'+x+'</span></li>'}).join('');
    }
    function render(i){
      var s=S[i];
      window.nublSku='PKG-'+String(s.id).toUpperCase();nublTrack('ViewContent',{content_ids:[window.nublSku],content_type:'product',content_name:s.name,value:s.price,currency:'SAR'});
      document.getElementById('sector-body').innerHTML=
        '<div class="painbox"><div class="pb a"><h4>الألم في هذا القطاع</h4>'+s.pain+'</div><div class="pb b"><h4>ما نغيّره</h4>'+s.win+'</div></div>'+
        '<div class="cards">'+s.rows.map(function(r,ri){var t=T[ri];var disc=[0,5,10,15][ri];
          return '<div class="pc'+(ri===2?' best':'')+'">'+(ri===2?'<span class="badge">الأفضل قيمة</span>':'')+
          '<div class="nm">'+t[0]+'</div><div class="tg">'+t[3]+'</div>'+
          '<div class="pr num">'+n(r[0])+'<small>ر.س / شهر</small></div>'+
          '<div class="tot">إجمالي العقد <b class="num">'+n(r[1])+'</b> ر.س · <span class="num">'+t[1]+'</span> '+(t[1]===1?'شهر':'أشهر')+(disc?'<br><span class="disc">توفير '+disc+'% عن السعر الشهري</span>':'')+'</div>'+
          '<ul>'+feat(r,t[1])+'</ul>'+
          '<div class="allow">قيمة إنتاج ومطبوعات مشمولة خلال العقد: <b class="num">'+n(r[6])+' ر.س</b></div>'+
          '<div class="pay">الدفع: '+t[5]+'</div>'+
          '<a class="btn btn-p" href="https://wa.me/'+window.WA+'?text='+encodeURIComponent('السلام عليكم، أرغب بالاستفسار عن باقة «'+t[0]+'» لقطاع '+s.name+'.')+'" target="_blank" rel="noopener">اسأل عن هذه الباقة</a>'+
          '</div>'}).join('')+'</div>'+
        '<div class="incl"><h4>ما يميّز باقات هذا القطاع</h4><ul>'+s.special.map(function(x){return '<li><i class="star"></i><span>'+x+'</span></li>'}).join('')+'</ul><div class="kit"><b>حزمة المطبوعات المخصّصة:</b> '+s.kit+'</div></div>';
    }
    tabs.innerHTML=S.map(function(s,i){return '<button class="tab'+(i?'':' on')+'" data-i="'+i+'">'+s.name+'</button>'}).join('');
    tabs.addEventListener('click',function(e){var t=e.target.closest('.tab');if(!t)return;tabs.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on')});t.classList.add('on');render(+t.dataset.i);});
    var h=location.hash.replace('#','');var idx=Math.max(0,S.findIndex(function(s){return s.id===h}));
    tabs.querySelectorAll('.tab').forEach(function(x,i){x.classList.toggle('on',i===idx)});
    render(idx);
  }

  // work filters
  var filters=document.querySelector('.filters');
  if(filters){filters.addEventListener('click',function(e){var t=e.target.closest('.tab');if(!t)return;filters.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on')});t.classList.add('on');var f=t.dataset.f;document.querySelectorAll('.wk').forEach(function(w){w.style.display=(f==='all'||w.dataset.cat===f)?'':'none'})})}

  // contact form -> WhatsApp
  var form=document.getElementById('lead-form');
  if(form){form.addEventListener('submit',function(e){e.preventDefault();var d=new FormData(form);
    var msg='السلام عليكم، أرغب بحجز جلسة تشخيص مجانية.\n'+'الاسم: '+d.get('name')+'\n'+'النشاط: '+d.get('biz')+'\n'+'القطاع: '+d.get('sector')+'\n'+'الهدف الأهم: '+d.get('goal')+(d.get('note')?'\nملاحظة: '+d.get('note'):'');
    nublTrack('Lead',{content_name:'جلسة تشخيص مجانية',content_category:String(d.get('sector')||'')});
    window.open('https://wa.me/'+window.WA+'?text='+encodeURIComponent(msg),'_blank');})}

  // generic quiz engine (find-service & readiness)
  var quiz=document.getElementById('quiz');
  if(quiz&&window.QUIZ){
    var Q=window.QUIZ,i=0,ans=[];
    var qEl=quiz.querySelector('.q'),oEl=quiz.querySelector('.opts'),bar=quiz.querySelector('.prog .bar i'),lab=quiz.querySelector('.prog span'),back=quiz.querySelector('.back'),next=quiz.querySelector('.next'),res=document.getElementById('result');
    function show(){var q=Q.questions[i];qEl.textContent=q[0];lab.textContent='الخطوة '+(i+1)+' من '+Q.questions.length;bar.style.width=((i)/Q.questions.length*100)+'%';
      oEl.innerHTML=q[1].map(function(o,k){return '<button type="button" class="opt'+(ans[i]===k?' on':'')+'" data-k="'+k+'">'+o+'</button>'}).join('');
      back.disabled=i===0;next.textContent=i===Q.questions.length-1?'اعرض النتيجة':'التالي';next.disabled=ans[i]===undefined;}
    oEl.addEventListener('click',function(e){var b=e.target.closest('.opt');if(!b)return;ans[i]=+b.dataset.k;oEl.querySelectorAll('.opt').forEach(function(x){x.classList.remove('on')});b.classList.add('on');next.disabled=false;});
    back.addEventListener('click',function(){if(i>0){i--;show()}});
    next.addEventListener('click',function(){if(ans[i]===undefined)return;if(i<Q.questions.length-1){i++;show()}else{quiz.style.display='none';res.classList.add('show');res.innerHTML=Q.result(ans);res.scrollIntoView({behavior:'smooth',block:'start'});}});
    var restart=document.getElementById('restart');
    document.addEventListener('click',function(e){if(e.target.closest('#restart')){i=0;ans=[];res.classList.remove('show');quiz.style.display='';show();window.scrollTo({top:quiz.getBoundingClientRect().top+window.scrollY-100,behavior:'smooth'})}});
    show();
  }
})();

/* تتبّع نقرات واتساب كحدث تواصل */
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*="wa.me"]');if(!a)return;
  var d={content_name:(a.textContent||'').trim().slice(0,60)};if(window.nublSku&&location.pathname.indexOf('packages')>-1){d.content_ids=[window.nublSku];d.content_type='product';}
  nublTrack('Contact',d);},true);

/* شريط موافقة ملفات تعريف الارتباط + رابط سياسة الخصوصية */
document.addEventListener('DOMContentLoaded',function(){
  var fb=document.querySelector('.fbottom');
  if(fb&&!fb.querySelector('.pp-link')){var d=document.createElement('div');d.className='pp-link';d.innerHTML='<a href="/marketing/privacy" style="color:inherit;text-decoration:underline">سياسة الخصوصية</a>';fb.appendChild(d);}
  if(nublC==='yes'||nublC==='no')return;
  var b=document.createElement('div');b.setAttribute('role','dialog');b.setAttribute('aria-label','موافقة ملفات تعريف الارتباط');
  b.style.cssText='position:fixed;inset-inline:12px;bottom:12px;z-index:9999;max-width:720px;margin-inline:auto;background:#082A37;color:#F4EDE1;border:1px solid rgba(220,156,71,.45);border-radius:14px;padding:14px 16px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:.92rem;line-height:1.7';
  b.innerHTML='<span style="flex:1 1 280px">نستخدم ملفات تعريف الارتباط وأداة قياس Meta لتحسين الموقع وإعلاناتنا. <a href="/marketing/privacy" style="color:#DC9C47;text-decoration:underline">التفاصيل</a></span>'+
    '<span style="display:flex;gap:8px"><button type="button" data-c="yes" style="background:#D2652A;color:#fff;border:0;border-radius:10px;padding:8px 18px;font:inherit;font-weight:700;cursor:pointer">موافق</button>'+
    '<button type="button" data-c="no" style="background:transparent;color:#F4EDE1;border:1px solid rgba(244,237,225,.4);border-radius:10px;padding:8px 14px;font:inherit;cursor:pointer">الضرورية فقط</button></span>';
  b.addEventListener('click',function(e){var v=e.target.getAttribute&&e.target.getAttribute('data-c');if(!v)return;
    try{localStorage.setItem('nubl_consent',v)}catch(x){}
    if(v==='yes'){try{fbq('consent','grant');fbq('track','PageView')}catch(x){}}
    b.remove();});
  document.body.appendChild(b);
});
