/* Berry Haven animated profile effects. Keeps image art in berry-profiles.js. */
window.BERRY_ANIMATED_PROFILES={"velvet-noir":{"motion":"velvet","label":"Velvet glow"},"nurse-rose":{"motion":"bubble","label":"Aqua pulse"},"luna-rabbit":{"motion":"orbit","label":"Moon orbit"},"royal-garden":{"motion":"royal","label":"Royal shimmer"},"midnight-suit":{"motion":"neon","label":"Neon pulse"},"pastel-bunny":{"motion":"float","label":"Pastel float"}};
window.getBerryAnimatedProfile=function(id){return (window.BERRY_ANIMATED_PROFILES||{})[id]||null};
(function(){
  if(document.getElementById('berryAnimatedProfileStyles')) return;
  const s=document.createElement('style');s.id='berryAnimatedProfileStyles';
  s.textContent=String.raw`
.profile-avatar-art.is-animated-profile{position:relative;isolation:isolate;overflow:hidden;transform:translateZ(0)}
.profile-avatar-art.is-animated-profile img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;display:block}
.profile-avatar-art.is-animated-profile::before,.profile-avatar-art.is-animated-profile::after{content:"";position:absolute;pointer-events:none;z-index:2}
.profile-avatar-art.motion-float{animation:bhProfileFloat 4s ease-in-out infinite}
.profile-avatar-art.motion-float::after{inset:7%;border-radius:24%;border:1px solid rgba(255,255,255,.58);box-shadow:0 0 22px rgba(238,153,204,.35);animation:bhProfileHalo 2.4s ease-in-out infinite}
.profile-avatar-art.motion-velvet{animation:bhProfileVelvet 4.8s ease-in-out infinite}
.profile-avatar-art.motion-velvet::before{inset:-30%;background:conic-gradient(from 0deg,transparent,rgba(255,112,182,.26),transparent 38%,rgba(190,112,255,.2),transparent 72%);animation:bhProfileSpin 7s linear infinite}
.profile-avatar-art.motion-bubble::after{width:18px;height:18px;border-radius:50%;right:7px;bottom:7px;background:rgba(176,247,255,.66);box-shadow:-21px -22px 0 -4px rgba(205,250,255,.48),7px -37px 0 -6px rgba(255,255,255,.78);animation:bhProfileBubble 3.1s ease-in-out infinite}
.profile-avatar-art.motion-orbit::before{inset:5%;border-radius:50%;border:1px dashed rgba(255,232,144,.8);animation:bhProfileSpin 8s linear infinite}
.profile-avatar-art.motion-orbit::after{width:8px;height:8px;border-radius:50%;left:50%;top:2%;background:#fff3a9;box-shadow:0 0 14px #fff3a9;animation:bhProfileTwinkle 1.6s ease-in-out infinite}
.profile-avatar-art.motion-royal::before{inset:-45% -15%;background:linear-gradient(110deg,transparent 35%,rgba(255,244,174,.62) 49%,transparent 63%);transform:translateX(-70%);animation:bhProfileShimmer 3.4s ease-in-out infinite}
.profile-avatar-art.motion-neon{box-shadow:0 0 0 1px rgba(106,238,255,.22),0 0 16px rgba(98,129,255,.25);animation:bhProfileNeon 2.6s ease-in-out infinite}
.profile-avatar-art.motion-neon::after{left:6%;right:6%;height:2px;top:18%;background:linear-gradient(90deg,transparent,#7af5ff,transparent);box-shadow:0 0 8px #7af5ff;animation:bhProfileScan 2.8s linear infinite}
@keyframes bhProfileFloat{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4px) rotate(.7deg)}}
@keyframes bhProfileHalo{0%,100%{opacity:.35;transform:scale(.96)}50%{opacity:1;transform:scale(1.03)}}
@keyframes bhProfileVelvet{0%,100%{filter:saturate(1) brightness(1)}50%{filter:saturate(1.08) brightness(1.07)}}
@keyframes bhProfileSpin{to{transform:rotate(360deg)}}
@keyframes bhProfileBubble{0%,100%{transform:translateY(4px);opacity:.45}50%{transform:translateY(-8px);opacity:1}}
@keyframes bhProfileTwinkle{0%,100%{opacity:.35;transform:scale(.72)}50%{opacity:1;transform:scale(1.28)}}
@keyframes bhProfileShimmer{0%,30%{transform:translateX(-70%) rotate(6deg);opacity:0}50%{opacity:1}70%,100%{transform:translateX(70%) rotate(6deg);opacity:0}}
@keyframes bhProfileNeon{0%,100%{box-shadow:0 0 0 1px rgba(106,238,255,.18),0 0 12px rgba(98,129,255,.20)}50%{box-shadow:0 0 0 1px rgba(255,110,206,.34),0 0 24px rgba(255,72,192,.34)}}
@keyframes bhProfileScan{0%{top:10%;opacity:0}12%{opacity:1}85%{opacity:1}100%{top:90%;opacity:0}}
@media (prefers-reduced-motion:reduce){.profile-avatar-art.is-animated-profile{animation:none!important}.profile-avatar-art.is-animated-profile::before,.profile-avatar-art.is-animated-profile::after{animation:none!important}}
`;
  document.head.appendChild(s);
})();
