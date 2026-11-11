// In-memory stand-in for supabase-js, used only by the comparison tests so nothing touches the real project.
(function(){
  var cfg=window.__MOCK||{role:'student',signedIn:true};
  var uid='11111111-2222-3333-4444-555555555555';
  var NOW='2026-06-15T15:00:00.000Z';var seq=0;
  var user={id:uid,email:'test@example.com',user_metadata:{display_name:'Test Player',hcp_preference:'10',has_launch_monitor:true}};
  var DB=window.__DB={profiles:[
    {id:uid,email:'test@example.com',display_name:'Test Player',role:cfg.role,is_admin:cfg.role==='admin',invite_code:null,coach_id:cfg.role==='student'?'c1':null,hcp_preference:'10',has_launch_monitor:true,bag_clubs:[{name:'Driver',carry:250,total:270},{name:'7 Iron',carry:160,total:168},{name:'PW',carry:125,total:128},{name:'56°',carry:90,total:92}],wedge_gapping:[],speed_sessions:[],goals:[],schedule:[]},
    {id:'s1',email:'s1@example.com',display_name:'Student One',role:'student',coach_id:uid,hcp_preference:'5',bag_clubs:[],wedge_gapping:[],speed_sessions:[],goals:[{id:'g1',type:'score',target:75,completed:false}],schedule:[]},
    {id:'s2',email:'s2@example.com',display_name:'Student Two',role:'student',coach_id:uid,hcp_preference:'15',bag_clubs:[],wedge_gapping:[],speed_sessions:[],goals:[],schedule:[]},
    {id:'c1',email:'coach@example.com',display_name:'Coach Carl',role:'coach'}],
   rounds:[],combine_scores:[],practice_sessions:[],swing_journal_entries:[],custom_courses:[],
   coach_students:cfg.role==='student'?[{id:'cs0',coach_id:'c1',student_id:uid,student_name:'Test Player',student_email:'test@example.com',created_at:NOW}]:[{id:'cs1',coach_id:uid,student_id:'s1',student_name:'Student One',student_email:'s1@example.com',invite_code:'ABC123',team_id:'t1',created_at:NOW},{id:'cs2',coach_id:uid,student_id:'s2',student_name:'Student Two',student_email:'s2@example.com',invite_code:'DEF456',team_id:null,created_at:NOW}],
   coach_teams:cfg.role==='student'?[]:[{id:'t1',coach_id:uid,team_name:'Varsity'}],coach_requests:[],
   coach_notes:[{id:'n1',coach_id:cfg.role==='student'?'c1':uid,student_id:cfg.role==='student'?uid:'s1',note_text:'Work on tempo',coach_name:'Coach Carl',note_type:'lesson',lesson_date:'2026-06-01',created_at:NOW}],
   coach_drill_assignments:[{id:'d1',coach_id:cfg.role==='student'?'c1':uid,student_id:cfg.role==='student'?uid:'s1',drill_name:'Gate Drill',drill_category:'putting',note:'10 min',coach_name:'Coach Carl',completed:false,completion_note:null,created_at:NOW}],
   coach_combine_assignments:[{id:'a1',coach_id:cfg.role==='student'?'c1':uid,student_id:cfg.role==='student'?uid:'s1',combine_type:'Putting',coach_name:'Coach Carl',completed:false,target_score:60,due_date:'2026-07-01',note:'',custom_shots:null,shot_count:18,combine_mode:'combine',created_at:NOW}],
   coach_messages:[{id:'m1',sender_id:'c1',receiver_id:uid,message_text:'Nice round!',sender_name:'Coach Carl',read:false,created_at:NOW}],
   notifications:[{id:'nt1',user_id:uid,type:cfg.role==='student'?'coach_note':'new_round',title:'Update',message:'Something happened',read:false,created_at:NOW,student_id:'s1',student_name:'Student One',round_id:'fx-s1-0'}]};
  (window.__FIXTURE_ROUNDS||[]).forEach(function(r,i){var c=JSON.parse(JSON.stringify(r));c.id='fx-'+i;c.user_id=uid;DB.rounds.push(c);var d=JSON.parse(JSON.stringify(r));d.id='fx-s1-'+i;d.user_id='s1';DB.rounds.push(d);});
  (window.__FIXTURE_COMBINES||[]).forEach(function(r,i){var c=JSON.parse(JSON.stringify(r));c.id='fc-'+i;c.user_id=uid;DB.combine_scores.push(c);});
  var log=window.__DBLOG=[];
  function Q(t){this.t=t;this.f=[];this.op='select';}
  var P=Q.prototype;
  P.select=function(c,o){if(this.op==='select'){this.opts=o;}this.ret=true;return this;};
  P.insert=function(r){this.op='insert';this.rows=Array.isArray(r)?r:[r];return this;};
  P.upsert=function(r){this.op='upsert';this.rows=Array.isArray(r)?r:[r];return this;};
  P.update=function(v){this.op='update';this.vals=v;return this;};
  P.delete=function(){this.op='delete';return this;};
  ['eq','neq','gte','lte','gt','lt','in','contains','is'].forEach(function(k){P[k]=function(c,v){this.f.push([k,c,v]);return this;};});
  P.or=function(s){this.orS=s;return this;};
  P.order=function(c,o){this.ord=[c,!o||o.ascending!==false];return this;};
  P.limit=function(n){this.lim=n;return this;};
  P.single=function(){this.one=1;return this;};P.maybeSingle=function(){this.one=2;return this;};
  function test(r,f){var x=r[f[1]],v=f[2];switch(f[0]){case'eq':return x==v;case'neq':return x!=v;case'gte':return x>=v;case'lte':return x<=v;case'gt':return x>v;case'lt':return x<v;case'in':return v.indexOf(x)>=0;case'is':return x===v||(v===null&&x==null);case'contains':return true;}}
  P.exec=function(){
    var tbl=DB[this.t];if(!tbl){return {data:null,error:{message:'no table '+this.t}};}
    var self=this,match=function(r){if(self.orS){var ok=self.orS.split(',').some(function(p){var a=p.split('.');return test(r,[a[1],a[0],a.slice(2).join('.')]);});if(!ok)return false;}return self.f.every(function(f){return test(r,f);});};
    var out;
    if(this.op==='insert'||this.op==='upsert'){out=this.rows.map(function(r){var n=JSON.parse(JSON.stringify(r));if(self.op==='upsert'&&n.id){var ex=tbl.find(function(x){return x.id===n.id;});if(ex){Object.assign(ex,n);return ex;}}if(!n.id)n.id='new-'+(++seq);if(!n.created_at)n.created_at=NOW;tbl.push(n);return n;});log.push([this.op,this.t,JSON.stringify(this.rows)]);}
    else if(this.op==='update'){out=tbl.filter(match);out.forEach(function(r){Object.assign(r,JSON.parse(JSON.stringify(self.vals)));});log.push(['update',this.t,JSON.stringify(this.vals),JSON.stringify(this.f)]);}
    else if(this.op==='delete'){out=tbl.filter(match);DB[this.t]=tbl.filter(function(r){return !match(r);});log.push(['delete',this.t,JSON.stringify(this.f)]);}
    else{out=tbl.filter(match);if(this.opts&&this.opts.head)return {data:null,count:out.length,error:null};}
    out=JSON.parse(JSON.stringify(out));
    if(this.ord){var c=this.ord[0],asc=this.ord[1];out.sort(function(a,b){return (a[c]>b[c]?1:a[c]<b[c]?-1:0)*(asc?1:-1);});}
    if(this.lim!=null)out=out.slice(0,this.lim);
    if(this.one){if(out.length===1||(out.length>1&&this.op!=='select'))return {data:out[0],error:null};if(this.one===2&&out.length===0)return {data:null,error:null};return {data:null,error:{code:'PGRST116',message:'no rows'}};}
    return {data:out,error:null,count:out.length};
  };
  P.then=function(a,b){var s=this;return new Promise(function(r){setTimeout(function(){r(s.exec());},5);}).then(a,b);};
  P.catch=function(b){return this.then(undefined,b);};
  var session=cfg.signedIn?{user:user}:null;var cbs=[];
  var auth={getSession:function(){return new Promise(function(r){setTimeout(function(){r({data:{session:session},error:null});},200);});},getUser:function(){return Promise.resolve({data:{user:session?user:null},error:null});},
    onAuthStateChange:function(cb){cbs.push(cb);setTimeout(function(){cb('INITIAL_SESSION',session);},300);return {data:{subscription:{unsubscribe:function(){}}}};},
    signUp:function(){return Promise.resolve({data:{user:null,session:null},error:{message:'Signups disabled in test'}});},
    signInWithPassword:function(){session={user:user};cbs.forEach(function(c){c('SIGNED_IN',session);});return Promise.resolve({data:{user:user,session:session},error:null});},
    signOut:function(){session=null;cbs.forEach(function(c){c('SIGNED_OUT',null);});return Promise.resolve({error:null});},
    resetPasswordForEmail:function(){return Promise.resolve({data:{},error:null});},
    updateUser:function(a){if(a.data)Object.assign(user.user_metadata,a.data);log.push(['updateUser',JSON.stringify(a)]);return Promise.resolve({data:{user:user},error:null});}};
  window.supabase={createClient:function(){return {auth:auth,from:function(t){return new Q(t);}};}};
})();
