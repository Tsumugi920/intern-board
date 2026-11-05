const H={'Content-Type':'application/json'};
function show(id,btn){document.querySelectorAll('section').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');loadAll();}
async function loadAll(){
  const s=await (await fetch('/api/stats')).json();
  document.getElementById('statBox').innerHTML=Object.entries(s).map(([k,v])=>`<span class="stat">${k}: ${typeof v==='object'?JSON.stringify(v):v}</span>`).join('');
  loadJobs();
  const c=await (await fetch('/api/companies')).json();
  document.getElementById('compList').innerHTML=c.items.map(x=>`<div class="card"><b>${x.name}</b> ${x.verified?'· 已认证':''}<p>${x.industry} · ${x.size} · ${x.location}</p><p>${x.intro}</p></div>`).join('');
  loadApps();
  const r=await (await fetch('/api/resumes')).json();
  document.getElementById('resList').innerHTML=r.items.map(x=>`<div class="card"><b>${x.name}</b> · ${x.major} · ${x.grade} · ${x.visibility}<p>技能：${x.skills}</p><p>${x.experience}</p></div>`).join('');
  const iv=await (await fetch('/api/interviews')).json();
  document.getElementById('ivList').innerHTML=iv.items.map(x=>`<div class="card">投递 #${x.applicationId} · ${x.time} · ${x.place} ${x.link?('· '+x.link):''} · 面试官 ${x.interviewer} · 结果 ${x.result}</div>`).join('');
  const m=await (await fetch('/api/messages')).json();
  document.getElementById('msgList').innerHTML=m.items.map(x=>`<div class="card">${x.from} → ${x.to}：${x.content}</div>`).join('');
}
async function loadJobs(){
  const q=new URLSearchParams();
  if(jt.value)q.set('type',jt.value); if(js.value)q.set('status',js.value); if(jq.value)q.set('q',jq.value);
  if(jo.value){q.set('sort',jo.value);q.set('order',jo.value==='salaryMin'?'asc':'desc');}
  const j=await (await fetch('/api/jobs?'+q)).json();
  document.getElementById('jobList').innerHTML=j.items.map(x=>`<div class="card"><b>#${x.id} ${x.title}</b> · ${x.company} · ${x.type} · ${x.location} · ${x.status==='open'?'开放中':'已关闭'}<p>薪资 ¥${x.salaryMin}-${x.salaryMax}/天 · 截止 ${x.deadline} · 浏览 ${x.views}</p><p>${(x.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</p><button onclick="fav(${x.id})">收藏</button></div>`).join('')||'暂无符合条件的岗位';
}
async function loadApps(){
  const st=document.getElementById('as2').value;
  const a=await (await fetch('/api/applications'+(st?'?status='+st:''))).json();
  document.getElementById('appList').innerHTML=a.items.map(x=>`<div class="card">#${x.id} ${x.applicant}（${x.studentId}）投递「${x.jobTitle}」· 状态 ${x.status}<p>${x.resume}</p><button onclick="trans(${x.id},'初筛')">进初筛</button> <button onclick="trans(${x.id},'面试')">进面试</button> <button onclick="trans(${x.id},'offer')">发 offer</button> <button onclick="trans(${x.id},'拒绝')">拒绝</button></div>`).join('');
}
async function trans(id,st){const r=await fetch('/api/applications/'+id+'/transition',{method:'POST',headers:H,body:JSON.stringify({status:st})});if(!r.ok)alert('流转失败：'+(await r.json()).error);loadApps();}
async function fav(id){const user=prompt('收藏人姓名','陈晓雨');if(!user)return;const r=await fetch('/api/jobs/'+id+'/favorite',{method:'POST',headers:H,body:JSON.stringify({user})});if(!r.ok)alert('收藏失败：'+(await r.json()).error);else alert('已收藏');}
async function applyJob(e){e.preventDefault();const r=await fetch('/api/jobs/'+aj.value+'/apply',{method:'POST',headers:H,body:JSON.stringify({applicant:an.value,studentId:as.value,resume:ar.value})});if(!r.ok)alert('投递失败：'+(await r.json()).error);else{alert('投递成功');loadApps();}return false;}
loadAll();
