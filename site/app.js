const form=document.getElementById('ballots');
const views=['choose','review','success'];
function show(index){views.forEach((id,i)=>document.getElementById(id).hidden=i!==index);[1,2,3].forEach(n=>{const step=document.getElementById('step'+n);step.classList.toggle('active',n===index+1);if(n===index+1)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current')});if(index>0)document.getElementById(views[index]).focus();}
form.addEventListener('change',()=>{const count=['titulaire','suppleant'].filter(name=>form.querySelector('input[name="'+name+'"]:checked')).length;document.getElementById('selection-status').textContent=count===2?'Vos deux bulletins sont prêts à vérifier.':count+' bulletin sélectionné sur 2.';});
form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const data=new FormData(form);document.getElementById('review-t').textContent=data.get('titulaire');document.getElementById('review-s').textContent=data.get('suppleant');show(1);});
document.getElementById('edit').addEventListener('click',()=>{show(0);form.querySelector('input:checked').focus();});
document.getElementById('confirm').addEventListener('click',()=>show(2));
document.getElementById('restart').addEventListener('click',()=>{form.reset();document.getElementById('selection-status').textContent='Choisissez un bulletin dans chaque scrutin.';show(0);form.querySelector('input').focus();});
