/* Berry Haven Beta 1.0 - CSS-first theme controller.
   JavaScript only selects the theme and wallpaper. CSS owns animation. */
(function(){
  const colourMap={
    'berry-classic':['#8e3156','#22101d','#ffd7e3'],
    'honey-bear':['#d99a45','#5b371f','#ffd878'],
    'medical-hearts':['#438da8','#153452','#b9f7ff'],
    'bunny-contrast':['#725bb0','#1b1735','#e2d9ff'],
    'enchanted-garden':['#b24871','#244530','#ffe0b8'],
    'mooncloud':['#756bb9','#1b1735','#dcd8ff'],
    'sparkle-berry':['#7452a9','#17152f','#e1d5ff'],
    'midnight-arcade':['#9d39c0','#0b1730','#7ee9ff'],
    'cherry-velvet':['#982649','#250a16','#ffb0c6'],
    'lavender-milk':['#a28ac8','#4c385f','#f6eaff'],
    'peach-blush':['#d47d83','#54312f','#ffe1d5'],
    'sage-sweet':['#7f9b73','#2c4534','#e8f6d6'],
    'blueberry-fizz':['#6574bd','#172040','#cdd8ff']
  };
  function sceneMarkup(){
    return '<div class="bh-theme-css-scene"><div class="bh-theme-wallpaper-base"></div><div class="bh-theme-atmos"></div><div class="bh-theme-depth"></div><div class="bh-theme-light"></div></div>';
  }
  function render(id,safe,target){
    if(!target)return false;
    id=id||'berry-classic';
    const mode=safe?'little':'adult';
    const key=id+':'+mode;
    const preview=window.getBerryThemePreview?.(id)||'';
    const cols=colourMap[id]||colourMap['berry-classic'];
    if(target.dataset.cssThemeKey!==key){
      target.innerHTML=sceneMarkup();
      target.dataset.cssThemeKey=key;
    }
    target.dataset.theme=id;
    target.dataset.space=mode;
    target.className='theme-wallpaper theme-'+id;
    target.style.setProperty('--bh-wallpaper',preview?`url("${preview}")`:'none');
    target.style.setProperty('--bh-tint-a',cols[0]);
    target.style.setProperty('--bh-tint-b',cols[1]);
    target.style.setProperty('--bh-fx',cols[2]);
    return true;
  }
  window.BerryThemeController={render};
})();
