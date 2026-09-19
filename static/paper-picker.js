(() => {
  const select = document.getElementById('paperStyle');
  if (!select) return;
  const names = {blank:'Plain paper',grid:'Squared paper',lined:'Ruled paper',dotted:'Dotted paper'};
  const descriptions = {blank:'Room for anything',grid:'Keep things aligned',lined:'Follow your thoughts',dotted:'A little structure'};
  select.hidden = true;
  const label = select.parentElement.querySelector('label');
  label.htmlFor = 'paperPickerTrigger';
  const trigger = document.createElement('button');
  trigger.id='paperPickerTrigger';trigger.className='paper-picker-trigger';trigger.type='button';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','paperPickerMenu');
  const menu = document.createElement('div');menu.id='paperPickerMenu';menu.className='paper-picker-menu';menu.hidden=true;menu.setAttribute('role','listbox');menu.setAttribute('aria-label','Paper style');
  menu.innerHTML='<div class="paper-picker-heading">CHOOSE YOUR PAPER</div>';
  const buttons = Object.keys(names).map(value=>{
    const b=document.createElement('button');b.type='button';b.className='paper-picker-option';b.dataset.paper=value;b.setAttribute('role','option');b.innerHTML=`<span class="paper-swatch paper-${value}" aria-hidden="true"></span><span class="paper-option-copy"><strong>${names[value]}</strong><small>${descriptions[value]}</small></span><svg class="paper-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>`;
    b.onclick=()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close(true);};menu.append(b);return b;
  });
  select.after(trigger);document.body.append(menu);
  function sync(){const value=names[select.value]?select.value:'blank';trigger.innerHTML=`<span class="paper-swatch paper-${value}" aria-hidden="true"></span><span>${names[value]}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>`;buttons.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.paper===value)));}
  function close(focus=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
  function open(){sync();menu.hidden=false;trigger.setAttribute('aria-expanded','true');const rect=trigger.getBoundingClientRect();menu.style.left=Math.max(12,Math.min(rect.left,innerWidth-menu.offsetWidth-12))+'px';menu.style.top=Math.max(12,rect.top-menu.offsetHeight-9)+'px';buttons.find(b=>b.dataset.paper===select.value)?.focus();}
  trigger.onclick=()=>menu.hidden?open():close();
  trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();open();}};
  menu.onkeydown=e=>{e.stopPropagation();const index=buttons.indexOf(document.activeElement);let next;if(e.key==='ArrowDown')next=(index+1)%buttons.length;if(e.key==='ArrowUp')next=(index-1+buttons.length)%buttons.length;if(e.key==='Home')next=0;if(e.key==='End')next=buttons.length-1;if(next!==undefined){e.preventDefault();buttons[next].focus();}if(e.key==='Escape'){e.preventDefault();close(true);}if(e.key==='Tab'){close();trigger.focus();}};
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!trigger.contains(e.target))close();});
  document.addEventListener('focusin',e=>{if(!menu.contains(e.target)&&!trigger.contains(e.target))close();});
  window.addEventListener('resize',()=>close());document.addEventListener('scroll',e=>{if(!menu.contains(e.target))close();},true);
  select.addEventListener('change',sync);window.refreshPaperPicker=()=>{sync();close();};sync();
})();
