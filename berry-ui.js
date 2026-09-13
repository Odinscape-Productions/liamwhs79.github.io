/* Berry Haven HD interface layer. Keeps controls as real HTML/CSS while giving them the new glossy visual language. */
(function(){
const css=`
:root{--bh-glass:rgba(36,16,37,.72);--bh-glass-2:rgba(70,27,58,.58);--bh-line:rgba(255,194,220,.18);--bh-pink:#f06f9e;--bh-rose:#d84e7b;--bh-cream:#fff4ed;--bh-deep:#25101f;--bh-shadow:0 18px 44px rgba(25,6,19,.28);--bh-softshadow:0 8px 24px rgba(25,6,19,.2)}
body:not(.safe-mode){background-attachment:fixed}
.panel,.card,.store-shell,.gamepane,.profile-panel,.modal-card{border:1px solid var(--bh-line)!important;box-shadow:var(--bh-softshadow)!important;backdrop-filter:blur(18px) saturate(1.12);-webkit-backdrop-filter:blur(18px) saturate(1.12)}
button,.button,.primary,.soft{transition:transform .16s ease,box-shadow .16s ease,filter .16s ease,border-color .16s ease}
button:active,.button:active{transform:scale(.975)}
button.primary,.primary:not(input),button:not(.soft):not(.round):not(.home-orb):not([class*="tab"]){box-shadow:0 8px 20px rgba(190,54,104,.16)}
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid rgba(247,126,170,.32)!important;outline-offset:2px}
.bh-svg-icon{width:1.25em;height:1.25em;display:block;overflow:visible;filter:drop-shadow(0 2px 5px rgba(127,25,77,.18))}
.auth-logo{width:76px!important;height:76px!important;margin:0 auto 8px!important;border-radius:24px!important;overflow:hidden!important;box-shadow:0 14px 32px rgba(182,42,99,.32)!important}.auth-logo img{width:100%;height:100%;object-fit:cover;display:block}
.bottomnav button b{display:grid!important;place-items:center;width:28px;height:28px;margin:auto;color:currentColor}
.bottomnav .bh-svg-icon{width:24px;height:24px}
.bottomnav .home-orb b{width:46px;height:46px;border-radius:50%;background:radial-gradient(circle at 34% 26%,#ffb3ce,#ef618e 46%,#a63063 100%);color:#fff;box-shadow:0 10px 25px rgba(185,42,99,.38),inset 0 1px 0 rgba(255,255,255,.52)}
.bottomnav .home-orb .bh-svg-icon{width:27px;height:27px;filter:drop-shadow(0 2px 4px rgba(87,11,47,.34))}
[data-berry-safe-toggle],.berry-safe-toggle{box-shadow:0 10px 28px rgba(199,55,111,.3)!important;border:1px solid rgba(255,255,255,.28)!important;background:radial-gradient(circle at 35% 25%,#ffb8d0,#f16698 50%,#ac2d65)!important}
.game-selector button{min-width:116px;overflow:hidden;position:relative;padding-top:10px!important}
.game-selector button .bh-game-tab-art{width:54px;height:54px;border-radius:17px;display:block;margin:0 auto 5px;box-shadow:0 7px 17px rgba(29,8,25,.22)}
.game-mode-art{width:62px!important;height:62px!important;display:grid!important;place-items:center!important;border-radius:20px!important;overflow:hidden!important;background:transparent!important}
.game-mode-art img{width:100%;height:100%;object-fit:cover}
.mp-game-icon-hd{width:58px;height:58px;border-radius:18px;object-fit:cover;box-shadow:0 9px 22px rgba(29,8,25,.22);flex:0 0 auto}
.profile-avatar img,.profile-avatar-art img,.profile-art-img{width:100%;height:100%;object-fit:cover;display:block}
.profile-avatar,.profile-art{overflow:hidden}
.berrymoji-art.hd-image{background:none!important;border:0!important;box-shadow:none!important}
.berrymoji-art.hd-image img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 7px 12px rgba(65,13,43,.18))}
.berrymoji-btn:has(.hd-image){background:linear-gradient(145deg,rgba(255,255,255,.72),rgba(255,222,235,.46))!important;border:1px solid rgba(227,116,157,.22)!important}
/* Talks becomes a true fixed workspace; only the thread itself scrolls. */
.page.active.talks-page{position:fixed!important;inset:0 0 calc(var(--nav-h,74px) + env(safe-area-inset-bottom,0px)) 0!important;padding:10px 10px 8px!important;overflow:hidden!important;z-index:8}
.talks-static-shell{height:100%!important;min-height:0!important;grid-template-rows:auto minmax(0,1fr) auto!important;gap:7px!important;max-width:900px!important;margin:0 auto!important}
.talks-static-head{padding:9px 11px!important;border-radius:18px!important}
.talks-title-row h2{font-size:1.02rem!important;margin:0!important}.talks-title-row p{display:none!important}.talks-title-row{min-height:34px!important}
.talks-partner-row{margin-top:4px!important}.talks-checkin-grid{margin-top:5px!important;grid-template-columns:1fr 1fr!important;gap:6px!important}.talks-checkin-card{padding:7px 8px!important;min-height:0!important}.talks-checkin-card small{font-size:.67rem!important}.talks-checkin-card button{padding:7px 8px!important}
.talks-thread{min-height:0!important;height:auto!important;overflow-y:auto!important;overscroll-behavior:contain;padding:9px!important;border-radius:19px!important}
.talks-composer{position:relative!important;bottom:auto!important;padding:7px!important;margin:0!important}.composer-v3{margin:0!important}.composer-v3 input{min-width:0!important}
/* Store uses the viewport like a native full-screen browser. */
#prizeGarden.page.active{position:fixed!important;inset:0 0 calc(var(--nav-h,74px) + env(safe-area-inset-bottom,0px)) 0!important;padding:7px!important;overflow:hidden!important;z-index:9}
#prizeGarden .store-shell{height:100%!important;max-width:980px!important;margin:auto!important;border-radius:24px!important;display:grid!important;grid-template-rows:auto auto auto minmax(0,1fr)!important;overflow:hidden!important;padding:10px!important}
#prizeGarden .store-hero{padding:5px 6px 8px!important}#prizeGarden .store-hero p{display:none!important}#prizeGarden .store-hero h2{font-size:1.15rem!important;margin:2px 0!important}
#prizeGarden .store-wallet-row{gap:7px!important}.store-wallet{padding:8px 10px!important}.store-wallet strong{font-size:1.12rem!important}.currency-tabs{margin:7px 0!important}
#prizeGarden .store-viewport{min-height:0!important;height:100%!important;overflow:hidden!important}.store-pane{height:100%!important;min-height:0!important;display:grid!important;grid-template-rows:auto auto minmax(0,1fr)!important}.store-scroll-area{min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain;padding-bottom:18px!important}.store-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}.store-grid>button,.store-grid>.store-card{min-height:156px!important;padding:12px!important;border-radius:20px!important}
@media(min-width:650px){.store-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.talks-checkin-grid{grid-template-columns:1fr 1fr!important}}
/* Auth and modals */
.auth-card,.store-detail-card{box-shadow:0 30px 80px rgba(22,5,18,.42)!important;border:1px solid rgba(255,190,218,.23)!important;backdrop-filter:blur(24px) saturate(1.18)}
`;
const s=document.createElement('style');s.id='berryHdUiStyle';s.textContent=css;document.head.appendChild(s);
function setIcon(el,name){if(el&&window.BerryIcons)el.innerHTML=window.BerryIcons.svg(name)}
function apply(){
 const ai=window.getBerryBrandAsset?.('appIcon');const al=document.querySelector('.auth-logo');if(ai&&al)al.innerHTML=`<img src="${ai}" alt="Berry Haven">`;
 const nav={talk:'talks',middle:'boundaries',home:'home',fourth:'planner',spicy:'adult',more:'more'};
 Object.entries(nav).forEach(([k,v])=>setIcon(document.querySelector(`[data-v3nav="${k}"] b`),v));
 document.querySelectorAll('[data-open-store]').forEach(b=>{if(!b.dataset.hdIcon){b.dataset.hdIcon='1';b.insertAdjacentHTML('afterbegin',window.BerryIcons?window.BerryIcons.svg('store','inline'):'' )}});
 const tabs={pairs:'pairs',words:'words',four:'four',colour:'colour',farm:'farm'};
 Object.entries(tabs).forEach(([k,id])=>{const b=document.querySelector(`[data-game="${k}"]`);const a=window.getBerryGameArt?.(id);if(b&&a){const span=b.querySelector('span');if(span){span.innerHTML=`<img class="bh-game-tab-art" src="${a.src}" alt="">`}}});
 const banners=[['gamePairs','pairs'],['gameWords','words'],['gameFour','four'],['gameColour','colour'],['gameFarm','farm']];
 banners.forEach(([pid,id])=>{const p=document.getElementById(pid),a=window.getBerryGameArt?.(id);const art=p?.querySelector('.game-mode-art');if(art&&a)art.innerHTML=`<img src="${a.src}" alt="">`});
 const mp=[['ttt','ttt'],['connect','connect'],['rps','rps'],['rescue','rescue'],['signal','signal'],['trails','trails']];
 mp.forEach(([mode,id])=>{const b=document.querySelector(`[data-mp-start="${mode}"]`);const a=window.getBerryGameArt?.(id);if(b&&a&&!b.querySelector('.mp-game-icon-hd')){const old=b.querySelector('.mp-card-art,.mp-game-art,span');if(old)old.outerHTML=`<img class="mp-game-icon-hd" src="${a.src}" alt="">`;else b.insertAdjacentHTML('afterbegin',`<img class="mp-game-icon-hd" src="${a.src}" alt="">`)}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
window.applyBerryHdAssets=apply;
})();



/* Beta 1.0: game styling moved to berry-games.css; mobile rendering hotfix moved to external CSS. */
