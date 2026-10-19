import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "You are offline | Sauti Salama",
};

/*
 * Shown by the service worker when a page cannot be reached. Only this HTML is kept for offline use (not the app's
 * stylesheets or scripts), so the page carries its own styles, drawing and behaviour and needs nothing else to look
 * right with no connection.
 */
const CSS = `
.off{--ink:#0B2228;--soft:#4b6368;--teal:#068297;--tint:#D7EBE9;--card:rgba(255,255,255,.82);--line:rgba(6,130,151,.16);
position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto;color:var(--ink);
font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
background:radial-gradient(1100px 600px at 15% -10%,#d7ebe9 0,transparent 60%),radial-gradient(900px 500px at 100% 110%,#fff1d9 0,transparent 55%),#f6fbfb}
.off *{box-sizing:border-box}
.off-card{width:100%;max-width:440px;text-align:center;background:var(--card);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
border:1px solid var(--line);border-radius:28px;padding:36px 28px 28px;box-shadow:0 1px 2px rgba(11,34,40,.05),0 24px 60px -24px rgba(6,130,151,.35)}
.off-art{width:168px;height:168px;margin:0 auto 18px;display:block}
.off-art .wave{fill:none;stroke:var(--teal);stroke-width:7;stroke-linecap:round;transform-origin:84px 100px;animation:off-breathe 3.2s ease-in-out infinite}
.off-art .w2{animation-delay:.35s;opacity:.7}.off-art .w3{animation-delay:.7s;opacity:.4}
.off-art .dot{fill:var(--teal)}
.off-art .slash{stroke:#FC8E00;stroke-width:8;stroke-linecap:round;stroke-dasharray:140;stroke-dashoffset:140;animation:off-draw 1s .3s cubic-bezier(.3,.7,.2,1) forwards}
.off.on .slash{animation:off-undraw .5s forwards}
@keyframes off-breathe{0%,100%{transform:scale(1);opacity:var(--o,1)}50%{transform:scale(1.045);opacity:calc(var(--o,1)*.55)}}
@keyframes off-draw{to{stroke-dashoffset:0}}@keyframes off-undraw{to{stroke-dashoffset:140}}
.off h1{margin:0 0 8px;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-.02em}
.off p{margin:0;color:var(--soft);font-size:15px;line-height:1.55}
.off .sw{margin-top:6px;font-size:13px;color:#7b9195;font-style:italic}
.off-status{display:inline-flex;align-items:center;gap:8px;margin:20px 0 22px;padding:7px 14px;border-radius:999px;background:#fff;border:1px solid var(--line);font-size:13px;font-weight:600;color:var(--ink)}
.off-status i{width:9px;height:9px;border-radius:50%;background:#FC8E00;box-shadow:0 0 0 0 rgba(252,142,0,.5);animation:off-pulse 1.8s infinite}
.off.on .off-status i{background:#10b981;animation:none}
@keyframes off-pulse{70%{box-shadow:0 0 0 9px rgba(252,142,0,0)}100%{box-shadow:0 0 0 0 rgba(252,142,0,0)}}
.off-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.off button{font:inherit;font-weight:600;font-size:15px;border-radius:14px;padding:12px 22px;cursor:pointer;border:1px solid transparent;transition:transform .12s,background .15s}
.off button:active{transform:scale(.97)}
.off .primary{background:var(--teal);color:#fff}.off .primary:hover{background:#056a7c}
.off .ghost{background:transparent;color:var(--ink);border-color:var(--line)}.off .ghost:hover{background:#fff}
.off .primary[disabled]{opacity:.7;cursor:progress}
.off-note{margin-top:22px;padding-top:18px;border-top:1px dashed var(--line);font-size:13px;color:#6a8388;line-height:1.5}
@media (prefers-color-scheme:dark){
.off{--ink:#e8f3f4;--soft:#9db6ba;--card:rgba(16,40,46,.8);--line:rgba(120,200,210,.18);background:radial-gradient(1000px 600px at 10% -10%,#0f3a43 0,transparent 60%),#07181c}
.off-status{background:rgba(255,255,255,.06)}.off .ghost:hover{background:rgba(255,255,255,.07)}.off-note{color:#8aa6aa}.off .sw{color:#6f8f94}}
@media (prefers-reduced-motion:reduce){.off *{animation:none!important}.off-art .slash{stroke-dashoffset:0}}
`;

const JS = `
(function(){
  var root=document.getElementById('off'),label=document.getElementById('off-label'),btn=document.getElementById('off-retry'),busy=false;
  function back(){root.classList.add('on');label.textContent='Back online. Reopening where you were...';setTimeout(function(){location.reload()},700)}
  function check(manual){
    if(busy)return;busy=true;if(manual){btn.disabled=true;btn.textContent='Checking...'}
    var done=function(ok){busy=false;btn.disabled=false;btn.textContent='Try again';if(ok)back();else if(manual)label.textContent='Still no connection. We will keep trying.'};
    var c=new AbortController(),t=setTimeout(function(){c.abort()},6000);
    fetch('/favicon.svg?ping='+Date.now(),{cache:'no-store',signal:c.signal}).then(function(r){clearTimeout(t);done(r.ok)}).catch(function(){clearTimeout(t);done(false)});
  }
  btn.addEventListener('click',function(){check(true)});
  document.getElementById('off-back').addEventListener('click',function(){if(history.length>1)history.back();else location.href='/dashboard'});
  window.addEventListener('online',function(){check(false)});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)check(false)});
  setInterval(function(){if(!document.hidden)check(false)},8000);
})();
`;

export default function OfflinePage() {
	return (
		<main id="off" className="off" aria-live="polite">
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			<div className="off-card">
				<svg className="off-art" viewBox="0 0 168 168" role="img" aria-label="A voice signal that has lost its connection">
					<circle cx="84" cy="84" r="76" fill="#D7EBE9" opacity=".6" />
					<g>
						<path className="wave w3" style={{ ["--o" as string]: ".4" }} d="M34 100a64 64 0 0 1 100 0" />
						<path className="wave w2" style={{ ["--o" as string]: ".7" }} d="M50 108a42 42 0 0 1 68 0" />
						<path className="wave" d="M66 116a22 22 0 0 1 36 0" />
						<circle className="dot" cx="84" cy="130" r="7" />
					</g>
					<path className="slash" d="M44 44L124 132" />
				</svg>
				<h1>You&apos;re offline</h1>
				<p>Your connection dropped. Nothing is lost: Sauti Salama will pick up where you left off as soon as you&apos;re back.</p>
				<p className="sw">Hakuna mtandao kwa sasa. Tutaunganisha tena mara moja.</p>
				<div className="off-status"><i /><span id="off-label">Waiting for a connection</span></div>
				<div className="off-row">
					<button id="off-retry" type="button" className="primary">Try again</button>
					<button id="off-back" type="button" className="ghost">Go back</button>
				</div>
				<p className="off-note">Check that mobile data or Wi-Fi is on. This page checks by itself every few seconds and reopens the page you were on.</p>
			</div>
			<script dangerouslySetInnerHTML={{ __html: JS }} />
		</main>
	);
}
