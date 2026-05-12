const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { google } = require('googleapis');
const { Readable } = require('stream');

const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;

async function uploadToDrive(pngBuffer, fileName) {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });
  const stream = new Readable();
  stream.push(pngBuffer);
  stream.push(null);
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [DRIVE_FOLDER_ID], mimeType: 'image/png' },
    media: { mimeType: 'image/png', body: stream },
    fields: 'id,webViewLink',
  });
  return res.data;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  let browser;
  try {
    const { bracketHTML, userName, email } = JSON.parse(event.body || '{}');
    if (!bracketHTML) return { statusCode: 400, headers, body: JSON.stringify({ error: 'bracketHTML required' }) };

    // Correct: await executablePath() with no arguments for Netlify/Lambda
    const executablePath = await chromium.executablePath();
    
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: chromium.headless,
      defaultViewport: { width: 1400, height: 900 },
    });

    const data = typeof bracketHTML === 'string' ? JSON.parse(bracketHTML) : bracketHTML;
    const page = await browser.newPage();
    await page.setContent(buildBracketHTML(data, userName), { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    const el = await page.$('#bracket-capture');
    if (!el) throw new Error('Element #bracket-capture not found');
    const screenshot = await el.screenshot({ type: 'png' });
    await browser.close();
    browser = null;

    // Upload to Drive
    let driveLink = null;
    try {
      const safeName = (userName || 'usuario').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
      const dateStr = new Date().toISOString().split('T')[0];
      const driveFile = await uploadToDrive(screenshot, `bracket-${safeName}-${dateStr}.png`);
      driveLink = driveFile?.webViewLink || null;
    } catch (e) {
      console.error('Drive upload error (non-blocking):', e.message);
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, png: screenshot.toString('base64'), driveLink }),
    };
  } catch (err) {
    console.error('PNG function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  } finally {
    if (browser) { try { await browser.close(); } catch(e) {} }
  }
};

function buildBracketHTML(data, userName) {
  const { GRP, BK, thirdWinner } = data;
  const FL = {'México':'🇲🇽','Sudáfrica':'🇿🇦','Corea del Sur':'🇰🇷','Rep. Checa':'🇨🇿','Canadá':'🇨🇦','Bosnia y Herz.':'🇧🇦','Qatar':'🇶🇦','Suiza':'🇨🇭','Brasil':'🇧🇷','Marruecos':'🇲🇦','Haití':'🇭🇹','Escocia':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','EE.UU.':'🇺🇸','Paraguay':'🇵🇾','Australia':'🇦🇺','Türkiye':'🇹🇷','Alemania':'🇩🇪','Curazao':'🇨🇼','C. de Marfil':'🇨🇮','Ecuador':'🇪🇨','Países Bajos':'🇳🇱','Japón':'🇯🇵','Suecia':'🇸🇪','Túnez':'🇹🇳','Bélgica':'🇧🇪','Egipto':'🇪🇬','Irán':'🇮🇷','Nueva Zelanda':'🇳🇿','España':'🇪🇸','Cabo Verde':'🇨🇻','Arabia Saudita':'🇸🇦','Uruguay':'🇺🇾','Francia':'🇫🇷','Senegal':'🇸🇳','Iraq':'🇮🇶','Noruega':'🇳🇴','Argentina':'🇦🇷','Argelia':'🇩🇿','Austria':'🇦🇹','Jordania':'🇯🇴','Portugal':'🇵🇹','RD Congo':'🇨🇩','Uzbekistán':'🇺🇿','Colombia':'🇨🇴','Inglaterra':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Croacia':'🇭🇷','Ghana':'🇬🇭','Panamá':'🇵🇦'};
  const f = n => FL[n] || '🏳️';
  const mk = () => ({t1:null,t2:null,w:null});
  const r32=BK?.r32||[],r16=BK?.r16||[],qf=BK?.qf||[],sf=BK?.sf||[],fin=BK?.fin?.[0]||mk();
  const champ=fin.w||null;
  const sf0=sf[0]||mk(),sf1=sf[1]||mk();
  const sf0l=sf0.w?(sf0.t1===sf0.w?sf0.t2:sf0.t1):null;
  const sf1l=sf1.w?(sf1.t1===sf1.w?sf1.t2:sf1.t1):null;
  const dateStr=new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'});

  function tc(team,isW,isL){
    if(!team)return`<div class="tc tbd"><span class="tf">🏳</span><span class="tn">-</span></div>`;
    return`<div class="tc${isW?' tw':''}${isL?' tl':''}"><span class="tf">${f(team)}</span><span class="tn">${team}</span>${isW?'<span class="wi">✓</span>':''}</div>`;
  }
  function mc(m,isFin){m=m||mk();const w=m.w;return`<div class="match${isFin?' mfin':''}">${tc(m.t1,w&&w===m.t1,w&&w!==m.t1)}${tc(m.t2,w&&w===m.t2,w&&w!==m.t2)}</div>`;}
  function col(arr,lbl,from,to){return`<div class="rcol"><div class="rlbl">${lbl}</div><div class="rms">${arr.slice(from,to+1).map(m=>mc(m)).join('')}</div></div>`;}
  function sep(n){return`<div class="sep">${Array(n).fill('<div class="sl"></div>').join('')}</div>`;}

  return`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f4f7fb;font-family:'DM Sans',sans-serif}
#bracket-capture{width:1400px;background:#f4f7fb;padding:24px 28px 20px}
.hdr{text-align:center;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #001F3F}
.hdr-logo{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#001F3F;letter-spacing:.08em}
.hdr-logo span{color:#FF5733}
.hdr-sub{font-size:11px;color:#5a6a7e;margin-top:2px}
.user-tag{display:inline-block;background:rgba(255,87,51,0.1);border:1px solid rgba(255,87,51,0.3);
  color:#FF5733;font-size:10px;font-weight:600;padding:2px 10px;border-radius:12px;margin-top:4px}
.bracket{display:flex;align-items:center}
.side{display:flex;flex:1}
.sl2{flex-direction:row}.sr{flex-direction:row-reverse}
.center{min-width:185px;flex-shrink:0;padding:0 8px;text-align:center}
.rcol{display:flex;flex-direction:column;flex:1;min-width:128px}
.rlbl{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#7a8899;
  text-align:center;padding:4px;background:#e8edf5;border:1px solid #dde3ec;
  border-radius:4px;margin-bottom:7px;font-weight:600}
.rms{display:flex;flex-direction:column;justify-content:space-around;flex:1;gap:4px}
.sep{display:flex;flex-direction:column;justify-content:space-around;width:11px;flex-shrink:0;padding-top:21px}
.sl{flex:1;border-right:1px solid #c8d0dc;margin:3px 0}
.match{background:#fff;border:1px solid #dde3ec;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,31,63,0.06)}
.mfin{border:2px solid #f0c040;box-shadow:0 0 12px rgba(240,192,64,0.2)}
.tc{display:flex;align-items:center;gap:4px;padding:5px 7px;font-size:10.5px;font-weight:500;color:#1a2535}
.tc+.tc{border-top:1px solid #edf0f5}
.tc.tw{background:#fffbeb;color:#92400e;font-weight:700}
.tc.tl{opacity:0.28}
.tc.tbd{color:#aab4c0;font-style:italic}
.tf{font-size:12px;width:15px;text-align:center;flex-shrink:0}
.tn{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10.5px}
.wi{width:11px;height:11px;background:#f0c040;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:7px;color:#001F3F;font-weight:700;flex-shrink:0}
.fin-lbl{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#7a8899;margin-bottom:5px;font-weight:600}
.champ{background:#fffbeb;border:2px solid #fcd34d;border-radius:10px;padding:10px 14px;
  text-align:center;margin:7px 0;box-shadow:0 0 14px rgba(240,192,64,0.2)}
.cf{font-size:28px;margin-bottom:2px}
.cl{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#a16207;font-weight:600}
.cn{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#92400e;letter-spacing:.04em;line-height:1}
.third{background:#fef5ec;border:1px solid #fdba74;border-radius:6px;padding:7px 10px;margin-top:7px}
.thlbl{font-size:8px;text-transform:uppercase;color:#9a3412;font-weight:600;margin-bottom:3px}
.thval{font-size:11px;font-weight:600;color:#9a3412}
.footer{text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #dde3ec;font-size:10px;color:#9aacbe}
.footer b{color:#001F3F}
</style></head><body>
<div id="bracket-capture">
<div class="hdr">
  <div class="hdr-logo">UPRO<span>STATS</span> · Simulador Mundial 2026</div>
  <div class="hdr-sub">FIFA World Cup 2026 · 11 Jun – 19 Jul · EEUU · México · Canadá</div>
  ${userName?`<div class="user-tag">${userName}</div>`:''}
</div>
<div class="bracket">
  <div class="side sl2">
    ${col(r32,'Ronda de 32',0,7)}${sep(16)}
    ${col(r16,'Octavos',0,3)}${sep(8)}
    ${col(qf,'Cuartos',0,1)}${sep(4)}
    ${col(sf,'Semi',0,0)}${sep(2)}
  </div>
  <div class="center">
    <div class="fin-lbl">FINAL · 19 Jul · Nueva York</div>
    ${mc(fin,true)}
    <div class="champ">
      <div class="cf">${champ?f(champ):'🏆'}</div>
      <div class="cl">Campeón</div>
      <div class="cn">${champ||'Por definir'}</div>
    </div>
    ${(sf0l||sf1l)?`<div class="third">
      <div class="thlbl">3er Puesto</div>
      <div class="thval">${thirdWinner?f(thirdWinner)+' '+thirdWinner:(sf0l&&sf1l?f(sf0l)+' '+sf0l+' vs '+f(sf1l)+' '+sf1l:'Por definir')}</div>
    </div>`:''}
  </div>
  <div class="side sr">
    ${col(r32,'Ronda de 32',8,15)}${sep(16)}
    ${col(r16,'Octavos',4,7)}${sep(8)}
    ${col(qf,'Cuartos',2,3)}${sep(4)}
    ${col(sf,'Semi',1,1)}${sep(2)}
  </div>
</div>
<div class="footer">Generado en <b>mundial.uprostats.com</b> · ${dateStr}</div>
</div></body></html>`;
}
