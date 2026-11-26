// Moteur d'analyse des relevés de switchs, repris tel quel de « Cartographie Réseau v3.2 »
// (cœur : CartoCore). Ne pas modifier ici : remplacer le bloc entier par une nouvelle version.
(function (root) {
  'use strict';

  const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/;
  const MAC_SRC = '\\b(?:[0-9a-f]{4}([.\\-])[0-9a-f]{4}\\1[0-9a-f]{4}|[0-9a-f]{2}(?:[:\\-][0-9a-f]{2}){5}|[0-9a-f]{6}-[0-9a-f]{6})\\b';

  /* ---------- utilitaires ---------- */
  function normMac(s) {
    const h = String(s || '').toLowerCase().replace(/[^0-9a-f]/g, '');
    return h.length === 12 ? h : '';
  }
  function fmtMac(h) { return h && h.length === 12 ? h.match(/../g).join(':') : (h || ''); }
  function isMulticast(h) { return (parseInt(h.slice(0, 2), 16) & 1) === 1; }
  function isLocalAdmin(h) { return (parseInt(h.slice(0, 2), 16) & 2) === 2; }
  function macFromName(n) {
    const m = String(n || '').toLowerCase().match(/(?:^|[^0-9a-f])([0-9a-f]{12})(?:[^0-9a-f]|$)/);
    return m ? m[1] : '';
  }
  function normName(n) {
    let s = String(n || '').trim().toLowerCase();
    if (!s) return '';
    s = s.replace(/\(.*\)$/, '');
    if (!IPV4.test(s)) s = s.split('.')[0];
    return s.trim();
  }
  let _uid = 0;
  function uid() { _uid++; return 's' + Date.now().toString(36) + _uid.toString(36) + Math.random().toString(36).slice(2, 6); }

  const PORT_RULES = [
    [/^(10GigabitEthernet|10GigE|10G)(?=\d)/i, 'Te'],
    [/^(2\.5GigabitEthernet|2\.5G)(?=\d)/i, 'Tw'],
    [/^(5GigabitEthernet)(?=\d)/i, 'Fi'],
    [/^(TwentyFiveGigE|TwentyFiveGigabitEthernet|Twe)(?=\d)/i, 'Twe'],
    [/^(TenGigabitEthernet|TenGigE|Ten|Te)(?=\d)/i, 'Te'],
    [/^(TwoGigabitEthernet|Tw)(?=\d)/i, 'Tw'],
    [/^(FortyGigabitEthernet|FortyGigE|Fo)(?=\d)/i, 'Fo'],
    [/^(HundredGigE|HundredGigabitEthernet|Hu)(?=\d)/i, 'Hu'],
    [/^(GigabitEthernet|Gig|Gi)(?=\d)/i, 'Gi'],
    [/^(FastEthernet|Fas|Fa)(?=\d)/i, 'Fa'],
    [/^(Port-channel|Po)(?=\d)/i, 'Po'],
    [/^(Ethernet|Eth)(?=\d)/i, 'Eth']
  ];
  function shortPort(p) {
    if (!p) return '';
    const s = String(p).trim().replace(/\s+/g, '');
    for (const [re, r] of PORT_RULES) if (re.test(s)) return s.replace(re, r);
    return s;
  }
  function isPortTok(t) {
    t = String(t || '').replace(/^(?:10|2\.5|5)(?=Gig)/i, '');
    return /^(?:(?:2\.5|5|10)(?=GigabitEthernet))?(?:Gi|Te|Fa|Twe|Tw|Fo|Hu|Eth|GigabitEthernet|TenGigabitEthernet|FastEthernet|TwoGigabitEthernet|TwentyFiveGigE|FortyGigabitEthernet|HundredGigE|Ethernet|ge|xe|xg|fe|g|Po|Port-channel|Trk|lag|ch|port)-?\d+(?:\/\d+){0,3}$/i.test(t)
      || /^\d+\/\d+(?:\/\d+)?$/.test(t)
      || /^(?:ether|sfp|sfp-sfpplus|sfp28-|qsfp\d*-|qsfpplus|combo|wlan|bond)[\w\-]*\d$/i.test(t);
  }
  function isPortLike(t) { return !!t && (isPortTok(t) || /^[A-Z]{0,2}\d{1,3}$/i.test(t) || /^Trk\d+$/i.test(t)); }
  function portSortKey(p) {
    const pre = (String(p).match(/^[A-Za-z\-]*/) || [''])[0];
    const nums = (String(p).match(/\d+/g) || []).map(n => ('0000' + n).slice(-4)).join('.');
    const order = { '': 0, Fa: 1, Gi: 2, Tw: 3, Te: 4, Twe: 5, Fo: 6, Hu: 7, Eth: 8, Po: 9, Trk: 9 };
    return String(order[pre] != null ? order[pre] : 5) + '|' + pre + '|' + nums;
  }
  function mediaOf(t) {
    t = String(t || '');
    if (/SFP|SX|LX|LH|ZX|BX|LR\b|SR\b|Fib(re|er)|1000Base-?[LSBZ]|10GBase-?[LSE]/i.test(t)) return 'fibre';
    if (/BaseTX|BaseT\b|GbT|\d+T\b|RJ45|10\/100/i.test(t)) return 'cuivre';
    return '';
  }

  /* ---------- capacités LLDP/CDP ---------- */
  function normCaps(str, lldp) {
    const out = new Set();
    str = String(str || '');
    if (/\([+-]\)/.test(str)) str = str.split(',').filter(x => /\(\+\)/.test(x)).map(x => x.replace(/\([+-]\)/g, '').replace(/\s+only$/i, '-only').replace(/\s+/g, '-')).join(',');
    String(str || '').split(/[\s,;\/]+/).filter(Boolean).forEach(w0 => {
      const w = w0.toLowerCase();
      if (/^(r|router)$/.test(w)) out.add('router');
      else if (lldp && w === 's') out.add('host');          // LLDP (Cisco) : S = Station, pas Switch
      else if (/^(s|switch)$/.test(w)) out.add('switch');
      else if (/^(b|bridge|trans-bridge|t|source-route-bridge)$/.test(w)) out.add('bridge');
      else if (/^(h|host|station|sta|station-only)$/.test(w)) out.add('host');
      else if (/^(p|phone|telephone)$/.test(w)) out.add('phone');
      else if (/^(w|wlan|wlan-access-point|ap)$/.test(w)) out.add('ap');
    });
    return [...out];
  }

  /* ---------- détection constructeur ---------- */
  function detectVendor(t) {
    if (/^###\s+\/(?:system|interface|ip)\b/m.test(t) || (/^\s*(?:board-name|routerboard):\s/m.test(t) && /RouterOS|without-paging|Columns:/.test(t))) return 'mikrotik';
    const score = { cisco: 0, arubacx: 0, hp: 0, netgear: 0, planet: 0, comware: 0 };
    if (/\bARPA\b/.test(t)) score.cisco++;
    if (/Mac Address Table/.test(t)) score.cisco++;
    if (/^\s*Device ID\s*:/m.test(t)) score.cisco++;
    if (/Port\s+Name\s+Status\s+Vlan\s+Duplex/.test(t)) score.cisco += 2;
    if (/^\s*PID:\s*(WS-C|C9|IE-|ISR|C1000)/m.test(t)) score.cisco += 2;
    if (/Port\s+Native\s+Mode/i.test(t)) score.arubacx += 2;
    if (/^\s*Neighbor Chassis-Name\s*:/m.test(t)) score.arubacx += 2;
    if (/^\s*Product Name\s+:/m.test(t)) score.arubacx++;
    if (/ArubaOS-CX|AOS-CX/.test(t) && !/^\s*Device ID\s*:/m.test(t)) score.arubacx++;
    if (/^\s*Local Port\s+:/m.test(t)) score.hp += 2;
    if (/\|\s*Alert/.test(t)) score.hp += 2;
    if (/MAC Address\s+Port\s+VLAN/i.test(t)) score.hp++;
    if (/Software revision\s*:/i.test(t)) score.hp++;
    if (/Machine Model|NETGEAR/.test(t)) score.netgear += 2;
    if (/PLANET/.test(t)) score.planet += 2;
    if (/^\s*Port\s*:\s*(?:GE|XG|FE)\d+\s*$/m.test(t) || /\|\s*Management\s*\|\s*CPU/.test(t) || /Welcome to Layer 2 Managed Switch/.test(t)) score.planet += 2;
    if (/Layer 2 Managed|1\.3\.6\.1\.4\.1\.10456\b/.test(t)) score.planet += 3;
    if (/ComNet|COMNET|\bCN(GE|GS|FE|WGE)[0-9A-Z+]+/.test(t) && !/^\s*Device ID\s*:/m.test(t)) score.comnet = (score.comnet || 0) + 3;
    // HP 1910/1920, H3C, HPE Comware : CLI « display », prompt <NOM>
    if (/Comware (?:Platform )?Software|HPE? Comware|\bH3C\b|Versatile Routing Platform/.test(t) && !/^\s*Device ID\s*:/m.test(t)) score.comware += 3;
    if (/^\s*The brief information of interface\(s\)/m.test(t) || /^\s*LLDP neighbor-information of port/m.test(t)) score.comware += 2;
    let best = 'generic', bv = 0;
    for (const k in score) if (score[k] > bv) { bv = score[k]; best = k; }
    return best;
  }

  /* Modèles reconnus par leur OID SNMP (show info des Planet, qui ne donne pas le modèle). Confirmé : 10456.1.1530 sur .101 et .102 */
  const OID_MODELE = { '1.3.6.1.4.1.10456.1.1530': 'GS-5220-16S8CR', '1.3.6.1.4.1.10456.9.24': 'IGS-4215-4P4T2S' };
  /* ---------- identité du switch ---------- */
  function parseIdentity(text) {
    const id = { name: '', model: '', serial: '', ips: [], macs: [], routing: null, defaultGw: '' };
    let m;
    if ((m = text.match(/^([A-Za-z0-9][\w.\- ]{1,62}?) ?[#>]\s*(?:sh(?:ow)?|ter(?:minal)?|no page|en(?:able)?|conf)\b/mi))) id.name = m[1].trim();
    else if ((m = text.match(/^<([A-Za-z0-9][\w.\-]{0,62})>/m))) id.name = m[1];   // Comware / Huawei : <NOM>
    else if ((m = text.match(/^hostname\s+"?([^"\s]+)"?/m))) id.name = m[1];
    else if ((m = text.match(/^\s*(?:System Name|Hostname|Host Name|System Name\.+)\s+:\s*(\S+)/mi))) id.name = m[1];
    else {
      for (const x of text.matchAll(/Key name:\s*([A-Za-z0-9][\w\-]*)\.[\w.\-]+/g)) {
        if (!/^TP-self-signed/i.test(x[1])) { id.name = x[1]; break; }
      }
    }
    const models = [
      /^\s*PID:\s*([A-Z0-9][\w\-+\/]+)/m,
      /Model number\s*:\s*(\S+)/i,
      /^\s*Product Name\s+:\s*(.+)$/m,
      /^\s*Product\s*:\s*(?:PLANET,?\s+)?([^,\n]+)/m,
      /Welcome to PLANET\s+(\S+)/i,
      /Machine Model\.*\s*(.+)$/m,
      /^\s*Model(?: Name)?\s*:\s*(.+)$/mi
    ];
    // HP / Aruba (ArubaOS-Switch) : bannière « Aruba JL258A 2930F-8G-PoE+-2SFP+ Switch »
    if ((m = text.match(/^\s*(?:Aruba|HPE?|ProCurve)\s+(J[A-Z]?\d{3,4}[A-Z])\s+(\S.*?)\s+Switch\s*$/m))) id.model = m[2].trim() + ' (' + m[1] + ')';
    if (!id.model) for (const r of models) { if ((m = text.match(r))) { id.model = m[1].trim(); break; } }
    if (!id.model && (m = text.match(/^\s*(?:PLANET\s+)?((?:SGS|XGS|GS|IGS|MGS|WGS)-[\w\-]+)\s+Software,\s*Version/mi))) id.model = m[1];   // Planet SGS-6310 (IOS-like)
    if (!id.model && (m = text.match(/Welcome to PLANET\s+(\S+)/i))) id.model = m[1];
    if (!id.model && (m = text.match(/^\s*DEVICE_NAME\s*:\s*(\S+)/mi))) id.model = m[1].replace(/^HP(?=\d)/, 'HP ');   // HP 1920 : display device manuinfo
    if (!id.model && (m = text.match(/^\s*(HP|HPE|H3C)\s+(19\d{2}[\w\-]*)\s+Switch/mi))) id.model = m[1] + ' ' + m[2];
    if (!id.model && (m = text.match(/System Object ID\s*:\s*([\d.]+)/i)) && OID_MODELE[m[1]]) id.model = OID_MODELE[m[1]];
    if (!id.model && /^(?:GS|SGS|XGS|MGS|IGS|WGS|GSD|FGSW|IGSW|WGSW|IGS)-[\w\-]+$/i.test(id.name)) id.model = id.name;
    // ComNet : prompt générique « switch> » ; le nom système (souvent le modèle) est dans show system
    if ((m = text.match(/^\s*Name:\s*(CN[A-Z0-9][\w+\-]*)\s*$/m))) { if (!id.model) id.model = m[1]; if (!id.name || /^(switch|router|default)$/i.test(id.name)) id.name = m[1]; }
    if ((m = text.match(/^\s*IP Routing\s*:\s*(Enabled|Disabled)/mi))) id.routing = /enabled/i.test(m[1]);
    if ((m = text.match(/^\s*Default Gateway\s*:\s*(\d+\.\d+\.\d+\.\d+)/mi))) id.defaultGw = m[1];
    const serials = [/\bSN:\s*([A-Z0-9]{6,})/, /System serial number\s*:\s*(\S+)/i, /(?:Chassis Serial Nbr|Serial Number|Serial #)[\s.]*:\s*(\S+)/i];
    for (const r of serials) { if ((m = text.match(r))) { id.serial = m[1].trim(); break; } }
    const ips = new Set();
    if ((m = text.match(/^\s*#\s*Relev\S*\s+Carto R\S+seau\s+-\s+(\d+\.\d+\.\d+\.\d+)/m))) ips.add(m[1]);
    for (const x of text.matchAll(/Internet address is (\d+\.\d+\.\d+\.\d+)/g)) ips.add(x[1]);
    for (const x of text.matchAll(/^\S+\s+(\d+\.\d+\.\d+\.\d+)\s+YES\s+\S+\s+(?:up|down|administratively)/gm)) ips.add(x[1]);
    for (const x of text.matchAll(/^\s*vlan\d+\s+(\d+\.\d+\.\d+\.\d+)\/\d+/gmi)) ips.add(x[1]);
    for (const x of text.matchAll(/\|\s*(?:Manual|DHCP\/Bootp)\s+(\d+\.\d+\.\d+\.\d+)/g)) ips.add(x[1]);
    id.ips = [...ips];
    const macs = new Set();
    const macHead = /(?:Base ethernet MAC Address|Switch\/Stack Mac Address|Base MAC Address|Base MAC Addr|System MAC Address|Chassis Base MAC|Burned In MAC Address)[\s.]*:?\s*([0-9a-fA-F]{2}(?:[:\-.\s]?[0-9a-fA-F]{2}){5})/gi;
    for (const x of text.matchAll(macHead)) { const h = normMac(x[1]); if (h) macs.add(h); }
    for (const x of text.matchAll(/^\s*MAC Address\s*:\s*([0-9a-fA-F]{2}(?:[:\-][0-9a-fA-F]{2}){5})\s*$/gm)) { const h = normMac(x[1]); if (h) macs.add(h); }
    for (const x of text.matchAll(/^\s*\d{1,4}\s*\|\s*([0-9A-Fa-f:\-]{17})\s*\|\s*Management\s*\|\s*CPU/gm)) { const h = normMac(x[1]); if (h) macs.add(h); }
    for (const x of text.matchAll(/address is ([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})/g)) { if (macs.size < 200) macs.add(normMac(x[1])); }
    id.macs = [...macs];
    return id;
  }

  /* ---------- CDP ---------- */
  function parseCDP(text) {
    const res = [], starts = [];
    const re = /^\s*Device ID\s*:/gm; let m;
    while ((m = re.exec(text))) starts.push(m.index);
    for (let i = 0; i < starts.length; i++) {
      const end = i + 1 < starts.length ? starts[i + 1] : Math.min(text.length, starts[i] + 3000);
      const block = text.slice(starts[i], end);
      const g = r => { const x = block.match(r); return x ? x[1].trim() : ''; };
      let name = g(/Device ID\s*:\s*(\S+)/);
      let local = g(/^\s*Interface\s*:\s*([^,\n]+)/m);
      // HP / ArubaOS-Switch : « Port : 25 » juste avant « Device ID : 1c 98 ec 8c 80 80 » (MAC en octets séparés)
      const hpPort = text.slice(Math.max(0, starts[i] - 160), starts[i]).match(/^\s*Port\s*:\s*(\S+)\s*$/m);
      if (!local && hpPort) {
        local = hpPort[1];
        let idHex = g(/Device ID\s*:\s*([^\n]+)/);
        const mac = /^([0-9a-f]{2}[ :.-]?){6}$/i.test(idHex.replace(/\s+$/, '')) ? normMac(idHex) : '';
        const plat = g(/Platform[ \t]*:[ \t]*([^\n]*)/).replace(/\.\.\.$/, '').trim();
        const ipH = g(/^\s*Address\s*:\s*(\d+\.\d+\.\d+\.\d+)/m);
        const octets = idHex.trim().split(/\s+/);
        if (!mac && octets.length > 6 && octets.every(x => /^[0-9a-f]{2}$/i.test(x))) {   // nom envoyé en hexadécimal (« 42 6f 72 6e 65 » = « Borne »)
          const txt = octets.map(x => String.fromCharCode(parseInt(x, 16))).join('');
          if (/^[\x20-\x7e\u00a0-\u00ff]+$/.test(txt)) idHex = txt.trim();
        }
        const ipId = idHex.trim().match(/^01 ([0-9a-f]{2}) ([0-9a-f]{2}) ([0-9a-f]{2}) ([0-9a-f]{2})$/i);
        const nomPlat = /^\d/.test(plat) ? '' : plat.replace(/,.*$/, '').replace(/\b(?:Switch|Platform Software)\b/gi, '').replace(/\s+\d[\w.\-]*$/, '').replace(/\s+/g, ' ').trim();
        res.push({ proto: 'CDP', localPort: shortPort(local), name: mac || ipId ? nomPlat : idHex, ip: ipH || (ipId ? ipId.slice(1).map(x => parseInt(x, 16)).join('.') : ''), platform: plat,
          caps: normCaps(g(/Capability[ \t]*:[ \t]*([^\n]*)/)), portId: g(/Device Port\s*:\s*([^\n]+)/).replace(/^"|"$/g, ''),
          portDescr: '', chassis: mac, descr: plat, nomDeduit: !!(mac || ipId) });
        continue;
      }
      if (!name || !local) continue;
      const vm = block.match(/Version\s*:\s*\n\s*(.+)/);
      res.push({
        proto: 'CDP', localPort: shortPort(local), name,
        ip: g(/IP(?:v4)? address\s*:\s*(\d+\.\d+\.\d+\.\d+)/i),
        platform: g(/Platform\s*:\s*([^,\n]+)/),
        caps: normCaps(g(/Capabilities\s*:\s*([^\n]+)/)),
        portId: g(/Port ID \(outgoing port\)\s*:\s*(.+)/),
        portDescr: '', chassis: '', descr: vm ? vm[1].trim() : ''
      });
    }
    return res;
  }

  /* ---------- LLDP (Cisco, Aruba CX, HP, générique clé : valeur) ---------- */
  function parseLLDP(text) {
    // Comware / Huawei : « LLDP neighbor-information of port 3[GigabitEthernet1/0/3]: »
    text = String(text).replace(/^\s*LLDP neighbor-information of port \d+\[([^\]]+)\]\s*:?\s*$/gmi, 'Local Port : $1');
    const lines = text.split('\n'), res = [];
    const startRe = /^\s*(Local Intf|Local Interface|Local Port|Port)\s*:\s*(\S+(?: \d+(?:\/\d+)+)?)/i;
    const nbRe = /(chassis|sysname|system name|neighbor)/i;
    let i = 0;
    while (i < lines.length) {
      const m = lines[i].match(startRe);
      if (m) {
        let ok = false;
        for (let k = i + 1; k < Math.min(lines.length, i + 30); k++) {
          if (startRe.test(lines[k])) break;
          if (nbRe.test(lines[k]) && /:/.test(lines[k])) { ok = true; break; }
        }
        if (ok) {
          let j = i + 1;
          while (j < lines.length && j < i + 60 && !startRe.test(lines[j]) && !/^-{20,}/.test(lines[j].trim())) j++;
          const nb = parseLldpBlock(m[2], lines.slice(i + 1, j));
          if (nb) res.push(nb);
          i = j; continue;
        }
      }
      i++;
    }
    return res;
  }
  function parseLldpBlock(lp, bl) {
    const kv = [];
    bl.forEach((l, k) => { const m = l.match(/^\s*([A-Za-z][A-Za-z0-9 \-\/()._]*?)\s*:\s*(.*?)\s*$/); if (m) kv.push([m[1].toLowerCase(), m[2], k]); });
    const find = t => { for (const e of kv) if (t(e[0])) return e; return null; };
    const val = t => { const f = find(t); return f ? f[1] : ''; };
    let name = val(k => /(system name|sysname|chassis-name|system-name)/.test(k));
    const portId = val(k => /(port id|portid|port-id)/.test(k) && !/local|type/.test(k));
    const portDescr = val(k => /(port descr|port description|port-desc)/.test(k));
    const chassis = val(k => /(chassis id|chassisid|chassis-id)/.test(k));
    const caps = val(k => /(enabled capabilities|capabilities enabled)/.test(k)) || val(k => /(system capabilities|capabilities supported|capabilities available)/.test(k));
    const dF = find(k => /(system descr|system description|chassis-description|sysdescr)/.test(k));
    let descr = dF ? dF[1] : '';
    if (dF && !descr) for (let k = dF[2] + 1; k < bl.length; k++) if (bl[k].trim()) { descr = bl[k].trim(); break; }
    let ip = '';
    for (const [k, v] of kv) if (/(^ip$|address|mgmt|management)/.test(k)) { const x = v.match(IPV4); if (x) { ip = x[0]; break; } }
    if (!ip) { const x = bl.join('\n').match(/(?:\bIP|Address)\s*:\s*(\d+\.\d+\.\d+\.\d+)/); if (x) ip = x[1]; }
    if (/^not advertised$/i.test(name)) name = '';
    if (!name && !chassis && !ip) return null;
    return { proto: 'LLDP', localPort: shortPort(lp), name, ip, platform: '', caps: normCaps(caps, true), portId, portDescr, chassis: normMac(chassis), descr };
  }
  /* LLDP en tableau à barres (Planet GE/XG) : « Port | Device ID | Port ID | SysName | Capabilities | TTL » */
  function parseLldpPipe(text) {
    const res = [];
    for (const l of String(text || '').split('\n')) {
      const m = l.match(/^\s*((?:GE|XG|FE|Gi|Te)?\d[\w\/]*)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*\d+\s*$/i);
      if (!m) continue;
      const caps = m[5].toLowerCase(), c = [];
      if (/bridge|switch/.test(caps)) c.push('bridge'); if (/router/.test(caps)) c.push('router'); if (/station|host/.test(caps)) c.push('host'); if (/wlan|access point/.test(caps)) c.push('ap'); if (/phone|telephone/.test(caps)) c.push('phone');
      const ch = normMac(m[2]);
      res.push({ proto: 'LLDP', localPort: shortPort(m[1]), name: m[4].trim() || (ch ? '' : m[2]), ip: '', platform: '', caps: c, portId: m[3], portDescr: '', chassis: ch, descr: '' });
    }
    return res;
  }
  /* LLDP HP en résumé (vieux firmwares : « show lldp info remote-device » sans « detail ») :
     « 25        | 1c 98 ec 8c 80 80         46     46        SW-MEL-HDV-01 » */
  function parseLldpHpTable(text) {
    const res = []; let col = null;
    for (const l of String(text).split('\n')) {
      if (/^\s*LocalPort\s*\|\s*ChassisId/i.test(l)) { col = ['ChassisId', 'PortId', 'PortDescr', 'SysName'].map(h => l.indexOf(h)); continue; }
      if (!col) continue;
      if (/^\s*-{3,}/.test(l)) continue;
      const m = l.match(/^\s*(\S+)\s*\|/);
      if (!m) { if (l.trim()) col = null; continue; }
      const cut = k => l.slice(col[k], k < 3 ? col[k + 1] : undefined).trim();   // colonnes repérées sur l'en-tête (les valeurs peuvent se toucher)
      const chassis = cut(0);
      res.push({ proto: 'LLDP', localPort: shortPort(m[1]), name: cut(3), ip: '', platform: '', caps: [], portId: cut(1), portDescr: cut(2),
        chassis: /^([0-9a-f]{2}[ :.-]?){6}$|^[0-9a-f]{6}-[0-9a-f]{6}$/i.test(chassis) ? normMac(chassis) : '', descr: '' });
    }
    return res;
  }
  function mergeNeighbors(list) {
    const out = [];
    for (const nb of list) {
      const n = normName(nb.name);
      const ex = out.find(o => o.localPort === nb.localPort && ((n && !nb.nomDeduit && !o.nomDeduit && normName(o.name) === n) || (nb.ip && o.ip === nb.ip) || (nb.chassis && o.chassis === nb.chassis)));
      if (!ex) { out.push(Object.assign({}, nb)); continue; }
      if (ex.nomDeduit && nb.name && !nb.nomDeduit) { ex.name = nb.name; ex.nomDeduit = false; }
      for (const k of ['name', 'ip', 'platform', 'portId', 'portDescr', 'chassis', 'descr']) if (!ex[k] && nb[k]) ex[k] = nb[k];
      ex.caps = [...new Set([...(ex.caps || []), ...(nb.caps || [])])];
      if (ex.proto !== nb.proto) ex.proto = 'CDP+LLDP';
    }
    return out;
  }

  /* ---------- tables MAC et ARP ---------- */
  function parseMacArp(text, vendor) {
    const macs = [], arp = [];
    const macRe = new RegExp(MAC_SRC, 'ig');
    const skip = /Device ID|Chassis|address is|\bbia\b|Base |station address|Mac Address\s*:|Root ID|Bridge ID|^\s*Address\s|Key name|Burned/i;
    for (const raw of text.split('\n')) {
      if (raw.length > 220 || skip.test(raw)) continue;
      if ((raw.match(/\|/g) || []).length > 3) continue;   // tableau LLDP à barres (Planet) : pas une entrée MAC
      const ms = raw.match(macRe);
      if (!ms || ms.length !== 1) continue;
      const mac = normMac(ms[0]);
      if (!mac) continue;
      const line = raw.replace(/(^|\s)((?:10|2\.5|5)?)(GigabitEthernet|FastEthernet|TenGigabitEthernet|Ethernet|Gi|Fa|Te|Xi)\s+(\d+(?:\/\d+)*)\b/gi, '$1$2$3$4');
      const toks = line.trim().split(/\s+/).filter(t => t !== ms[0]);
      const ipm = line.match(IPV4);
      if (ipm) {
        if (isMulticast(mac)) continue;
        let iface = toks.find(t => t !== ipm[0] && isPortTok(t)) || toks.find(t => /^vlan\s?\d+$/i.test(t)) || '';
        arp.push({ ip: ipm[0], mac, iface: shortPort(iface) });
        continue;
      }
      if (isMulticast(mac)) continue;
      let port = '', vlan = '';
      const pt = toks.filter(isPortTok);
      if (pt.length) port = pt[pt.length - 1];
      if (!port && vendor === 'hp') {
        const hpT = toks.filter(t => /^([A-Z]{1,2}\d+|Trk\d+|\d+)$/i.test(t));
        if (hpT.length) { port = hpT[0]; vlan = hpT[1] || ''; }
      }
      if (!port || /^cpu$/i.test(port)) continue;
      if (!vlan) vlan = toks.find(t => /^\d{1,4}$/.test(t) && +t >= 1 && +t <= 4094 && t !== port) || '';
      macs.push({ mac, vlan, port: shortPort(port) });
    }
    const seenM = new Set(), seenA = new Set();
    return {
      macs: macs.filter(e => { const k = e.mac + '|' + e.port + '|' + e.vlan; if (seenM.has(k)) return false; seenM.add(k); return true; }),
      arp: arp.filter(e => { const k = e.ip + '|' + e.mac; if (seenA.has(k)) return false; seenA.add(k); return true; })
    };
  }

  /* ---------- état des ports ---------- */
  function parsePorts(text) {
    const ports = {};
    const set = (p, o) => {
      const k = shortPort(p); const ex = ports[k];
      if (ex && o.desc && ex.desc && ex.desc.startsWith(o.desc)) delete o.desc;
      ports[k] = Object.assign(ex || { port: k }, o);
    };
    const cis = /^((?:Gi|Te|Fa|Twe|Tw|Fo|Hu|Po|Ap|Eth|Et)[\d\/.:]+)\s+(.*?)\s*\b(connected|notconnect|disabled|err-disabled|inactive|sfpAbsent|xcvrAbsent|monitoring|suspended|noOperMem)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/;
    const cx = /^(\d+\/\d+\/\d+|lag\d+)\s+(\S+)\s+(access|trunk|routed|--)\s+(\S+)\s+(yes|no)\s+(up|down)\b\s*(.*)$/i;
    const hp = /^\s*([A-Z]{0,2}\d+(?:\/\d+)?|Trk\d+)(?:-(Trk\d+))?\s+(?:(\S+)\s+)?\|\s+(\S+)\s+(Yes|No)\s+(Up|Down)\s+(\S+)/i;
    let cur = null, swp = null, rtk = null;
    // Planet / switchs à CLI « ICLI » : ports écrits avec un espace (GigabitEthernet 1/1)
    // 3 variantes vues : « GigabitEthernet 1/1  1  enabled … 1Gfdx » (Lport), « GigabitEthernet 1/1  enabled … 1Gfdx Fiber »
    // (anciens firmwares GS-5220 / IGS-5225 v3) et « Gi 1/9  Enabled … 100M Optical 100fdx » (IGS-5225 v5)
    const icli = /^\s*((?:10|2\.5|5)?GigabitEthernet|FastEthernet|Gi|Fa|2\.5G|5G|10G)\s+(\d+\/\d+)\s+(?:\d+\s+)?(enabled|disabled)\b\s*(.*?)\s*$/i;
    const icliSpeed = l => { const m = String(l).match(/^(\d+(?:\.\d+)?)(G|M)?(?:fdx|hdx)/i); if (!m) return ''; const v = parseFloat(m[1]) * (/G/i.test(m[2] || '') ? 1000 : 1); return String(v); };
    const icliType = t => /^gi$/i.test(t) ? 'GigabitEthernet' : /^fa$/i.test(t) ? 'FastEthernet' : /^(2\.5|5|10)G$/i.test(t) ? t.replace(/G$/i, 'GigabitEthernet') : t;
    for (const l of text.split('\n')) {
      let m;
      if ((m = l.match(icli))) {
        const toks = m[4].split(/\s+/).filter(Boolean);
        let media = '';
        if (/^(fiber|copper)$/i.test(toks[toks.length - 1] || '')) media = /fiber/i.test(toks.pop()) ? 'fibre' : 'cuivre';
        const link = toks[toks.length - 1] || '';
        if (/^(down|up|\d+(?:\.\d+)?[GM]?(?:fdx|hdx))$/i.test(link)) {
          const type = icliType(m[1]); const k = shortPort(type + m[2]);
          const disabled = /^disabled$/i.test(m[3]);
          if (!media && /optical|sfp/i.test(m[4])) media = 'fibre'; else if (!media && /rj45/i.test(m[4])) media = 'cuivre';
          set(k, { status: /^down$/i.test(link) || disabled ? 'down' : 'up', statusRaw: disabled ? 'désactivé' : link,
            speed: icliSpeed(link), media: media || ((ports[k] && ports[k].media) || '') });
          continue;
        }
      }
      if ((m = l.match(/^\s*Name:\s*((?:10|2\.5|5)?GigabitEthernet|FastEthernet)\s+(\d+\/\d+)\s*$/i))) { swp = shortPort(m[1] + m[2]); continue; }
      // Planet (CLI à ports GE1 / XG1) : blocs « Port : GE1 » de show interface switchport
      if ((m = l.match(/^\s*Port\s*:\s*((?:GE|XG|FE)\d+)\s*$/i))) { rtk = m[1].toUpperCase(); if (!ports[rtk]) set(rtk, {}); continue; }
      if (rtk) {
        if ((m = l.match(/^\s*Port Mode\s*:\s*(\w+)/i))) { set(rtk, { mode: /trunk/i.test(m[1]) ? 'trunk' : (/hybrid/i.test(m[1]) ? 'hybrid' : 'access') }); continue; }
        if ((m = l.match(/^\s*(?:Ingress UnTagged VLAN.*?|Access(?: Mode)? VLAN|PVID)\s*:\s*(\d+)/i))) { set(rtk, { vlan: m[1] }); continue; }
        if (/^\s*Forbidden VLANs/i.test(l)) rtk = null;
      }
      // Planet GE/XG : tableau « Port Name Status Vlan Duplex Speed Type » (show interface GigabitEthernet 1-24 status)
      if ((m = l.match(/^\s*((?:GE|XG|FE)\d+)\s+(.*?)\s*\b(connected|notconnect|disabled|err-disabled)\s+(\d{1,4}|trunk)\s+(\S+)\s+(\S+)\s+(\S+)\s*$/i))) {
        const k = m[1].toUpperCase(), up = /^connected$/i.test(m[3]);
        const sp = m[6].match(/(\d+(?:\.\d+)?)\s*(G|M)/i);
        set(k, { desc: m[2].trim(), status: up ? 'up' : 'down', statusRaw: m[3], vlan: (ports[k] && ports[k].vlan) || (/^\d+$/.test(m[4]) ? m[4] : ''),
          duplex: m[5].replace(/^a-/, ''), speed: up && sp ? String(parseFloat(sp[1]) * (/G/i.test(sp[2]) ? 1000 : 1)) : '', type: m[7], media: /fib|sfp/i.test(m[7]) ? 'fibre' : (/copper|rj45/i.test(m[7]) ? 'cuivre' : '') });
        continue;
      }
      // Planet GE/XG : ligne d'état (format tolérant : port, puis up/down, vitesse)
      if ((m = l.match(/^\s*((?:GE|XG|FE)\d+)\s+(.*)$/i)) && /\b(up|down|link ?up|link ?down|connected|notconnect|disabled)\b/i.test(m[2])) {
        const k = m[1].toUpperCase(); const rest = m[2];
        const st = /\b(link ?up|up|connected)\b/i.test(rest) && !/\b(link ?down|notconnect)\b/i.test(rest) ? 'up' : 'down';
        const sp = rest.match(/\b(?:a-)?(\d+(?:\.\d+)?)\s*(G|M)(?:b(?:ps)?)?\b/i) || rest.match(/\b(?:a-)?(10000|2500|1000|100|10)\b/);
        const speed = sp ? String(parseFloat(sp[1]) * (/G/i.test(sp[2] || '') ? 1000 : 1)) : '';
        set(k, { status: st, statusRaw: (rest.match(/\b(link ?up|link ?down|up|down|connected|notconnect|disabled)\b/i) || [''])[0], speed: st === 'up' ? speed : '',
          media: /^XG/.test(k) ? 'fibre' : ((ports[k] && ports[k].media) || ''), desc: (ports[k] && ports[k].desc) || '' });
        continue;
      }
      if (swp) {
        if ((m = l.match(/^\s*Administrative mode:\s*(\w+)/i))) { set(swp, { mode: /trunk/i.test(m[1]) ? 'trunk' : (/hybrid/i.test(m[1]) ? 'hybrid' : 'access') }); continue; }
        if ((m = l.match(/^\s*Access Mode VLAN:\s*(\d+)/i)) && (!ports[swp] || ports[swp].mode !== 'trunk')) { set(swp, { vlan: m[1] }); continue; }
        if ((m = l.match(/^\s*Trunk Native Mode VLAN:\s*(\d+)/i)) && ports[swp] && ports[swp].mode === 'trunk') { set(swp, { vlan: m[1] }); continue; }
        if (/^\s*$/.test(l)) swp = null;
      }
      if ((m = l.match(cis))) {
        const st = m[3], vl = m[4];
        set(m[1], {
          desc: m[2].trim(), status: st === 'connected' ? 'up' : 'down', statusRaw: st,
          vlan: /^(trunk|routed)$/.test(vl) ? '' : vl, mode: vl === 'trunk' ? 'trunk' : (vl === 'routed' ? 'routed' : 'access'),
          duplex: m[5].replace(/^a-/, ''), speed: m[6].replace(/^a-/, ''), type: m[7].trim(), media: mediaOf(m[7])
        });
        continue;
      }
      if ((m = l.match(cx))) {
        const rest = m[7].split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
        let desc = '', speed = '', reason = '';
        if (rest.length) { desc = rest[rest.length - 1]; if (rest.length >= 2) { speed = rest[rest.length - 2]; reason = rest.slice(0, -2).join(' '); } }
        if (!speed && /^(\d+|--)$/.test(desc)) { speed = desc; desc = ''; }
        if (desc === '--') desc = '';
        set(m[1], {
          vlan: m[2] === '--' ? '' : m[2], mode: m[3], type: m[4], media: mediaOf(m[4]),
          status: /up/i.test(m[6]) ? 'up' : 'down', statusRaw: m[6] + (reason ? ' (' + reason + ')' : ''),
          speed: speed === '--' ? '' : speed, desc
        });
        continue;
      }
      // Comware « display interface brief » : « GE1/0/1  UP  1G(a)  F(a)  A  1  description »
      if ((m = l.match(/^\s*(GE|XGE|FE|BAGG)(\d+(?:\/\d+){0,2})\s+(UP|DOWN|ADM|\*?DOWN|Stby)\s+(\S+)\s+(\S+)\s+([ATH])\s+(\d+)\s*(.*)$/i))) {
        const pref = { GE: 'Gi', XGE: 'Te', FE: 'Fa', BAGG: 'BAGG' }[m[1].toUpperCase()];
        set(pref + m[2], { status: /^UP$/i.test(m[3]) ? 'up' : 'down', statusRaw: m[3], speed: /^(\d+)(G|M)/i.test(m[4]) ? String(parseInt(m[4], 10) * (/G/i.test(m[4]) ? 1000 : 1)) : '',
          mode: m[6].toUpperCase() === 'T' ? 'trunk' : m[6].toUpperCase() === 'H' ? 'hybrid' : 'access', vlan: m[7], desc: m[8].trim() });
        continue;
      }
      if ((m = l.match(hp))) {
        set(m[1], { type: m[3] || '', media: mediaOf(m[3] || ''), status: /up/i.test(m[6]) ? 'up' : 'down', statusRaw: m[6], speed: /^\.$/.test(m[7]) ? '' : m[7] });
        if (m[2]) ports[shortPort(m[1])].trunk = m[2];   // « 48-Trk1 » : port 48 membre de l'agrégat Trk1
        continue;
      }
      if ((m = l.match(/^(\S+) is (up|down|administratively down), line protocol is (\w+)/))) { cur = m[1]; continue; }
      if (cur) {
        if ((m = l.match(/^\s+Description:\s*(.+)$/))) {
          const k = shortPort(cur);
          if (isPortTok(k)) { const p = ports[k]; if (!p || !p.desc || p.desc.length < m[1].trim().length) set(k, { desc: m[1].trim() }); }
          cur = null;
        } else if (!/^\s+Hardware is/.test(l)) cur = null;
      }
    }
    return ports;
  }

  /* ---------- analyse d'un fichier switch ---------- */
  /* ---------- MikroTik RouterOS ---------- */
  function mtSections(text) {
    const out = {}; const re = /^###\s+(.+?)\s*$/gm; let m, last = null, idx = 0;
    while ((m = re.exec(text))) { if (last) out[last] = (out[last] || '') + text.slice(idx, m.index); last = m[1].replace(/"/g, '').trim().toLowerCase(); idx = re.lastIndex; }
    if (last) out[last] = (out[last] || '') + text.slice(idx);
    return out;
  }
  function mtSection(S, key) { for (const k in S) if (k.startsWith(key)) return S[k]; return ''; }
  function mtRecords(txt) {
    const recs = []; let cur = null, pend = '';
    String(txt || '').split('\n').forEach(l => {
      if (/^\s*(Flags:|Columns:|#\s)/.test(l) || /^\s*\[.*\]\s*>/.test(l)) { cur = null; return; }
      if (/^\s*;;;/.test(l)) { pend = l.trim(); cur = null; return; }
      if (/^\s*\d+\s/.test(l)) { cur = [l]; if (pend) { cur.push(' ' + pend); pend = ''; } recs.push(cur); }
      else if (cur && /^\s+\S/.test(l)) cur.push(l);
      else cur = null;
    });
    return recs.map(r => r.join('\n'));
  }
  function mtKV(rec) {
    const o = {}; const re = /([a-z][\w\-]*)=("([^"]*)"|\S*)/g; let m;
    while ((m = re.exec(rec))) o[m[1]] = m[3] != null ? m[3] : m[2];
    return o;
  }
  const MT_MAC = /([0-9A-F]{2}(?::[0-9A-F]{2}){5})/i;
  /* RouterOS affiche les caractères accentués en octets : « Jaur\C3\A8s » (ou « JaurC3A8s » quand l'antislash est perdu) */
  function mtUtf8(t) {
    t = String(t || '');
    const dec = (h) => { try { return decodeURIComponent(h.replace(/(..)/g, '%$1')); } catch (e) { return null; } };
    t = t.replace(/((?:\\[0-9A-F]{2})+)/g, x => dec(x.replace(/\\/g, '')) || x);
    return t.replace(/(?<=[a-z])((?:[C-E][0-9A-F](?:[89AB][0-9A-F]){1,2}))(?=[a-z\s]|$)/g, x => dec(x) || x);
  }
  function parseMikrotik(text, filename) {
    const S = mtSections(text);
    const g = (src, re) => { const m = String(src || '').match(re); return m ? m[1].trim() : ''; };
    const ident = mtSection(S, '/system identity') || text;
    let name = mtUtf8(g(ident, /^\s*name:\s*(.+?)\s*$/m) || g(text, /^\s*\[[^@\]]+@([^\]]+)\]\s*>/m));
    const rb = mtSection(S, '/system routerboard'), res = mtSection(S, '/system resource');
    const model = g(rb, /^\s*model:\s*(.+)$/m) || g(res, /^\s*board-name:\s*(.+)$/m);
    const serial = g(rb, /^\s*serial-number:\s*(\S+)/m);
    const version = g(res, /^\s*version:\s*(.+)$/m);
    const ips = [];
    for (const m of (mtSection(S, '/ip address') || '').matchAll(/(\d+\.\d+\.\d+\.\d+)\/\d+/g)) if (!ips.includes(m[1])) ips.push(m[1]);
    const ports = {}, macs = [];
    mtRecords(mtSection(S, '/interface ethernet')).forEach(r => {
      const cm = r.match(/;;;\s*(.+)/); const desc = cm ? cm[1].trim() : '';
      const t = r.replace(/;;;.*$/m, '').trim().split(/\s+/);
      let i = 1, flags = '';
      if (t[i] && /^[A-Z]+$/.test(t[i])) flags = t[i++];
      const pname = t[i]; if (!pname) return;
      const mm = r.match(MT_MAC); if (mm) macs.push(normMac(mm[1]));
      ports[pname] = { port: pname, desc, status: /R/.test(flags) ? 'up' : 'down', statusRaw: /X/.test(flags) ? 'désactivé' : (/R/.test(flags) ? 'running' : 'pas de lien'),
        media: /sfp|qsfp/i.test(pname) ? 'fibre' : (/ether/i.test(pname) ? 'cuivre' : ''), type: /combo/i.test(pname) ? 'combo' : '' };
    });
    const neighbors = [];
    mtRecords(mtSection(S, '/ip neighbor')).forEach(r => {
      const o = mtKV(r); if (!o.interface) return;
      const lp = o.interface.split(',').find(x => x && !/^bridge/i.test(x)) || o.interface.split(',')[0];
      neighbors.push({ proto: (o['discovered-by'] || 'MNDP').toUpperCase(), localPort: shortPort(lp), name: mtUtf8(o.identity || '').trim(),
        ip: o.address4 || (IPV4.test(o.address || '') ? o.address : ''), platform: o.platform || '',
        caps: normCaps((o['system-caps-enabled'] || o['system-caps'] || '').replace(/,/g, ' ')),
        portId: String(o['interface-name'] || '').split('/').pop(), portDescr: '', chassis: normMac(o['mac-address']), descr: o['system-description'] || [o.platform, o.board, o.version].filter(Boolean).join(' ') });
    });
    const macTable = [];
    mtRecords(mtSection(S, '/interface bridge host')).forEach(r => {
      const m = r.match(/^\s*\d+\s+((?:[A-Z]{1,3}\s+)*)([0-9A-F]{2}(?::[0-9A-F]{2}){5})\s+(?:(\d{1,4})\s+)?(\S+)/i);
      if (!m || /L/.test(m[1])) return;
      const mac = normMac(m[2]); if (!mac || isMulticast(mac)) return;
      if (/^bridge/i.test(m[4])) return;
      macTable.push({ mac, vlan: m[3] || '', port: shortPort(m[4]) });
    });
    const arp = parseMacArp(mtSection(S, '/ip arp') || '', 'mikrotik').arp;
    return { id: uid(), name: name || String(filename || '').replace(/\.[^.]+$/, '') || 'Switch sans nom', vendor: 'mikrotik',
      model: model ? 'MikroTik ' + model : 'MikroTik', serial, version, ips, macs, ports, neighbors: mergeNeighbors(neighbors), macTable, arp,
      source: filename || 'texte collé', importedAt: new Date().toISOString(), location: '' };
  }

  function parseSwitch(text, filename, marque) {
    text = String(text || '').replace(/\r/g, '');
    const vendor = marque || detectVendor(text);
    if (vendor === 'mikrotik') return parseMikrotik(text, filename);
    const id = parseIdentity(text);
    if (!id.name && filename) id.name = String(filename).replace(/\.[^.]+$/, '');
    const neighbors = mergeNeighbors(parseCDP(text).concat(parseLLDP(text), parseLldpPipe(text), parseLldpHpTable(text)));
    const ma = parseMacArp(text, vendor);
    const ports = parsePorts(text);
    return {
      id: uid(), name: id.name || 'Switch sans nom', vendor, model: id.model, serial: id.serial,
      ips: id.ips, macs: id.macs, ports, neighbors, macTable: ma.macs, arp: ma.arp, routing: id.routing, defaultGw: id.defaultGw,
      source: filename || 'texte collé', importedAt: new Date().toISOString(), location: ''
    };
  }

  /* ---------- constructeurs (préfixes MAC) ---------- */
  const OUI_LIST = [
    ['Axis', 'camera', '00408c accc8e b8a44f e82725'],
    ['Hanwha Vision', 'camera', '000918 e43022'],
    ['Panasonic / i-PRO', 'camera', '008045 0080f0'],
    ['Hikvision', 'camera', '4419b6 4cbd8f 54c415 686dbc bcad28 c056e3 c42f90 2857be 1868cb a41437 5803fb'],
    ['Dahua', 'camera', '3cef8c 9002a9 e0508b 4c11bf 38af29 a0bd1d 14a78b'],
    ['Bosch', 'camera', '00075f 000463'],
    ['Avigilon', 'camera', '001885'],
    ['Mobotix', 'camera', '0003c5'],
    ['Vivotek', 'camera', '0002d1'],
    ['2N', 'interphone', '7c1eb3'],
    ['Hyper-V (VM)', 'serveur', '00155d'],
    ['VMware (VM)', 'serveur', '005056 000c29 000569'],
    ['Dell', 'serveur', '001422 18a99b f8bc12 b083fe d4ae52 246e96 f48e38 b8ca3a 7486e2 1866da 509a4c 989096 e4434b 54bf64 70b5e8 8cec4b cc96e5'],
    ['HPE', 'serveur', '3ca82a 9457a5 98f2b3 70106f 1c98ec 9cb654 480fcf 5cb901 08f1ea'],
    ['Supermicro', 'serveur', '002590 ac1f6b 0cc47a 3cecef'],
    ['Synology', 'serveur', '001132'],
    ['Aruba', 'reseau', '000b86 204c03 883a30 94b40f 6cf37f'],
    ['Cisco', 'reseau', '00000c 5c838f'],
    ['Planet', 'reseau', 'a8f7e0 00304f'],
    ['Netgear', 'reseau', '00095b 00146c 204e7f 28c68e 30469a a040a0 9c3dcf e091f5 6cb0ce c03f0e a42b8c e4f4c6 08bd43 b03956 3894ed 8c3bad'],
    ['TP-Link', 'reseau', 'f4f26d 50c7bf 98dac4 c006c3'],
    ['D-Link', 'reseau', '1c7ee5 b8a386 28107b'],
    ['Moxa', 'reseau', '0090e8'],
    ['MikroTik', 'radio', '4c5e0c 64d154 6c3b6b b869f4 cc2de0 d4ca6d e48d8c 18fd74 dc2c6e 2cc81b 488f5a 744d28 085531 c4ad34 000c42 48a98a f41e57'],
    ['Ubiquiti', 'radio', '24a43c 0418d6 687251 788a20 f09fc2 802aa8 fcecda 7483c2 e063da b4fbe4 18e829 245a4c 74acb9 d021f9'],
    ['Cambium', 'radio', '000456'],
    ['Compex', 'radio', '04f021'],
    ['Siemens', 'controle', '001b1b 000e8c'],
    ['Raspberry Pi', 'poste', 'b827eb dca632 e45f01 d83add 2ccf67']
  ];
  const OUI = {};
  OUI_LIST.forEach(([v, c, l]) => l.split(' ').forEach(p => { OUI[p] = [v, c]; }));
  const CAT_LABEL = {
    camera: 'Caméra', serveur: 'Serveur / VM', radio: 'Radio / routeur', reseau: 'Équipement réseau',
    interphone: 'Interphone', controle: 'Contrôle / automate', poste: 'Poste / divers', phone: 'Téléphone',
    virtuel: 'MAC virtuelle', inconnu: 'Inconnu', switch: 'Switch'
  };
  function ouiOf(mac) {
    if (!mac) return { vendor: '', cat: 'inconnu' };
    const o = OUI[mac.slice(0, 6)];
    if (o) return { vendor: o[0], cat: o[1] };
    if (isLocalAdmin(mac)) return { vendor: 'MAC virtuelle / aléatoire', cat: 'virtuel' };
    return { vendor: '', cat: 'inconnu' };
  }

  /* ---------- analyse globale ---------- */
  const CLASS_LABEL = {
    switch: 'Lien inter-switch', externe: 'Vers équipement réseau non relevé', multi: 'Plusieurs équipements',
    equipement: 'Équipement', actif: 'Actif (aucune MAC)', libre: 'Libre', '': '—'
  };

  function analyze(state) {
    const sws = state.switches || [];
    const byName = new Map(), byIp = new Map(), macRanges = [];
    sws.forEach(s => {
      byName.set(normName(s.name), s);
      (s.ips || []).concat(s.extraIps || []).forEach(ip => byIp.set(ip, s));
      // Cisco & co : une plage de MAC par switch (ports, SVI). Planet / MikroTik : MAC exactes
      // (les Planet d'un même lot ont des MAC qui se suivent : une plage les confondrait).
      const win = /^(planet|mikrotik)$/.test(s.vendor) ? 0 : 128;
      (s.macs || []).forEach(h => macRanges.push([parseInt(h, 16), s, win]));
    });
    const swOfMac = h => { const v = parseInt(h, 16); for (const [x, s, w] of macRanges) if (Math.abs(x - v) <= w) return s; return null; };
    const resolve = (nb, self) => {
      let s = null; const n = normName(nb.name);
      // nom porté par plusieurs switchs (nom d'usine « IGS-4215-4P4T2S ») : l'IP et la MAC départagent
      const ambigu = n && sws.filter(x => normName(x.name) === n).length > 1;
      if (n && byName.has(n) && !ambigu) s = byName.get(n);
      if (!s && nb.ip && byIp.has(nb.ip)) s = byIp.get(nb.ip);
      if (!s && nb.chassis) s = swOfMac(nb.chassis);
      if (!s && n && byName.has(n)) s = byName.get(n);
      return s && s !== self ? s : null;
    };

    // ports
    const PI = {};
    sws.forEach(s => {
      const P = {};
      const get = p => {
        const k = shortPort(p);
        if (!P[k]) P[k] = Object.assign({ port: k, macs: new Set(), nbs: [], vlans: new Set(), cls: '' }, (s.ports || {})[k] || {});
        return P[k];
      };
      Object.keys(s.ports || {}).forEach(get);
      (s.macTable || []).forEach(e => { const p = get(e.port); p.macs.add(e.mac); if (e.vlan) p.vlans.add(e.vlan); });
      (s.neighbors || []).forEach(nb => get(nb.localPort).nbs.push(nb));
      Object.values(P).forEach(p => { if (!p.status && p.macs.size) { p.status = 'up'; p.statusRaw = 'actif (MAC vues)'; } });
      PI[s.id] = P;
    });

    // ARP global
    const macIp = new Map(), ipMac = new Map();
    sws.forEach(s => (s.arp || []).forEach(a => { if (!macIp.has(a.mac)) macIp.set(a.mac, a.ip); if (!ipMac.has(a.ip)) ipMac.set(a.ip, a.mac); }));

    // liens
    const ext = new Map(), half = [], modelGuess = {}, ipGuess = {};
    sws.forEach(s => {
      Object.entries(PI[s.id]).forEach(([k, p]) => {
        p.hostNbs = [];
        p.nbs.forEach(nb => {
          const t = resolve(nb, s);
          if (t) { half.push({ a: 'sw:' + s.id, aPort: k, b: 'sw:' + t.id, bPort: shortPort(nb.portId), kind: 'switch', proto: nb.proto || '' }); p.cls = 'switch'; if (nb.descr && !modelGuess[t.id]) modelGuess[t.id] = nb.descr; if (nb.ip && !ipGuess[t.id]) ipGuess[t.id] = nb.ip; return; }
          const c = nb.caps || [];
          // capacités vides : switch si le nom ou le port distant l'indiquent (« SWITCH », port GE6…)
          const net = c.includes('switch') || c.includes('bridge') || c.includes('router') || c.includes('ap')
            || (!c.length && (/switch/i.test(nb.name || '') || /^(?:GE|XG|FE|Gi|Te|Fa)\d/i.test(nb.portId || '')));
          // « Router, Station only » = caméra multi-capteurs (Hanwha PNM…) : c'est un terminal, pas un routeur
          const hostish = ((c.includes('host') || c.includes('phone')) && !c.includes('switch') && !c.includes('bridge'))
            || /Network Camera|IP Camera|PTZ|Dome Camera|Video Encoder|Plate Camera|_Camera\b|^(?:XNP|XNO|XNV|XND|PNM|PNV|PNO|QNP|QNV|QNO|ANV|ANO)-|\bITS[VI]?-\d|Zenitel|Stentofon|Turbine/i.test((nb.descr || '') + ' ' + (nb.platform || ''))
            || /^(?:XNP|XNO|XNV|XND|PNM|PNV|PNO|QNP|QNV|QNO|ANV|ANO|HTW_|SIP-T|axis-)|Yealink/i.test(nb.name || '');
          if (net && !hostish) {
            const generique = /^(switch|router|ap|mikrotik|default)$/i.test(normName(nb.name));   // nom par défaut : on distingue par la MAC
            const roleNb = (() => {
              const txt = (nb.descr || '') + ' ' + (nb.platform || '') + ' ' + ((nb.chassis && ouiOf(nb.chassis).vendor) || '');
              if (c.includes('router') && c.includes('ap')) return 'Routeur / radio';
              if (/\b(Aruba|ProCurve|Cisco IOS|Catalyst|NX-OS|JL\d{3}A|R8N\d{2}A|J\d{4}A|Comware|H3C|Hirschmann|Railswitch|PLANET|Switch)\b/i.test(txt)) return 'Switch non relevé';
              // radios (MikroTik, Infinet…) : annoncées « Router Switch » en CDP
              if (c.includes('router') && (/RouterOS|MikroTik|Infinet|WANFleX|Wireless|airOS|Ubiquiti|Cambium|Siklu|Mimosa/i.test(txt) || !c.includes('switch'))) return 'Routeur / radio';
              return c.includes('switch') ? 'Switch non relevé' : (c.includes('bridge') || !c.length) ? 'Switch non relevé' : 'Borne Wi-Fi';
            })();
            let key = 'ext:' + (normName(nb.name) || nb.chassis || '') + (generique ? '|' + (nb.chassis || '') : '') + '|' + (nb.ip || '');
            const deja = [...ext.values()].find(e => (nb.ip && e.ip === nb.ip) || (nb.chassis && e.chassis === nb.chassis));
            if (deja) {
              key = deja.id;
              if (roleNb === 'Routeur / radio' && deja.role === 'Switch non relevé' && !/\b(Aruba|ProCurve|Cisco|Comware|Hirschmann|PLANET|Switch)\b/i.test((deja.descr || '') + ' ' + (deja.platform || ''))) deja.role = roleNb;
              if (nb.name && !nb.nomDeduit && (deja.nomDeduit || !deja.name || deja.name === deja.ip)) { deja.name = nb.name; deja.nomDeduit = false; }
              ['ip', 'platform', 'descr', 'chassis'].forEach(k => { if (!deja[k] && nb[k]) deja[k] = nb[k]; });
            }
            const nomExt = nb.nomDeduit && nb.name ? nb.name + (nb.ip ? ' (' + nb.ip + ')' : '') : (nb.name || nb.ip || fmtMac(nb.chassis));
            if (!ext.has(key)) ext.set(key, {
              id: key, kind: 'ext', name: nomExt, nomDeduit: !!nb.nomDeduit, chassis: nb.chassis || '', ip: nb.ip, platform: nb.platform, descr: nb.descr,
              role: roleNb
            });
            half.push({ a: 'sw:' + s.id, aPort: k, b: key, bPort: shortPort(nb.portId), kind: 'ext' });
            if (p.cls !== 'switch') p.cls = 'externe';
          } else p.hostNbs.push(nb);
        });
      });
    });
    // agrégats HP (« 48-Trk1 ») : le Trk prend la classe de ses ports membres (lien vers switch ou équipement réseau)
    sws.forEach(s => Object.entries(s.ports || {}).forEach(([k, p]) => {
      if (!p.trunk) return; const m = PI[s.id][k], t = PI[s.id][shortPort(p.trunk)];
      if (m && t && (m.cls === 'switch' || m.cls === 'externe') && t.cls !== 'switch') t.cls = m.cls;
    }));
    (state.manualLinks || []).forEach((ml, i) => {
      const nodeFor = v => {
        const s = sws.find(x => x.id === v || normName(x.name) === normName(v));
        if (s) return 'sw:' + s.id;
        const key = 'man:' + normName(v);
        if (!ext.has(key)) ext.set(key, { id: key, kind: 'ext', name: v, ip: '', role: 'Ajouté à la main' });
        return key;
      };
      const a = nodeFor(ml.a), b = nodeFor(ml.b);
      half.push({ a, aPort: shortPort(ml.aPort), b, bPort: shortPort(ml.bPort), kind: 'manuel', media: ml.media || '', manualIndex: i });
      [[a, ml.aPort], [b, ml.bPort]].forEach(([n, p]) => {
        if (n.startsWith('sw:') && p) { const P = PI[n.slice(3)]; const k = shortPort(p); if (!P[k]) P[k] = { port: k, macs: new Set(), nbs: [], vlans: new Set(), hostNbs: [] }; const other = n === a ? b : a; P[k].cls = other.startsWith('sw:') ? 'switch' : 'externe'; }
      });
    });

    const links = [];
    half.forEach(h => {
      if (h.kind === 'switch') {
        // même port écrit différemment : « gi9 » / « Gi9 », ou numéro seul « 9 » annoncé pour « Gi1/9 »
        // numéro seul = rang du port (Planet IGS-5225 : « 11 » annoncé pour « 2.5G 1/1 »)
        const rang = (node, port) => { const P = node.startsWith('sw:') && PI[node.slice(3)]; if (!P) return -1; const k = Object.keys(P).filter(x => !/^(cpu|vlan|lag|po|trk|bagg)/i.test(x)); return k.indexOf(port) + 1; };
        const pEq = (x, y, owner) => { x = String(x || '').toLowerCase(); const yo = String(y || ''); y = yo.toLowerCase(); if (x === y) return true;
          const n = /^\d+$/.test(x) ? x : (/^\d+$/.test(y) ? y : ''); const o = n === x ? y : x; if (!n) return false;
          if (new RegExp('[^\\d]' + n + '$').test(o)) return true;
          return n === x && owner && rang(owner, yo) === +n; };
        const L = links.find(L => L.kind === 'switch' && L.a === h.b && L.b === h.a && !L.both
          && (!L.bPort || pEq(L.bPort, h.aPort, h.a) || !isPortLike(L.bPort))
          && (!h.bPort || pEq(h.bPort, L.aPort, L.a) || !isPortLike(h.bPort)));
        if (L) { L.bPort = h.aPort; L.both = true; return; }
      }
      if (links.some(L => L.a === h.a && L.aPort === h.aPort && L.b === h.b)) return;
      links.push(Object.assign({}, h));
    });
    // liens déduits des tables MAC (switchs sans LLDP/CDP, ex. Planet GE/XG) :
    // S voit le MAC de T sur le port kS, T voit celui de S sur kT, et aucun autre switch relevé
    // n'est vu à la fois derrière kS (côté S) et derrière kT (côté T).
    const swPort = new Map();   // s.id -> Map(t.id -> port)
    sws.forEach(s => {
      const m = new Map();
      (s.macTable || []).forEach(e => { const t = swOfMac(e.mac); if (t && t !== s && !m.has(t.id)) m.set(t.id, shortPort(e.port)); });
      swPort.set(s.id, m);
    });
    const relie = (x, y) => links.some(L => (L.a === 'sw:' + x && L.b === 'sw:' + y) || (L.a === 'sw:' + y && L.b === 'sw:' + x));
    sws.forEach((s, i) => sws.forEach((t, j) => {
      if (j <= i || relie(s.id, t.id)) return;
      const kS = swPort.get(s.id).get(t.id), kT = swPort.get(t.id).get(s.id);
      if (!kS && !kT) return;
      if (kS && PI[s.id][kS] && PI[s.id][kS].nbs.some(nb => resolve(nb, s))) return;
      if (kT && PI[t.id][kT] && PI[t.id][kT].nbs.some(nb => resolve(nb, t))) return;
      // port déjà relié (LLDP/CDP) à un équipement réseau non relevé : c'est lui qui est entre les deux
      const aExt = (w, k) => k && links.some(L => L.a === 'sw:' + w.id && L.kind === 'ext' && !L.deduit && (L.aPort === k || ((w.ports || {})[L.aPort] || {}).trunk === k));
      if (aExt(s, kS) || aExt(t, kT)) return;
      if (kS && kT) {
        // Sur un lien direct, aucun équipement ne peut être vu à la fois par S sur kS et par T sur kT.
        // S'il y en a, c'est qu'un équipement non relevé (souvent un switch) se trouve entre les deux.
        const own = m => { const w = swOfMac(m); return w === s || w === t; };
        const cs = PI[s.id][kS] ? PI[s.id][kS].macs : new Set(), ct = PI[t.id][kT] ? PI[t.id][kT].macs : new Set();
        const commun = [...cs].filter(m => ct.has(m) && !own(m));
        if (commun.some(m => swOfMac(m))) return;   // un switch relevé est entre les deux : ses propres liens suffisent
        if (commun.length) {
          const note = m => (ouiOf(m).cat === 'reseau' ? 2 : 0) + (macIp.has(m) ? 1 : 0);
          const rep = commun.slice().sort((x, y) => note(y) - note(x))[0];
          const key = 'via:' + rep, ip = macIp.get(rep) || '';
          if (!ext.has(key)) ext.set(key, { id: key, kind: 'ext', name: (ouiOf(rep).cat === 'reseau' ? 'Switch non relevé' : 'Équipement non relevé') + (ip ? ' ' + ip : ''),
            ip, platform: ouiOf(rep).vendor || '', descr: 'déduit des tables MAC : ' + fmtMac(rep), role: 'Switch non relevé (déduit)', via: true });
          [[s, kS], [t, kT]].forEach(([w, k]) => {
            if (!links.some(L => L.a === 'sw:' + w.id && L.aPort === k && L.b === key)) links.push({ a: 'sw:' + w.id, aPort: k, b: key, bPort: '', kind: 'ext', deduit: true });
            if (PI[w.id][k]) PI[w.id][k].cls = 'externe';
          });
          return;
        }
      } else {
        const entre = sws.some(u => u !== s && u !== t && (kS
          ? (swPort.get(s.id).get(u.id) === kS && swPort.get(u.id).get(s.id) && swPort.get(u.id).get(t.id) && swPort.get(u.id).get(s.id) !== swPort.get(u.id).get(t.id))
          : (swPort.get(t.id).get(u.id) === kT && swPort.get(u.id).get(t.id) && swPort.get(u.id).get(s.id) && swPort.get(u.id).get(t.id) !== swPort.get(u.id).get(s.id))));
        if (entre) return;
      }
      links.push({ a: 'sw:' + s.id, aPort: kS || '', b: 'sw:' + t.id, bPort: kT || '', kind: 'switch', both: !!(kS && kT), deduit: true });
      if (kS && PI[s.id][kS]) PI[s.id][kS].cls = 'switch';
      if (kT && PI[t.id][kT]) PI[t.id][kT].cls = 'switch';
    }));
    // Un port physique ne relie qu'un seul switch. Les MikroTik listent aussi des voisins indirects (MNDP/CDP traversent le bridge) :
    // on garde d'abord les liens confirmés par un switch non MikroTik, puis vus des deux côtés, puis les autres.
    {
      const vend = id => { const s = sws.find(x => 'sw:' + x.id === id); return s ? s.vendor : ''; };
      const sl = links.filter(L => L.kind === 'switch' && !L.deduit);
      const note = L => (L.both ? 2 : 0) + ((vend(L.a) !== 'mikrotik' || vend(L.b) !== 'mikrotik') ? (L.both ? 4 : 1) : 0) + (/LLDP|CDP/.test(L.proto || '') ? 0.5 : 0);
      const pris = new Set(), rejet = new Set();
      sl.slice().sort((x, y) => note(y) - note(x)).forEach(L => {
        const ka = L.aPort ? L.a + '|' + L.aPort : '', kb = L.bPort ? L.b + '|' + L.bPort : '';
        if ((ka && pris.has(ka)) || (kb && pris.has(kb))) { rejet.add(L); return; }
        if (ka) pris.add(ka); if (kb) pris.add(kb);
      });
      for (let i = links.length - 1; i >= 0; i--) if (rejet.has(links[i])) links.splice(i, 1);
    }
    const portOf = (node, port) => node.startsWith('sw:') && PI[node.slice(3)] ? PI[node.slice(3)][port] : null;
    // lien vu d'un seul côté : le port d'en face mène aussi à un switch (ses MAC ne sont pas des équipements « sur » ce port)
    links.forEach(L => { if (L.kind !== 'switch') return; [[L.a, L.aPort], [L.b, L.bPort]].forEach(([n, k]) => { const p = k && portOf(n, k); if (p) p.cls = 'switch'; }); });
    links.forEach(L => {
      const pa = portOf(L.a, L.aPort), pb = portOf(L.b, L.bPort);
      L.media = L.media || (pa && pa.media) || (pb && pb.media) || '';
      L.speed = (pa && pa.speed) || (pb && pb.speed) || '';
      if (!isPortLike(L.bPort) && L.bPort && L.kind !== 'manuel') { L.bPortRaw = L.bPort; L.bPort = ''; }
    });

    // classification des ports
    sws.forEach(s => Object.values(PI[s.id]).forEach(p => {
      p.hostNbs = p.hostNbs || [];
      p.devMacs = [...p.macs].filter(m => !swOfMac(m));
      const n = p.devMacs.length;
      if (!p.cls) {
        if (n === 0 && !p.hostNbs.length) p.cls = p.status === 'up' ? 'actif' : (p.status === 'down' ? 'libre' : '');
        else if (n <= 2 && p.hostNbs.length <= 1) p.cls = 'equipement';
        else p.cls = 'multi';
      }
      p.macCount = n;
    }));

    // équipements
    const rank = { equipement: 0, multi: 1, actif: 1, externe: 2, '': 2, libre: 2, switch: 3 };
    const dev = new Map();
    sws.forEach(s => (s.macTable || []).forEach(e => {
      if (swOfMac(e.mac)) return;
      const p = PI[s.id][shortPort(e.port)];
      let d = dev.get(e.mac);
      if (!d) { d = { key: e.mac, mac: e.mac, ip: '', name: '', model: '', sightings: [] }; dev.set(e.mac, d); }
      d.sightings.push({ sw: s.id, port: shortPort(e.port), vlan: e.vlan, cls: p ? p.cls : '', n: p ? p.macCount : 0 });
    }));
    // voisins "hôtes" (caméras Axis, téléphones…)
    sws.forEach(s => Object.entries(PI[s.id]).forEach(([k, p]) => p.hostNbs.forEach(nb => {
      let mac = nb.chassis || macFromName(nb.name) || (nb.ip ? ipMac.get(nb.ip) : '') || '';
      if (mac && swOfMac(mac)) return;
      let d = mac ? dev.get(mac) : null;
      if (!d && nb.ip) d = [...dev.values()].find(x => x.nbIp === nb.ip);
      if (!d) {
        const key = mac || ('nb:' + (nb.ip || normName(nb.name)));
        d = { key, mac: mac || '', ip: '', name: '', model: '', sightings: [] }; dev.set(key, d);
      }
      d.name = d.name || nb.name; d.nbIp = nb.ip; d.ip = d.ip || nb.ip || '';
      d.model = d.model || nb.descr || nb.platform || '';
      if (nb.caps && nb.caps.includes('phone')) d.phone = true;
      if (!d.sightings.some(x => x.sw === s.id && x.port === k)) d.sightings.push({ sw: s.id, port: k, vlan: '', cls: p.cls, n: p.macCount, viaNb: true });
      else d.sightings.forEach(x => { if (x.sw === s.id && x.port === k) x.viaNb = true; });
    })));
    // ARP seuls
    macIp.forEach((ip, mac) => { if (!dev.has(mac) && !swOfMac(mac) && ![...dev.values()].some(d => d.ip === ip)) dev.set(mac, { key: mac, mac, ip, name: '', model: '', sightings: [] }); });

    const extByIp = new Map(); ext.forEach(e => { if (e.ip) extByIp.set(e.ip, e); });
    const devices = [];
    dev.forEach(d => {
      const ipE = d.ip || (d.mac ? macIp.get(d.mac) : '');
      if (ipE && extByIp.has(ipE)) { const e = extByIp.get(ipE); d.name = d.name || e.name; d.model = d.model || e.descr || ''; d.isNetNode = true; }
      d.ip = d.ip || (d.mac ? macIp.get(d.mac) || '' : '');
      const o = ouiOf(d.mac);
      d.vendor = o.vendor; d.cat = o.cat;
      const txt = (d.name + ' ' + d.model).toLowerCase();
      if (/^axis-/.test(d.name.toLowerCase())) { d.vendor = d.vendor || 'Axis'; if (d.cat === 'inconnu' || d.cat === 'virtuel') d.cat = 'camera'; }
      if (/intercom|door station|a81\d\d|interphone/.test(txt)) d.cat = 'interphone';
      else if (/door controller|a1001|a1601|a1610/.test(txt)) d.cat = 'controle';
      else if (/camera|caméra|ptz|dome|bullet/.test(txt)) d.cat = 'camera';
      if (d.phone) d.cat = 'phone';
      d.sightings.sort((x, y) => (rank[x.cls] - rank[y.cls]) || ((x.viaNb ? 0 : 1) - (y.viaNb ? 0 : 1)) || (x.n - y.n));
      const b = d.sightings[0];
      d.loc = b || null;
      d.conf = !b ? 'non localisé (vu seulement dans une table ARP)'
        : b.cls === 'equipement' ? 'branché directement'
        : b.cls === 'switch' ? 'vu uniquement sur des liens inter-switchs'
        : b.cls === 'externe' ? 'derrière un équipement réseau non relevé'
        : 'derrière un switch non managé / une radio / un hyperviseur';
      if (b && !d.vlan) d.vlan = (d.sightings.find(x => x.vlan) || {}).vlan || '';
      devices.push(d);
    });

    // inventaire Genetec : rapprochement par MAC, puis par IP
    const genRows = [], cfgRows = [];
    const G = ((state.genetec && state.genetec.units) || []).map(u => Object.assign({}, u, { cfg: [] }));
    const CFG = (state.gconfig && state.gconfig.rows) || [];
    if (CFG.length) {
      const bm = new Map(), bi = new Map(), bn = new Map();
      const idx = u => { if (u.mac) bm.set(u.mac, u); if (u.ip) bi.set(u.ip, u); String(u.name || '').split(' / ').forEach(n => { const f = fold(n); if (f) bn.set(f, u); }); };
      G.forEach(idx);
      CFG.forEach(rec => {
        let u = (rec.mac && bm.get(rec.mac)) || (rec.ip && bi.get(rec.ip)) || (rec.unit && bn.get(fold(rec.unit))) || (rec.name && bn.get(fold(rec.name))) || null;
        if (!u) { u = { name: rec.name || rec.unit, ip: rec.ip, mac: rec.mac, manufacturer: '', model: '', firmware: '', archiver: '', status: '', cfg: [], fromCfg: true }; G.push(u); idx(u); }
        else { if (!u.ip && rec.ip) { u.ip = rec.ip; bi.set(rec.ip, u); } if (!u.mac && rec.mac) { u.mac = rec.mac; bm.set(rec.mac, u); } }
        u.cfg.push(rec);
      });
    }
    if (G.length) {
      const byMac = new Map(), byIp = new Map();
      devices.forEach(d => { if (d.mac) byMac.set(d.mac, d); if (d.ip && !byIp.has(d.ip)) byIp.set(d.ip, d); });
      G.forEach(g => {
        let d = (g.mac && byMac.get(g.mac)) || null, how = d ? 'MAC' : '';
        if (!d && g.ip && byIp.has(g.ip)) { d = byIp.get(g.ip); how = 'IP'; }
        const cf = summarizeCfg(g.cfg || []);
        const row = { name: g.name, ip: g.ip, mac: g.mac, manufacturer: g.manufacturer, model: g.model, firmware: g.firmware, archiver: g.archiver, gstatus: g.status,
          swId: '', port: '', vlan: '', speed: '', portState: '', netIp: '', how, state: '', note: '', cfgText: cf.text, kbps: cf.kbps, fromCfg: !!g.fromCfg };
        if (d) {
          d.gen = g; d.netName = d.netName || d.name; d.name = g.name || d.name; d.model = g.model || d.model;
          if (!d.vendor && g.manufacturer) d.vendor = g.manufacturer;
          if (!['interphone', 'controle'].includes(d.cat)) d.cat = 'camera';
          row.netIp = d.ip || ''; if (!row.mac) row.mac = d.mac;
          const notes = [];
          if (d.loc) {
            row.swId = d.loc.sw; row.port = d.loc.port; row.vlan = d.vlan || d.loc.vlan || '';
            const p = PI[d.loc.sw] && PI[d.loc.sw][d.loc.port];
            if (p) { row.speed = p.speed || ''; row.portState = p.status === 'up' ? 'Connecté' : (p.status === 'down' ? 'Déconnecté' : ''); }
            row.state = d.loc.cls === 'switch' ? 'uplink' : 'ok';
            if (d.loc.cls !== 'equipement') notes.push(d.conf);
          } else { row.state = 'ip'; notes.push('vue dans une table ARP mais sur aucun port relevé'); }
          if (g.ip && d.ip && g.ip !== d.ip) { notes.push('IP sur le réseau ' + d.ip + ' différente de Genetec'); row.state = 'diff'; }
          if (how === 'IP' && g.mac && d.mac && g.mac !== d.mac) { notes.push('l\'IP Genetec répond avec une autre MAC (' + fmtMac(d.mac) + ') : caméra remplacée ou conflit d\'IP'); row.state = 'diff'; }
          const sp = parseInt(row.speed, 10);
          if (cf.kbps && sp && cf.kbps > sp * 1000 * 0.5) { notes.push('débit ' + mbps(cf.kbps) + ' sur un port à ' + sp + ' Mb/s'); if (row.state === 'ok' || row.state === 'uplink') row.state = 'debit'; }
          else if (/^(10|100)$/.test(row.speed)) notes.push('port à ' + row.speed + ' Mb/s');
          row.note = notes.join(' ; ');
        } else {
          row.state = 'absent';
          row.note = g.fromCfg && !g.ip && !g.mac ? 'ni IP ni MAC dans la configuration : chargez aussi l\'inventaire matériel pour la localiser'
            : 'absente des tables MAC et ARP relevées : caméra éteinte, débranchée, ou derrière un switch non relevé';
        }
        genRows.push(row);
        (g.cfg || []).forEach(rec => cfgRows.push({ rec, name: row.name, swId: row.swId, port: row.port, netIp: row.netIp, state: row.state }));
      });
      devices.forEach(d => {
        if (d.gen || d.cat !== 'camera') return;
        genRows.push({ name: d.name || '', ip: '', mac: d.mac, manufacturer: d.vendor, model: d.model, firmware: '', archiver: '', gstatus: '',
          swId: d.loc ? d.loc.sw : '', port: d.loc ? d.loc.port : '', vlan: d.vlan || '', speed: '', portState: '', netIp: d.ip || '', how: '', state: 'hors',
          note: 'caméra présente sur le réseau mais absente de l\'inventaire Genetec' });
      });
    }

    // résumé par port
    const portDevices = {};
    devices.forEach(d => { if (d.loc) { const k = d.loc.sw + '|' + d.loc.port; (portDevices[k] = portDevices[k] || []).push(d); } });
    // noms d'usine en double (plusieurs « GS-5220-16S8C ») : on affiche l'IP pour les distinguer
    const nbNom = {}; sws.forEach(s => { const k = normName(s.name); nbNom[k] = (nbNom[k] || 0) + 1; });
    const nomAffiche = s => nbNom[normName(s.name)] > 1 && (s.mgmtIp || (s.ips || [])[0]) ? s.name + ' (' + (s.mgmtIp || s.ips[0]) + ')' : s.name;
    const nodeName = id => {
      if (id.startsWith('sw:')) { const s = sws.find(x => 'sw:' + x.id === id); return s ? nomAffiche(s) : id; }
      const e = ext.get(id); return e ? e.name : id;
    };
    const portRows = [];
    sws.forEach(s => {
      Object.values(PI[s.id]).sort((a, b) => portSortKey(a.port) < portSortKey(b.port) ? -1 : 1).forEach(p => {
        if (/^(Vlan|Fa0$|Ap\d|Nu|Lo)/i.test(p.port) && !p.macCount) { if (!/^Fa0$/.test(p.port)) return; }
        let to = '';
        const ls = links.filter(L => (L.a === 'sw:' + s.id && L.aPort === p.port) || (L.b === 'sw:' + s.id && L.bPort === p.port));
        if (ls.length) to = ls.map(L => { const me = L.a === 'sw:' + s.id && L.aPort === p.port; const other = me ? L.b : L.a; const op = me ? (L.bPort || L.bPortRaw || '?') : L.aPort; return '↔ ' + nodeName(other) + (op ? ' (' + op + ')' : ''); }).join(' ; ');
        const ds = portDevices[s.id + '|' + p.port] || [];
        let devTxt = '';
        if (ds.length && ds.length <= 3) devTxt = ds.map(d => d.name || [d.vendor || CAT_LABEL[d.cat], fmtMac(d.mac)].filter(Boolean).join(' ')).join(' ; ');
        else if (ds.length) devTxt = ds.length + ' équipements : ' + summarize(ds);
        else if (p.cls === 'switch' && p.macCount) devTxt = p.macCount + ' MAC transitent par ce lien';
        portRows.push({
          swId: s.id, switch: s.name, port: p.port, desc: p.desc || '', status: p.status === 'up' ? 'Connecté' : (p.status === 'down' ? 'Déconnecté' : '?'),
          statusRaw: p.statusRaw || '', speed: p.status === 'down' && /^auto$/i.test(p.speed || '') ? '' : (p.speed || ''), mode: p.mode || '', vlan: p.vlan || [...p.vlans].join(','), media: p.media || '', type: p.type || '',
          cls: p.cls, clsLabel: CLASS_LABEL[p.cls] || p.cls, to, devices: devTxt, ips: ds.map(d => d.ip).filter(Boolean).join(' ; '), macCount: p.macCount,
          err: /err-disabled/.test(p.statusRaw || '') ? 'ERR-DISABLED' : ''
        });
      });
    });

    // noeuds
    const nodes = sws.map(s => {
      const located = devices.filter(d => d.loc && d.loc.sw === s.id);
      return { id: 'sw:' + s.id, kind: 'switch', name: nomAffiche(s), ip: s.mgmtIp || (s.ips || [])[0] || ipGuess[s.id] || '', model: (s.model && !/non indiqu/i.test(s.model) ? s.model : '') || shortModel(modelGuess[s.id]) || s.model || '', vendor: s.vendor, location: s.location || '', counts: countCats(located), deviceList: located };
    }).concat([...ext.values()].map(e => Object.assign({ counts: {}, deviceList: [] }, e)));

    const switchLoad = {};
    genRows.forEach(r => { if (!r.swId || r.state === 'hors') return; const L = switchLoad[r.swId] = switchLoad[r.swId] || { cams: 0, kbps: 0, withRate: 0 }; L.cams++; if (r.kbps) { L.kbps += r.kbps; L.withRate++; } });
    // rôles : cœurs détectés automatiquement ou choisis
    const swNodes = nodes.filter(n => n.kind === 'switch');
    const swOf = {}; sws.forEach(s => { swOf['sw:' + s.id] = s; });
    const swAdj = {}; swNodes.forEach(n => { swAdj[n.id] = new Set(); });
    links.forEach(L => { if (swAdj[L.a] && swAdj[L.b] && L.a !== L.b) { swAdj[L.a].add(L.b); swAdj[L.b].add(L.a); } });
    swNodes.forEach(n => {
      const s = swOf[n.id], deg = swAdj[n.id].size, arp = (s.arp || []).length;
      const vlArp = new Set((s.arp || []).map(a => /^vlan\s*\d+$/i.test(a.iface || '') ? String(a.iface).toLowerCase().replace(/\s/g, '') : '').filter(Boolean)).size;
      let svi = Math.max((s.ips || []).length, vlArp);
      if (s.routing === false) svi = Math.min(svi, 1);
      const l3 = /C9[3-6]\d\d|C3850|C4[59]\d\d|C6[58]\d\d|WS-C3[78]|\b6[34]00|\b8[34]\d\d\b|\b54\d\d|38[12]0/i.test(n.model || '');
      n.score = deg * 2 + (svi >= 2 ? 3 : 0) + (arp >= 20 ? 2 : 0) + (l3 ? 1 : 0);
      n.facts = { deg, svi, arp, l3 };
    });
    // Passerelle : MAC (hors switchs relevés) présente dans l'ARP de la plupart des switchs. Le cœur est le switch
    // où elle est branchée directement (port « équipement »), pas derrière un lien vers un autre switch.
    let gw = null;
    {
      const cnt = new Map(), avecArp = sws.filter(s => (s.arp || []).length).length;
      sws.forEach(s => new Set((s.arp || []).map(a => a.mac)).forEach(m => { if (!swOfMac(m)) cnt.set(m, (cnt.get(m) || 0) + 1); }));
      let best = null, bn = 0; cnt.forEach((n, m) => { if (n > bn) { bn = n; best = m; } });
      // la MAC vue partout est souvent celle du PC qui fait le relevé : on préfère la passerelle déclarée par les switchs
      const decl = {}; sws.forEach(s => { if (s.defaultGw) decl[s.defaultGw] = (decl[s.defaultGw] || 0) + 1; });
      const gwIp = Object.keys(decl).sort((x, y) => decl[y] - decl[x])[0];
      if (gwIp) { const vu = {}; sws.forEach(s => (s.arp || []).forEach(a => { if (a.ip === gwIp && a.mac && !/^0+$/.test(a.mac)) vu[a.mac] = (vu[a.mac] || 0) + 1; }));
        const mm = Object.keys(vu).sort((x, y) => vu[y] - vu[x])[0]; if (mm) { best = mm; bn = Math.max(bn, Math.ceil(avecArp * 0.6), 2); } }
      if (best && avecArp >= 2 && bn >= Math.max(2, Math.ceil(avecArp * 0.6))) {
        const ips = []; sws.forEach(s => (s.arp || []).forEach(a => { if (a.mac === best && !ips.includes(a.ip)) ips.push(a.ip); }));
        gw = { mac: best, ips: ips.sort(), sw: '', port: '' };
        sws.forEach(s => (s.macTable || []).forEach(e => {
          if (e.mac !== best) return; const p = PI[s.id][shortPort(e.port)];
          if (p && p.cls !== 'switch' && p.cls !== 'externe') { gw.sw = s.id; gw.port = p.port; }
        }));
      }
    }
    const routeurReleve = swNodes.some(n => n.facts.svi >= 2);
    const gwNode = gw && gw.sw && !routeurReleve ? swNodes.find(n => n.id === 'sw:' + gw.sw) : null;
    if (gwNode) { gwNode.roleAuto = 'coeur'; gwNode.facts.passerelle = gw; }
    // passerelle configurée sur les switchs (« Default Gateway ») : répond-elle en ARP ?
    let gwConfig = null;
    {
      const cnt = {}; sws.forEach(s => { if (s.defaultGw) cnt[s.defaultGw] = (cnt[s.defaultGw] || []).concat(s.name); });
      Object.keys(cnt).forEach(ip => {
        const vus = []; sws.forEach(s => (s.arp || []).forEach(a => { if (a.ip === ip) vus.push(a.mac); }));
        const ok = vus.some(m => m && !/^0+$/.test(m));
        if (!gwConfig || cnt[ip].length > gwConfig.switchs.length) gwConfig = { ip, switchs: cnt[ip], repond: ok, autres: Object.keys(cnt).filter(x => x !== ip) };
      });
    }
    // un cœur route (plusieurs interfaces IP, ou grosse table ARP si la passerelle n'a pas été localisée) ; sinon on prend le plus relié
    const routers = swNodes.filter(n => n.facts.svi >= 2 || (!gwNode && n.facts.arp >= 20));
    if (routers.length) {
      routers.forEach(n => { n.score += 2 * [...swAdj[n.id]].filter(x => routers.some(r => r.id === x)).length; });
      const top = Math.max(...routers.map(n => n.score));
      routers.forEach(n => { if (n.score >= top * 0.5) n.roleAuto = 'coeur'; });
    } else if (swNodes.length > 1 && !gwNode) {
      const top = Math.max(...swNodes.map(n => n.facts.deg));
      if (top >= 2) swNodes.forEach(n => { if (n.facts.deg === top) n.roleAuto = 'coeur'; });
    }
    swNodes.forEach(n => { n.roleAuto = n.roleAuto || ''; n.swRole = swOf[n.id].role || n.roleAuto; });
    // niveau = distance (en liens) au cœur le plus proche
    const q = swNodes.filter(n => n.swRole === 'coeur').map(n => n.id), lvl = {};
    q.forEach(id => { lvl[id] = 0; });
    while (q.length) { const c = q.shift(); swAdj[c].forEach(x => { if (lvl[x] == null) { lvl[x] = lvl[c] + 1; q.push(x); } }); }
    swNodes.forEach(n => {
      n.level = lvl[n.id];
      if (!n.swRole && n.level != null) n.swRoleShown = n.level === 1 && [...swAdj[n.id]].some(x => lvl[x] === 2) ? 'distribution' : 'acces';
    });

    return { nodes, links, devices, portRows, ports: PI, nodeName, genRows, cfgRows, switchLoad, gateway: gw, gwConfig };
  }
  function shortModel(d) { if (!d) return ''; const m = String(d).match(/\b(J\d{4}[A-Z]|JL\d{3}[A-Z]|WS-C[\w\-]+|C9\d{3}[\w\-]*|GS\d{3}[\w\-]*|[A-Z]*GS-\d{4}[\w\-]*|M4\d{3}[\w\-]*|SGS?-[\w\-]+|\d{4}[A-Z]?-\d{2}[A-Z\-]*)/); return m ? m[1] : String(d).slice(0, 40); }
  function countCats(ds) { const c = {}; ds.forEach(d => { c[d.cat] = (c[d.cat] || 0) + 1; }); return c; }
  function summarize(ds) {
    const c = {}; ds.forEach(d => { const k = d.vendor || CAT_LABEL[d.cat] || 'inconnu'; c[k] = (c[k] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + ' ' + k).join(', ');
  }

  /* ---------- disposition automatique ---------- */
  function autoLayout(model, opts) {
    opts = opts || {};
    const vis = model.nodes.filter(n => opts.showExt || n.kind === 'switch' || n.via);
    const ids = vis.map(n => n.id), idSet = new Set(ids), byId = {}, adj = {};
    vis.forEach(n => { byId[n.id] = n; adj[n.id] = []; });
    model.links.forEach(L => { if (idSet.has(L.a) && idSet.has(L.b) && L.a !== L.b && !adj[L.a].includes(L.b)) { adj[L.a].push(L.b); adj[L.b].push(L.a); } });
    const size = id => nodeSize(byId[id], opts);
    const isSw = id => byId[id] && byId[id].kind === 'switch';
    const swDeg = id => adj[id].filter(isSw).length;

    // racines : les cœurs, rangés pour que les cœurs reliés soient voisins
    let cores = vis.filter(n => n.kind === 'switch' && n.swRole === 'coeur').map(n => n.id);
    if (!cores.length) {
      const r = opts.root && idSet.has(opts.root) ? opts.root : ids.filter(isSw).sort((a, b) => swDeg(b) - swDeg(a) || adj[b].length - adj[a].length)[0] || ids[0];
      cores = r ? [r] : [];
    }
    if (cores.length > 1) {
      const left = new Set(cores), ordered = [];
      let cur = cores.slice().sort((a, b) => adj[a].filter(x => left.has(x)).length - adj[b].filter(x => left.has(x)).length)[0];
      while (cur) { ordered.push(cur); left.delete(cur); cur = adj[cur].find(x => left.has(x)) || [...left][0]; }
      cores = ordered;
    }
    // arbre : chaque nœud est rattaché au premier voisin plus proche d'un cœur
    const parent = {}, children = {}, seen = new Set();
    ids.forEach(i => { children[i] = []; });
    const roots = [];
    const grow = rs => {
      const q = rs.slice(); rs.forEach(r => { seen.add(r); roots.push(r); });
      while (q.length) {
        const c = q.shift();
        adj[c].slice().sort((a, b) => (isSw(a) ? 0 : 1) - (isSw(b) ? 0 : 1) || swDeg(b) - swDeg(a))
          .forEach(n => { if (!seen.has(n)) { seen.add(n); parent[n] = c; children[c].push(n); q.push(n); } });
      }
    };
    grow(cores);
    ids.filter(i => !seen.has(i) && isSw(i)).sort((a, b) => swDeg(b) - swDeg(a)).forEach(i => { if (!seen.has(i)) grow([i]); });
    const orphans = ids.filter(i => !seen.has(i));

    const GX = 36, GY = opts.showDevices ? 70 : 90, WRAP = 5;
    const W = {}, plan = {};
    const measure = id => {
      const ch = children[id];
      const leaves = ch.filter(c => !children[c].length), inner = ch.filter(c => children[c].length);
      const wrap = leaves.length > WRAP;
      const cellW = wrap ? Math.max(...leaves.map(c => size(c).w)) : 0;
      const cellH = wrap ? Math.max(...leaves.map(c => size(c).h)) : 0;
      const cols = wrap ? Math.min(leaves.length, WRAP) : 0;
      const leafW = wrap ? cols * (cellW + GX) - GX : 0;
      const sub = wrap ? inner : ch;
      sub.sort((a, b) => (isSw(a) ? 0 : 1) - (isSw(b) ? 0 : 1));
      sub.forEach(measure);
      const innerW = sub.length ? sub.reduce((t, c) => t + W[c], 0) + GX * (sub.length - 1) : 0;
      W[id] = Math.max(size(id).w, leafW, innerW);
      plan[id] = { wrap, leaves: wrap ? leaves : [], sub, cellW, cellH, cols, leafW, innerW };
    };
    const pos = {};
    const place = (id, x, y) => {
      const s = size(id), P = plan[id];
      pos[id] = { x: Math.round(x + (W[id] - s.w) / 2), y: Math.round(y) };
      let ny = y + s.h + GY;
      if (P.wrap) {
        const sx = x + (W[id] - P.leafW) / 2;
        P.leaves.forEach((c, i) => { pos[c] = { x: Math.round(sx + (i % P.cols) * (P.cellW + GX) + (P.cellW - size(c).w) / 2), y: Math.round(ny + Math.floor(i / P.cols) * (P.cellH + 28)) }; });
        ny += Math.ceil(P.leaves.length / P.cols) * (P.cellH + 28) - 28 + GY;
      }
      let cx = x + (W[id] - P.innerW) / 2;
      P.sub.forEach(c => { place(c, cx, ny); cx += W[c] + GX; });
    };
    roots.forEach(measure);
    let x = 40;
    const coreSet = new Set(cores);
    const y0 = cores.length > 1 ? 150 : 40;
    roots.filter(r => coreSet.has(r)).forEach(r => { place(r, x, y0); x += W[r] + GX * 2; });
    // les arbres sans lien avec un cœur et les nœuds isolés sont rangés en dessous
    let maxY = 40; Object.keys(pos).forEach(i => { maxY = Math.max(maxY, pos[i].y + size(i).h); });
    let x2 = 40, y2 = maxY + GY * 1.5, rowH = 0;
    roots.filter(r => !coreSet.has(r)).concat(orphans).forEach(r => {
      if (!plan[r]) measure(r);
      if (x2 > 40 && x2 + W[r] > Math.max(x, 1400)) { x2 = 40; y2 += rowH + GY; rowH = 0; }
      place(r, x2, y2);
      let h = 0; const walk = i => { h = Math.max(h, pos[i].y + size(i).h - y2); children[i].forEach(walk); }; walk(r);
      rowH = Math.max(rowH, h); x2 += W[r] + GX * 2;
    });
    return pos;
  }
  function deviceLines(n, max) {
    const ds = (n.deviceList || []).slice().sort((a, b) => portSortKey(a.loc.port) < portSortKey(b.loc.port) ? -1 : 1);
    const lines = ds.slice(0, max).map(d => d.loc.port + '  ' + (d.name || d.vendor || CAT_LABEL[d.cat]) + (d.ip ? '  ' + d.ip : ''));
    if (ds.length > max) lines.push('… +' + (ds.length - max) + ' autres');
    return lines;
  }
  function nodeSize(n, opts) {
    if (!n) return { w: 160, h: 50 };
    if (n.kind !== 'switch') return { w: 196, h: 52 };
    let h = 78;
    if (opts && opts.showDevices) h += 8 + Math.min(deviceLines(n, opts.maxDevices || 25).length, (opts.maxDevices || 25) + 1) * 13;
    return { w: 230, h };
  }
  function countLine(n) {
    const c = n.counts || {};
    const lab = { camera: 'cam.', serveur: 'serv.', radio: 'radio', interphone: 'interph.', controle: 'contr.', phone: 'tél.', reseau: 'réseau', inconnu: 'autres', virtuel: 'virt.', poste: 'postes' };
    const e = Object.entries(c).filter(([k]) => lab[k]).sort((a, b) => b[1] - a[1]);
    const parts = e.slice(0, 3).map(([k, v]) => v + ' ' + (v === 1 ? lab[k].replace(/s$/, '') : lab[k]));
    const rest = e.slice(3).reduce((a, x) => a + x[1], 0);
    return parts.join(' · ') + (rest ? ' · +' + rest : '');
  }
  function clip(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }
  function modelShort(m) { m = String(m || ''); if (m.length <= 18) return m; const w = m.split(/\s+/); return w.slice(0, 2).join(' '); }

  /* ---------- exports ---------- */
  function xmlEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const ROLE_TAG = { coeur: 'CŒUR', distribution: 'DISTRIB.', acces: '' };
  const ROLE_LABEL = { coeur: 'Cœur', distribution: 'Distribution', acces: 'Accès' };
  function nodeLines(n) {
    if (n.kind === 'switch') return [clip(n.name, 26), clip([ROLE_TAG[n.swRole] || '', n.ip, modelShort(n.model)].filter(Boolean).join(' · '), 36), clip(n.location || '', 36), clip(countLine(n), 36)].filter(Boolean);
    return [clip(n.name, 24), clip([n.role, n.ip].filter(Boolean).join(' · '), 32)].filter(Boolean);
  }
  function linkLabel(L) { if (L.kind === 'ext') return L.aPort || ''; return [L.aPort, L.bPort || L.bPortRaw].filter(Boolean).join(' ↔ ') + (L.speed ? ' · ' + L.speed : ''); }
  function labelT(y1, y2) { return y2 > y1 + 20 ? 0.68 : (y1 > y2 + 20 ? 0.32 : 0.5); }
  // tracé d'un lien : droit, ou en arc au-dessus quand deux nœuds de la même rangée ont d'autres nœuds entre eux
  function linkGeom(a, b, boxes) {
    const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2, x2 = b.x + b.w / 2, y2 = b.y + b.h / 2;
    if (Math.abs(a.y - b.y) < 8) {
      const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
      const between = boxes.some(o => o !== a && o !== b && Math.abs(o.y - a.y) < 8 && o.x + o.w / 2 > lo && o.x + o.w / 2 < hi);
      if (between) {
        const top = Math.min(a.y, b.y), lift = 36 + (hi - lo) * 0.08, cy = top - lift * 2, mx = (x1 + x2) / 2;
        return { d: 'M' + x1 + ' ' + top + ' Q' + mx + ' ' + cy + ' ' + x2 + ' ' + top, lx: mx, ly: top - lift, curved: true };
      }
    }
    const t = labelT(y1, y2);
    return { d: 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2, lx: x1 + (x2 - x1) * t, ly: y1 + (y2 - y1) * t, curved: false };
  }
  const MEDIA_COLOR = { fibre: '#D9730D', cuivre: '#5B6472', '': '#8A94A6' };

  function toDrawio(model, pos, opts) {
    opts = opts || {};
    const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
    const shown = model.nodes.filter(n => pos[n.id]);
    const cid = {}; let c = 2;
    shown.forEach(n => {
      const id = 'n' + (c++); cid[n.id] = id;
      const p = pos[n.id], sz = { w: 230, h: n.kind === 'switch' ? 78 : 52 };
      if (n.kind !== 'switch') sz.w = 196;
      const style = n.kind === 'switch' && n.swRole === 'coeur'
        ? 'rounded=1;whiteSpace=wrap;html=0;arcSize=8;fillColor=#D3ECEF;strokeColor=#0B7480;strokeWidth=3;fontSize=11;fontColor=#0B2E33;fontStyle=1;verticalAlign=middle;'
        : n.kind === 'switch'
        ? 'rounded=1;whiteSpace=wrap;html=0;arcSize=8;fillColor=#E8EFFC;strokeColor=#2F5FD0;strokeWidth=2;fontSize=11;fontColor=#14213D;verticalAlign=middle;'
        : 'rounded=1;whiteSpace=wrap;html=0;arcSize=12;dashed=1;fillColor=#F4F4F5;strokeColor=#8A94A6;fontSize=10;fontColor=#3F3F46;';
      cells.push('<mxCell id="' + id + '" value="' + xmlEsc(nodeLines(n).join('\n')).replace(/\n/g, '&#xa;') + '" style="' + style + '" vertex="1" parent="1"><mxGeometry x="' + p.x + '" y="' + p.y + '" width="' + sz.w + '" height="' + sz.h + '" as="geometry"/></mxCell>');
      if (opts.showDevices && n.kind === 'switch' && n.deviceList.length) {
        const lines = deviceLines(n, opts.maxDevices || 25);
        const h = 10 + lines.length * 13;
        cells.push('<mxCell id="' + id + 'd" value="' + xmlEsc(lines.join('\n')).replace(/\n/g, '&#xa;') + '" style="rounded=0;whiteSpace=wrap;html=0;align=left;verticalAlign=top;spacingLeft=6;spacingTop=3;fillColor=#FFFFFF;strokeColor=#C9CFDA;fontSize=9;fontColor=#3F3F46;fontFamily=Courier New;" vertex="1" parent="1"><mxGeometry x="' + p.x + '" y="' + (p.y + 82) + '" width="230" height="' + h + '" as="geometry"/></mxCell>');
      }
    });
    model.links.forEach((L, i) => {
      if (!cid[L.a] || !cid[L.b]) return;
      const col = MEDIA_COLOR[L.media] || MEDIA_COLOR[''];
      const dash = (L.kind === 'ext' || L.deduit) ? 'dashed=1;' : '';
      const pa = pos[L.a], pb = pos[L.b];
      const lx = pa && pb ? ((labelT(pa.y, pb.y) - 0.5) * 2).toFixed(2) : '0';
      cells.push('<mxCell id="e' + i + '" value="' + xmlEsc(linkLabel(L)) + '" style="endArrow=none;html=0;strokeWidth=2;strokeColor=' + col + ';' + dash + 'fontSize=9;fontColor=#14213D;labelBackgroundColor=#FFFFFF;edgeStyle=none;" edge="1" parent="1" source="' + cid[L.a] + '" target="' + cid[L.b] + '"><mxGeometry x="' + lx + '" relative="1" as="geometry"/></mxCell>');
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="carto-reseau"><diagram id="carto" name="' + xmlEsc(opts.title || 'Cartographie') + '"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0"><root>' + cells.join('') + '</root></mxGraphModel></diagram></mxfile>';
  }

  function toSvg(model, pos, opts) {
    opts = opts || {};
    const shown = model.nodes.filter(n => pos[n.id]);
    let W = 200, H = 200;
    const boxes = {};
    shown.forEach(n => {
      const s = nodeSize(n, opts); const p = pos[n.id];
      boxes[n.id] = { x: p.x, y: p.y, w: s.w, h: n.kind === 'switch' ? 78 : 52, full: s.h };
      W = Math.max(W, p.x + s.w + 40); H = Math.max(H, p.y + s.h + 40);
    });
    const out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Arial, Helvetica, sans-serif">');
    out.push('<rect width="100%" height="100%" fill="#FFFFFF"/>');
    if (opts.title) out.push('<text x="40" y="26" font-size="16" font-weight="bold" fill="#14213D">' + xmlEsc(opts.title) + '</text>');
    const allB = Object.values(boxes);
    model.links.forEach(L => {
      const a = boxes[L.a], b = boxes[L.b]; if (!a || !b) return;
      const col = MEDIA_COLOR[L.media] || MEDIA_COLOR[''];
      const gm = linkGeom(a, b, allB);
      out.push('<path d="' + gm.d + '" fill="none" stroke="' + col + '" stroke-width="2"' + (L.kind === 'ext' || L.deduit ? ' stroke-dasharray="6 4"' : '') + '/>');
      const lab = linkLabel(L);
      if (lab) {
        const mx = gm.lx, my = gm.ly, w = lab.length * 5.6 + 10;
        out.push('<rect x="' + (mx - w / 2) + '" y="' + (my - 8) + '" width="' + w + '" height="16" rx="3" fill="#FFFFFF" stroke="' + col + '" stroke-width="0.6"/>');
        out.push('<text x="' + mx + '" y="' + (my + 4) + '" font-size="10" text-anchor="middle" fill="#14213D">' + xmlEsc(lab) + '</text>');
      }
    });
    shown.forEach(n => {
      const b = boxes[n.id];
      const sw = n.kind === 'switch';
      const core = sw && n.swRole === 'coeur';
      out.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="' + (sw ? 6 : 8) + '" fill="' + (core ? '#D3ECEF' : sw ? '#E8EFFC' : '#F4F4F5') + '" stroke="' + (core ? '#0B7480' : sw ? '#2F5FD0' : '#8A94A6') + '" stroke-width="' + (core ? 3 : sw ? 2 : 1.2) + '"' + (sw ? '' : ' stroke-dasharray="5 3"') + '/>');
      nodeLines(n).forEach((t, i) => {
        out.push('<text x="' + (b.x + b.w / 2) + '" y="' + (b.y + 18 + i * 15) + '" font-size="' + (i === 0 ? 13 : 10) + '"' + (i === 0 ? ' font-weight="bold"' : '') + ' text-anchor="middle" fill="' + (sw ? '#14213D' : '#3F3F46') + '">' + xmlEsc(t) + '</text>');
      });
      if (opts.showDevices && sw && n.deviceList.length) {
        const lines = deviceLines(n, opts.maxDevices || 25);
        const y0 = b.y + b.h + 4, h = 10 + lines.length * 13;
        out.push('<rect x="' + b.x + '" y="' + y0 + '" width="' + b.w + '" height="' + h + '" fill="#FFFFFF" stroke="#C9CFDA"/>');
        lines.forEach((t, i) => out.push('<text x="' + (b.x + 6) + '" y="' + (y0 + 14 + i * 13) + '" font-size="9" font-family="Courier New, monospace" fill="#3F3F46">' + xmlEsc(t) + '</text>'));
      }
    });
    out.push('</svg>');
    return out.join('\n');
  }

  /* ---------- import inventaire Genetec (CSV / Excel) ---------- */
  function fold(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  const GCOLS = [
    ['mac', /^(mac|mac address|adresse mac|physical address|adresse physique)$/, /\b(mac|physical|physique)\b/],
    ['ip', /^(ip|ip address|adresse ip|ipv4|ipv4 address|adresse ipv4)$/, /\bip(v4)?\b/],
    ['name', /^(name|nom|entity|entite|entity name|nom de l entite|camera|camera name|nom de la camera|unit|unite|unit name|nom de l unite|video unit|unite video|source)$/, /\b(name|nom|camera)\b/],
    ['manufacturer', /^(manufacturer|fabricant|constructeur|vendor|marque)$/, /(manufacturer|fabricant|constructeur)/],
    ['model', /^(product type|type de produit|model|modele|product|produit|type)$/, /(product type|type de produit|modele|model)/],
    ['firmware', /^(firmware|firmware version|version du micrologiciel|micrologiciel|version)$/, /(firmware|micrologiciel)/],
    ['archiver', /^(archiver|archiveur|role|role archiveur)$/, /(archiver|archiveur)/],
    ['status', /^(status|statut|etat|state)$/, /(status|statut|etat)/]
  ];
  function mapColumns(headers) {
    const H = headers.map(fold), used = new Set(), map = {};
    for (const pass of [1, 2]) {
      GCOLS.forEach(([k, exact, loose]) => {
        if (map[k] != null) return;
        const re = pass === 1 ? exact : loose;
        const i = H.findIndex((h, j) => h && !used.has(j) && re.test(h) && !(k === 'name' && /(host|hote|archiv|serveur|server|user|utilisateur)/.test(h)));
        if (i >= 0) { map[k] = i; used.add(i); }
      });
    }
    return map;
  }
  function parseCsvText(text) {
    text = String(text || '').replace(/^﻿/, '');
    const head = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 8).join('\n');
    const cnt = d => (head.match(new RegExp(d === '\t' ? '\t' : '\\' + d, 'g')) || []).length;
    const delim = [';', ',', '\t'].sort((a, b) => cnt(b) - cnt(a))[0];
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
      if (c === '"' && cur === '') { q = true; continue; }
      if (c === delim) { row.push(cur); cur = ''; continue; }
      if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; continue; }
      cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function parseGenetecRows(rows, source) {
    let best = null;
    for (let r = 0; r < Math.min(rows.length, 25); r++) {
      const map = mapColumns(rows[r].map(String));
      const score = Object.keys(map).length;
      if ((map.mac != null || map.ip != null) && score >= 2 && (!best || score > best.score)) best = { r, map, score };
    }
    if (!best) return { error: 'colonnes', headers: (rows[0] || []).map(String).filter(Boolean) };
    const m = best.map, cell = (row, k) => m[k] != null ? String(row[m[k]] == null ? '' : row[m[k]]).trim() : '';
    const groups = new Map();
    rows.slice(best.r + 1).forEach(row => {
      if (!row || !row.some(v => String(v).trim())) return;
      const macCell = cell(row, 'mac'); const mm = macCell.match(new RegExp(MAC_SRC, 'i')) || [macCell];
      const mac = normMac(mm[0]);
      const ipm = cell(row, 'ip').match(IPV4); const ip = ipm ? ipm[0] : '';
      if (!mac && !ip) return;
      const key = mac || ip;
      const u = groups.get(key) || { name: '', names: [], ip, mac, manufacturer: '', model: '', firmware: '', archiver: '', status: '' };
      const nm = cell(row, 'name'); if (nm && !u.names.includes(nm)) u.names.push(nm);
      ['manufacturer', 'model', 'firmware', 'archiver', 'status'].forEach(k => { if (!u[k]) u[k] = cell(row, k); });
      if (!u.ip) u.ip = ip; if (!u.mac) u.mac = mac;
      groups.set(key, u);
    });
    const units = [...groups.values()].map(u => { u.name = u.names.slice(0, 4).join(' / ') + (u.names.length > 4 ? ' …' : ''); delete u.names; return u; });
    const labels = { name: 'Nom', ip: 'IP', mac: 'MAC', manufacturer: 'Fabricant', model: 'Modèle', firmware: 'Firmware', archiver: 'Archiveur', status: 'État' };
    const header = rows[best.r].map(String);
    return { units, source: source || '', importedAt: new Date().toISOString(), cols: Object.keys(m).map(k => labels[k] + ' ← « ' + header[m[k]] + ' »') };
  }

  function mapWith(defs, headers, used) {
    const H = headers.map(fold), map = {};
    for (const pass of [1, 2]) {
      defs.forEach(([k, exact, loose]) => {
        if (map[k] != null) return;
        const re = pass === 1 ? exact : loose;
        const i = H.findIndex((h, j) => h && !used.has(j) && re.test(h) && !(k === 'name' && /(host|hote|archiv|serveur|server|user|utilisateur)/.test(h)));
        if (i >= 0) { map[k] = i; used.add(i); }
      });
    }
    return map;
  }
  const CFG_KEYS = [
    ['mac', /^(mac|mac address|adresse mac|physical address|adresse physique)$/, /\b(mac|physical|physique)\b/],
    ['ip', /^(ip|ip address|adresse ip|ipv4|adresse ipv4)$/, /\bip(v4)?\b/],
    ['unit', /^(unit|unite|video unit|unite video|unit name|nom de l unite|parent)$/, /\b(unit|unite)\b/],
    ['name', /^(name|nom|camera|camera name|nom de la camera|entity|entite|nom de l entite|source)$/, /\b(name|nom|camera)\b/]
  ];
  const CFG_FIELDS = [
    ['stream', /^(stream|flux|usage|utilisation|stream usage|usage du flux|type de flux|nom du flux)$/, /\b(stream|flux|usage)\b/],
    ['resolution', /^resolution$/, /resolution/],
    ['fps', /^(fps|image rate|frame rate|images par seconde|cadence|frequence d images|cadence d images)$/, /(image rate|frame rate|images par|fps|cadence|frequence d image)/],
    ['bitrate', /^(bit rate|bitrate|debit|debit binaire|bandwidth|bande passante|debit binaire kbps)$/, /(bit ?rate|debit|bandwidth|bande passante)/],
    ['codec', /^(codec|format|encoding|compression|encodage|video format|format video)$/, /(codec|encod|compression)/],
    ['quality', /^(quality|qualite|image quality|qualite d image)$/, /qualit/],
    ['recording', /^(recording|enregistrement|recording mode|mode d enregistrement)$/, /(recording|enregistrement)/],
    ['keyframe', /^(key frame interval|keyframe interval|intervalle d images cles|gop)$/, /(key ?frame|images? cles?|gop)/]
  ];
  function parseKbps(v, header) {
    let t = String(v || '').replace(/(\d)[\s  ]+(?=\d)/g, '$1');
    const m = t.match(/(\d+(?:[.,]\d+)?)/); if (!m) return 0;
    let n = parseFloat(m[1].replace(',', '.'));
    const u = (t + ' ' + (header || '')).toLowerCase();
    if (/(gbit|gb\/s|gbps)/.test(u)) n *= 1e6;
    else if (/(mbit|mb\/s|mbps)/.test(u)) n *= 1000;
    else if (/(kbit|kb\/s|kbps|kb)/.test(u)) n *= 1;
    else if (/\b(bps|bit\/s|b\/s)\b/.test(u)) n /= 1000;
    else if (n < 100) n *= 1000;
    return Math.round(n);
  }
  function mbps(k) { return (k / 1000).toFixed(k < 10000 ? 1 : 0).replace('.', ',') + ' Mb/s'; }
  function summarizeCfg(list) {
    if (!list.length) return { text: '', kbps: 0 };
    const seen = new Set(), parts = [];
    list.forEach(r => {
      const fps = r.fps && /^\d+([.,]\d+)?$/.test(r.fps) ? r.fps + ' i/s' : r.fps;
      const t = (r.stream ? r.stream + ' : ' : '') + [r.resolution, fps, r.kbps ? mbps(r.kbps) : r.bitrate, r.codec, r.quality ? 'qualité ' + r.quality : ''].filter(Boolean).join(' · ');
      if (t && !seen.has(t)) { seen.add(t); parts.push(t); }
    });
    const rec = list.filter(r => /(enreg|record|archiv)/i.test(r.stream + ' ' + r.recording) && r.kbps);
    const kbps = rec.length ? Math.max(...rec.map(r => r.kbps)) : Math.max(0, ...list.map(r => r.kbps || 0));
    return { text: parts.join(' | '), kbps };
  }
  function headerOf(rows, defsA, defsB) {
    let best = null;
    for (let r = 0; r < Math.min(rows.length, 25); r++) {
      const hdr = (rows[r] || []).map(String), used = new Set();
      const keys = mapWith(defsA, hdr, used), fields = mapWith(defsB, hdr, used);
      const nk = Object.keys(keys).length, nf = Object.keys(fields).length;
      if (nk >= 1 && (!best || nk + nf > best.nk + best.nf)) best = { r, hdr, keys, fields, nk, nf };
    }
    return best;
  }
  function classifyGenetec(rows) { const b = headerOf(rows, CFG_KEYS, CFG_FIELDS); return b && b.nf >= 2 ? 'cfg' : 'inv'; }
  function parseGenetecConfig(rows, source) {
    const best = headerOf(rows, CFG_KEYS, CFG_FIELDS);
    if (!best || !best.nf) return { error: 'colonnes', headers: (rows[0] || []).map(String).filter(Boolean) };
    const col = Object.assign({}, best.keys, best.fields);
    const out = [];
    rows.slice(best.r + 1).forEach(row => {
      if (!row || !row.some(v => String(v).trim())) return;
      const c = k => col[k] != null ? String(row[col[k]] == null ? '' : row[col[k]]).trim() : '';
      const macm = c('mac').match(new RegExp(MAC_SRC, 'i')), ipm = c('ip').match(IPV4);
      const rec = { name: c('name'), unit: c('unit'), mac: macm ? normMac(macm[0]) : '', ip: ipm ? ipm[0] : '',
        stream: c('stream'), resolution: c('resolution'), fps: c('fps'), bitrate: c('bitrate'), codec: c('codec'), quality: c('quality'), recording: c('recording'), keyframe: c('keyframe'),
        cells: best.hdr.map((h, i) => String(row[i] == null ? '' : row[i]).trim()) };
      if (!rec.name && !rec.unit && !rec.mac && !rec.ip) return;
      rec.kbps = col.bitrate != null ? parseKbps(rec.bitrate, best.hdr[col.bitrate]) : 0;
      out.push(rec);
    });
    const labels = { name: 'Caméra', unit: 'Unité', ip: 'IP', mac: 'MAC', stream: 'Flux', resolution: 'Résolution', fps: 'Images/s', bitrate: 'Débit', codec: 'Codec', quality: 'Qualité', recording: 'Enregistrement', keyframe: 'Images clés' };
    return { rows: out, headers: best.hdr, source: source || '', importedAt: new Date().toISOString(), cols: Object.keys(col).map(k => labels[k] + ' ← « ' + best.hdr[col[k]] + ' »') };
  }

  const API = { parseMikrotik, parseLldpPipe, OID_MODELE, linkGeom, ROLE_LABEL, classifyGenetec, parseGenetecConfig, parseKbps, mbps, parseCsvText, parseGenetecRows, mapColumns, labelT, normMac, fmtMac, shortPort, isPortTok, portSortKey, detectVendor, parseIdentity, parseCDP, parseLLDP, parseMacArp, parsePorts, parseSwitch, analyze, autoLayout, nodeSize, nodeLines, linkLabel, deviceLines, countLine, toDrawio, toSvg, ouiOf, CAT_LABEL, CLASS_LABEL, MEDIA_COLOR, summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CartoCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
