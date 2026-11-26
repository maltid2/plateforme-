// Analyse complémentaire, reprise telle quelle de « Cartographie Réseau v3.2 » (CartoV2) :
// relevés par marque, VLAN, trunks, LAG, PoE, anomalies. Ne pas modifier ici.
/* Carto Réseau v2 — analyse complémentaire (sans dépendance, hors ligne).
   S'appuie sur CartoCore (parseur et disposition d'origine, inchangés) et ajoute :
   relevés au format annexe A (### par commande), import du JSON du collecteur, VLAN, trunks, LAG,
   STP, PoE, erreurs, anomalies, état de santé, disposition par niveaux, export Excel (.xlsx) natif. */
(function (root) {
  'use strict';
  const C = root.CartoCore;
  const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/;
  const MAC_G = /(?<![0-9a-f])(?:[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}|[0-9a-f]{2}(?:[:\-][0-9a-f]{2}){5}|[0-9a-f]{6}-[0-9a-f]{6}|[0-9a-f]{2}(?: [0-9a-f]{2}){5})(?![0-9a-f])/ig;
  const arr = v => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const normMac = C.normMac;
  let _n = 0;
  const newId = () => 'v' + Date.now().toString(36) + (++_n).toString(36) + Math.random().toString(36).slice(2, 6);

  const VENDOR_LABEL = { cisco: 'Cisco IOS / IOS-XE', arubacx: 'Aruba CX', hp: 'HP / ArubaOS-Switch', comware: 'HP / H3C Comware', netgear: 'Netgear', planet: 'Planet', comnet: 'ComNet', mikrotik: 'MikroTik RouterOS', generic: 'Inconnue', '': 'Inconnue' };
  /* Fiabilité des parseurs par marque (spec-reseau : [C] confirmé, [P] probable, [V] à vérifier) */
  const VENDOR_FIAB = { cisco: 'C', arubacx: 'C', hp: 'C', comware: 'C', netgear: 'V', planet: 'C', comnet: 'V', mikrotik: 'C' };

  /* ---------- utilitaires ---------- */
  function getVal(t, labels) {
    for (const l of labels) {
      const re = new RegExp('^[ \\t]*' + l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[ \\t]*(?:\\.{2,}|:)[ \\t]*(.+?)[ \\t\\r]*$', 'im');   // jamais la ligne suivante si la valeur est vide
      const m = String(t || '').match(re);
      if (m && m[1].trim() && !/^Default (?:Location|Contact)$/i.test(m[1].trim())) return m[1].trim();
    }
    return '';
  }
  function expandVlans(txt) {
    const out = new Set();
    String(txt || '').split(/[,\s]+/).filter(Boolean).forEach(p => {
      const m = p.match(/^(\d{1,4})(?:-(\d{1,4}))?$/);
      if (!m) return;
      const a = +m[1], b = m[2] ? +m[2] : a;
      if (b - a > 4094) return;
      for (let i = a; i <= b && i <= 4094; i++) out.add(i);
    });
    return [...out].sort((x, y) => x - y);
  }
  function compactVlans(list) {
    const v = [...new Set(list)].sort((a, b) => a - b), out = [];
    for (let i = 0; i < v.length; i++) {
      let j = i; while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++;
      out.push(j > i ? v[i] + '-' + v[j] : String(v[i])); i = j;
    }
    return out.join(',');
  }
  /* « 1/1/1-1/1/3,1/1/5 » ou « GE1-GE3,GE25 » -> liste de ports */
  function expandPorts(txt) {
    const out = [];
    String(txt || '').split(/[,\s]+/).filter(Boolean).forEach(p => {
      const m = p.match(/^(.*?)(\d+)-(?:\1)?(\d+)$/);
      if (m && +m[3] >= +m[2] && +m[3] - +m[2] < 600) { for (let i = +m[2]; i <= +m[3]; i++) out.push(m[1] + i); }
      else out.push(p);
    });
    return out.map(C.shortPort);
  }
  function speedLabel(sp) {
    const s = String(sp || '').replace(/^a-/, '').trim();
    if (!s || /^(auto|--|n\/a)$/i.test(s)) return '';
    if (/^\d+G$/i.test(s)) return s.toUpperCase();
    const n = parseInt(s, 10);
    if (/^\d+$/.test(s)) return n >= 1000 ? (n / 1000) + 'G' : n + 'M';
    if (/^(\d+)\s*(full|half|fdx|hdx)/i.test(s)) { const k = parseInt(s, 10); return k >= 1000 ? (k / 1000) + 'G' : k + 'M'; }
    if (/^(\d+)(FDx|HDx)$/i.test(s)) { const k = parseInt(s, 10); return k >= 1000 ? (k / 1000) + 'G' : k + 'M'; }
    if (/^10GigFD/i.test(s)) return '10G';
    return s;
  }
  function speedMbps(sp) {
    const l = speedLabel(sp); if (!l) return 0;
    const m = l.match(/^(\d+(?:\.\d+)?)([GM])$/i); if (!m) return 0;
    return parseFloat(m[1]) * (m[2].toUpperCase() === 'G' ? 1000 : 1);
  }
  const isLagName = p => /^(Po|Port-channel|lag|Trk|ch)\d+$/i.test(String(p || ''));
  const isPhysical = p => !/^(Vlan|Lo|Nu|Tu|Po|Port-channel|lag|Trk|ch|Ap|Fa0$|Gi0\/0$|mgmt)/i.test(String(p || ''));

  /* ---------- relevé annexe A ---------- */
  function splitReleve(text) {
    text = String(text || '').replace(/\r/g, '').replace(/^﻿/, '');
    if (!/^### \S/m.test(text)) return null;
    const meta = {};
    const h = text.match(/^=== (.*?) ===\s*$/m);
    if (h) h[1].replace(/(\w+)=(.*?)(?=\s+\w+=|$)/g, (_, k, v) => { meta[k] = v.trim(); return ''; });
    const m2 = text.match(/^# ip=(\S*) alias=(\S*) etat=(\S*) privilege=(\S*)/m);
    if (m2) { meta.ip = m2[1]; meta.alias = m2[2] ? m2[2].split(',').filter(Boolean) : []; meta.etat = m2[3]; meta.privilege = m2[4]; }
    const m3 = text.match(/^# commandes non obtenues : (.*)$/m);
    meta.manquantes = m3 ? m3[1].split(' ; ').filter(Boolean) : [];
    const S = {}, order = [];
    const re = /^### (.+)$/gm; let m, last = null;
    while ((m = re.exec(text))) {
      if (last) S[last.cmd] = text.slice(last.start, m.index).replace(/\n$/, '');
      last = { cmd: m[1].trim(), start: m.index + m[0].length + 1 }; order.push(last.cmd);
    }
    if (last) S[last.cmd] = text.slice(last.start).replace(/\n+$/, '');
    return { meta, S, order };
  }
  function releveFromEquipement(e) {
    return '=== nom=' + (e.nom || e.ip) + ' marque=' + (e.marque || '') + ' profondeur=' + (e.profondeur == null ? '' : e.profondeur) + ' date=' + (e.date || '') + ' ===\n'
      + '# ip=' + (e.ip || '') + ' alias=' + arr(e.alias).join(',') + ' etat=' + (e.etat || '') + ' privilege=' + (e.privilege || '') + '\n'
      + arr(e.sorties).map(x => '### ' + x.commande + '\n' + String(x.texte || '')).join('\n');
  }

  /* ---------- parseurs complémentaires ---------- */
  function headerCols(line) {
    const cols = []; const re = /\S+(?: \S+)*/g; let m;
    while ((m = re.exec(line))) cols.push({ t: m[0].toLowerCase(), s: m.index, e: m.index + m[0].length });
    return cols;
  }
  /* Tables à colonnes fixes « Port  Name  Status  Vlan  Duplex  Speed  Type » (ComNet, Planet…) [V] */
  function parsePortsPositional(text) {
    const ports = {};
    const lines = String(text || '').split('\n');
    let hdr = -1;
    for (let i = 0; i < lines.length; i++) if (/^\s*port\b/i.test(lines[i]) && /status/i.test(lines[i])) { hdr = i; break; }
    if (hdr < 0) return ports;
    for (let i = hdr + 1; i < lines.length; i++) {
      const l = lines[i]; if (!l.trim() || /^[\s\-=+]+$/.test(l)) continue;
      const m = l.match(/^\s*(\S+)\s+(.*?)\s*\b(connected|notconnect|disabled|err-disabled|up|down|link-up|link-down)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/i);
      if (!m) continue;
      const st = m[3].toLowerCase(), vl = m[4];
      const k = C.shortPort(m[1]);
      ports[k] = { port: k, desc: m[2].trim(), status: /^(connected|up|link-up)$/.test(st) ? 'up' : 'down', statusRaw: m[3], vlan: /^(trunk|routed)$/i.test(vl) ? '' : vl,
        mode: /trunk/i.test(vl) ? 'trunk' : 'access', duplex: m[5].replace(/^a-/, ''), speed: m[6].replace(/^a-/, ''), type: m[7].trim(), media: (C.MEDIA_COLOR && /SX|LX|Fib|SFP|BASE-[SLB]X/i.test(m[7])) ? 'fibre' : (/TX|Copper|RJ45|BaseT/i.test(m[7]) ? 'cuivre' : '') };
    }
    return ports;
  }
  /* Netgear « show port all » [V] */
  function parseNetgearPorts(text) {
    const ports = {};
    String(text || '').split('\n').forEach(l => {
      const m = l.match(/^\s*(\d+\/\d+(?:\/\d+)?|lag \d+)\s+(?:\S+\s+)?(Enable|Disable)\s+(\S+)\s+(?:(\d+)\s+(Full|Half)\s+)?(Up|Down)\b/i);
      if (!m) return;
      const k = C.shortPort(m[1].replace(' ', ''));
      ports[k] = { port: k, status: /up/i.test(m[6]) ? 'up' : 'down', statusRaw: /disable/i.test(m[2]) ? 'disabled' : m[6], speed: m[4] || '', duplex: (m[5] || '').toLowerCase(), mode: '', vlan: '', type: '', media: '', desc: '' };
    });
    return ports;
  }
  /* Table MAC à colonnes (repli quand le parseur d'origine ne trouve pas de port : ComNet « 2 », Planet « GE3 »…) */
  function parseMacPositional(text) {
    const out = [];
    const lines = String(text || '').split('\n');
    let pc = -1, vc = -1;
    for (const l of lines) {
      if (/mac/i.test(l) && /(port|interface|intf)/i.test(l) && !MAC_G.test(l)) {
        MAC_G.lastIndex = 0;
        const cols = headerCols(l);
        const p = cols.find(c => /^(ports?|interface|intf)$/.test(c.t) || /^ports?$/.test(c.t.split(' ').pop()));
        const v = cols.find(c => /^vlan( id)?$/.test(c.t));
        pc = p ? p.s : -1; vc = v ? v.s : -1; continue;
      }
      MAC_G.lastIndex = 0;
      const mm = l.match(MAC_G); if (!mm || mm.length !== 1 || pc < 0) continue;
      const mac = normMac(mm[0]); if (!mac || (parseInt(mac.slice(0, 2), 16) & 1)) continue;
      const tok = re => { const r = /\S+/g; let x; while ((x = r.exec(l))) { if (x.index + x[0].length > re && x.index <= re + 2) return x[0]; } return ''; };
      const port = tok(pc); const vlan = vc >= 0 ? tok(vc) : '';
      if (!port || /^cpu$/i.test(port)) continue;
      out.push({ mac, vlan: /^\d{1,4}$/.test(vlan) ? vlan : '', port: C.shortPort(port) });
    }
    return out;
  }
  /* Liste LLDP sans détail (ComNet, Planet) : port local, chassis, port distant, nom [V] */
  function parseLldpList(text) {
    const res = [];
    String(text || '').split('\n').forEach(l => {
      if (/^\s*(local|interface|---)/i.test(l)) return;
      MAC_G.lastIndex = 0; const mm = l.match(MAC_G); if (!mm) return;
      const cols = l.trim().split(/\s{2,}/).filter(Boolean); if (cols.length < 3) return;
      const name = cols[cols.length - 1] === mm[0] ? '' : cols[cols.length - 1];
      const idx = cols.indexOf(mm[0]);
      res.push({ proto: 'LLDP', localPort: C.shortPort(cols[0]), name, ip: '', platform: '', caps: [], portId: idx >= 0 && idx + 1 < cols.length - 1 ? cols[idx + 1] : '', portDescr: '', chassis: normMac(mm[0]), descr: '' });
    });
    return res;
  }
  function parseVlans(vendor, S) {
    const t = S['show vlan brief'] || S['show vlan'] || S['show vlans'] || '';
    const v = {};
    const add = (id, name, ports) => { if (+id >= 1002 && +id <= 1005) return; const o = v[id] = v[id] || { id: +id, name: name || '', ports: [] }; if (name && !o.name) o.name = name; (ports || []).forEach(p => { if (!o.ports.includes(p)) o.ports.push(p); }); };
    let cur = null;
    String(t).split('\n').forEach(l => {
      let m;
      if (vendor === 'cisco' && (m = l.match(/^(\d{1,4})\s+(\S+)\s+(active|act\/lshut|suspended|act\/unsup|sus\/lshut)\s*(.*)$/))) {
        cur = m[1]; add(m[1], m[2], m[4].split(/,\s*/).filter(Boolean).map(C.shortPort)); return;
      }
      if (vendor === 'cisco' && cur && (m = l.match(/^\s{20,}(\S.*)$/))) { add(cur, '', m[1].split(/,\s*/).filter(Boolean).map(C.shortPort)); return; }
      if (vendor === 'arubacx' && (m = l.match(/^(\d{1,4})\s+(\S+)\s+(up|down)\s+\S+\s+\S+\s*(.*)$/))) { add(m[1], m[2], expandPorts(m[4])); return; }
      if (vendor === 'hp' && (m = l.match(/^\s*(\d{1,4})\s+(\S.*?)\s+\|/))) { add(m[1], m[2], []); return; }
      if ((m = l.match(/^\s*(\d{1,4})\s+(\S+)\s+(Default|Static|Dynamic|Port-based)\b\s*(.*)$/i))) { add(m[1], m[2], expandPorts(m[4] || '')); return; }
    });
    return Object.values(v).sort((a, b) => a.id - b.id);
  }
  function parseCiscoTrunks(text) {
    const res = {}; let mode = '';
    const lines = String(text || '').split('\n');
    let lastPort = null;
    lines.forEach(l => {
      if (/^Port\s+Mode\s+Encapsulation/i.test(l)) { mode = 'etat'; return; }
      if (/^Port\s+Vlans allowed on trunk/i.test(l)) { mode = 'autorises'; return; }
      if (/^Port\s+Vlans allowed and active/i.test(l)) { mode = 'actifs'; return; }
      if (/^Port\s+Vlans in spanning tree/i.test(l)) { mode = 'stp'; return; }
      if (!l.trim()) { lastPort = null; return; }
      let m;
      if (mode === 'etat' && (m = l.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s*$/))) { const k = C.shortPort(m[1]); res[k] = Object.assign(res[k] || {}, { port: k, mode: m[2], status: m[4], native: m[5] }); return; }
      if (mode === 'autorises' || mode === 'actifs') {
        if ((m = l.match(/^(\S+)\s+([\d,\-]+|none)\s*$/))) { const k = C.shortPort(m[1]); lastPort = k; res[k] = res[k] || { port: k }; res[k][mode] = (res[k][mode] ? res[k][mode] + ',' : '') + (m[2] === 'none' ? '' : m[2]); return; }
        if (lastPort && (m = l.match(/^\s+([\d,\-]+)\s*$/))) { res[lastPort][mode] = (res[lastPort][mode] || '') + m[1]; return; }
      }
    });
    Object.values(res).forEach(r => { r.allowed = r.autorises != null ? expandVlans(r.autorises) : null; });
    return res;
  }
  function parseLags(vendor, S) {
    const lags = [];
    let t = S['show etherchannel summary'];
    if (t) {
      let cur = null;
      t.split('\n').forEach(l => {
        let m = l.match(/^(\d+)\s+((?:Po|Port-channel)\d+)\(([A-Za-z]+)\)\s+(\S+)\s*(.*)$/);
        const members = s => { const out = []; const re = /(\S+?)\(([A-Za-z]+)\)/g; let x; while ((x = re.exec(s))) out.push({ port: C.shortPort(x[1]), flags: x[2] }); return out; };
        if (m) { cur = { id: C.shortPort(m[2]), group: m[1], flags: m[3], proto: m[4] === '-' ? 'statique' : m[4], members: members(m[5]) }; lags.push(cur); return; }
        if (cur && (m = l.match(/^\s{10,}((?:\S+\([A-Za-z]+\)\s*)+)$/))) cur.members.push(...members(m[1]));
      });
      lags.forEach(g => { g.up = /U/.test(g.flags) && !/D/.test(g.flags); g.members.forEach(x => { x.ok = /P/.test(x.flags); x.etat = x.ok ? 'en service' : /s/.test(x.flags) ? 'suspendu' : /D/.test(x.flags) ? 'hors service' : /I/.test(x.flags) ? 'isolé (stand-alone)' : /H/.test(x.flags) ? 'secours (hot-standby)' : x.flags; }); });
    }
    t = S['show lacp interfaces'];
    if (vendor === 'arubacx' && t) {   // [P] format à valider
      const by = {};
      t.split('\n').forEach(l => { const m = l.match(/^\s*(\d+\/\d+\/\d+)\s+(lag\d+)\b(.*)$/i); if (m) { const g = by[m[2]] = by[m[2]] || { id: m[2], proto: 'LACP', flags: '', members: [], up: true }; g.members.push({ port: m[1], flags: '', ok: !/down|defaulted|expired/i.test(m[3]), etat: '' }); } });
      lags.push(...Object.values(by));
    }
    t = S['show trunks'];
    if (vendor === 'hp' && t) {   // [P]
      const by = {};
      t.split('\n').forEach(l => { const m = l.match(/^\s*(\S+)\s+\|.*\|\s*(Trk\d+)\s+(LACP|Trunk)/i); if (m) { const g = by[m[2]] = by[m[2]] || { id: m[2], proto: m[3], flags: '', members: [], up: true }; g.members.push({ port: m[1], flags: '', ok: true, etat: '' }); } });
      lags.push(...Object.values(by));
    }
    return lags;
  }
  function parseStp(vendor, S) {
    const stp = { mode: '', roots: [], selfRootFor: [] };
    let t = S['show spanning-tree summary'] || (vendor === 'cisco' ? S['show spanning-tree'] : '');
    if (t) {
      const m = t.match(/Switch is in (\S+) mode/i); if (m) stp.mode = m[1].toLowerCase();
      const r = t.match(/Root bridge for:\s*(.*)$/mi); if (r && !/none/i.test(r[1])) stp.selfRootFor = r[1].split(/,\s*/).map(x => x.replace(/^VLAN0*/i, '')).filter(Boolean);
    }
    t = S['show spanning-tree root'] || (vendor === 'cisco' ? S['show spanning-tree'] : '');
    if (t) t.split('\n').forEach(l => {
      const m = l.match(/^VLAN0*(\d+)\s+(\d+)\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+(\d+)\s+\d+\s+\d+\s+\d+\s*(\S*)\s*$/i);
      if (m) stp.roots.push({ vlan: 'VLAN ' + m[1], prio: +m[2], mac: normMac(m[3]), cost: +m[4], port: C.shortPort(m[5] || ''), self: +m[4] === 0 && !m[5] });
    });
    t = S['show spanning-tree'] || '';
    if (vendor === 'arubacx' && t) {
      const p = t.match(/Protocol:\s*(\S+)/i); stp.mode = p ? p[1].toLowerCase() : 'mstp';
      const r = t.match(/Root ID[\s\S]*?MAC-Address:\s*(\S+)/i);
      if (r) stp.roots.push({ vlan: 'MST0', prio: 0, mac: normMac(r[1]), cost: 0, port: '', self: /This bridge is the root/i.test(t) });
    }
    if (/STP Enabled\s*:\s*No\b|Spanning[- ]tree (?:is )?disabled|STP\s*(?:Status|State)?\s*:\s*Disabled|No spanning tree instance exists/i.test(t)) { stp.mode = 'désactivé'; return stp; }
    if (/^\s*MSTID\s+Port\s+Role/m.test(t)) { stp.mode = 'mstp'; return stp; }
    if (vendor === 'hp' && t) {
      const f = t.match(/Force Version\s*:\s*(\S+)/i); stp.mode = f ? (/rstp/i.test(f[1]) ? 'rstp' : 'mstp') : 'mstp';
      const r = t.match(/CST Root MAC Address\s*:\s*(\S+)/i), rp = t.match(/CST Root Port\s*:\s*(\S+)/i), pr = t.match(/CST Root Priority\s*:\s*(\d+)/i);
      if (r) stp.roots.push({ vlan: 'CST', prio: pr ? +pr[1] : 0, mac: normMac(r[1]), cost: 0, port: rp ? rp[1] : '', self: false });
    }
    if (vendor === 'netgear' && t) {
      const md = getVal(t, ['Spanning Tree Mode']); if (md) stp.mode = md.toLowerCase();
      const r = getVal(t, ['Designated Root']);
      if (r) { const h = r.replace(/[^0-9a-f]/gi, '').toLowerCase(); if (h.length >= 16) stp.roots.push({ vlan: 'CST', prio: parseInt(h.slice(0, 4), 16), mac: h.slice(-12), cost: 0, port: '', self: false }); }
    }
    if (/^(pvst|rapid-pvst|rpvst)$/.test(stp.mode)) stp.famille = 'pvst'; else if (stp.mode) stp.famille = /mst/.test(stp.mode) ? 'mstp' : 'rstp';
    return stp;
  }
  function parsePoe(vendor, S) {
    const poe = { budget: 0, used: 0, ports: {} };
    const t = [S['show power inline'], S['show power-over-ethernet'], S['show power-over-ethernet brief'], S['show poe']].filter(Boolean).join('\n');
    if (!t) return null;
    t.split('\n').forEach(l => {
      let m;
      if ((m = l.match(/^\s*(\d{1,2})\s*\|\s*(Enable|Disable)\s*\|(.*)$/i))) {   // Planet RTK
        const c = m[3].split('|').map(x => x.trim()); if (c.length < 4) return;
        const w = parseFloat(c[c.length - 2]) || 0, cl = c[c.length - 4];
        poe.ports[C.shortPort('gi' + (+m[1]))] = { oper: /^disable/i.test(m[2]) ? 'off' : w > 0 ? 'on' : 'off', watts: w, device: '', cls: /^\d$/.test(cl) ? cl : '' }; return;
      }
      if ((m = l.match(/^\s*((?:2\.5)?GigabitEthernet\s+\d+\/\d+)\s+(\S+)\s+(.+?)\s+(\d+\s*\.\s*\d+|\d+)\s+(\d+)\s*$/))) {   // Planet ICLI
        const w = parseFloat(m[4].replace(/\s/g, '')) || 0;
        poe.ports[C.shortPort(m[1])] = { oper: /fault|error|overload/i.test(m[3]) ? 'faulty' : w > 0 || /\bon\b|deliver/i.test(m[3]) ? 'on' : 'off', watts: w, device: '', cls: /^\d$/.test(m[2]) ? m[2] : '' }; return;
      }
      if ((m = l.match(/^\s*(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/))) { poe.budget += +m[2]; poe.used += +m[3]; return; }
      if ((m = l.match(/^(\S+)\s+(auto|static|off|never)\s+(on|off|faulty|power-deny|err-disable)\s+([\d.]+)\s+(.*?)\s+(\S+)\s+([\d.]+)\s*$/i))) { poe.ports[C.shortPort(m[1])] = { oper: m[3].toLowerCase(), watts: +m[4], device: m[5].trim(), cls: m[6] }; return; }
      if ((m = l.match(/^\s*(\d+\/\d+\/\d+)\s+(yes|no)\s+\S+\s+(.*?)\s+([\d.]+)\s+(\w+)\s*$/i))) { poe.ports[m[1]] = { oper: /delivering/i.test(m[5]) ? 'on' : /fault/i.test(m[5]) ? 'faulty' : 'off', watts: +m[4], device: m[3].trim(), cls: '' }; return; }
      if ((m = l.match(/^\s*(\S+)\s+\|\s+(Yes|No)\s+\S+\s+\S+\s+[\d.]+ W\s+([\d.]+) W\s+(?:\S+\s+)?(\w+)\s+(\d)\s*$/i))) { poe.ports[m[1]] = { oper: /deliver/i.test(m[4]) ? 'on' : /fault/i.test(m[4]) ? 'faulty' : 'off', watts: +m[3], device: '', cls: m[5] }; return; }
      if ((m = l.match(/^\s*(\d+(?:\/\d+\/\d+)?|[A-Z]\d+)\s+(Yes|No)\s+\S+\s+\S+\s+(?:\S+\s+){1,2}([\d.]+)\s*W\s+([\d.]+)\s*W\s+(\w+)\s+(\S+)/i))) { poe.ports[m[1]] = { oper: /deliver/i.test(m[5]) ? 'on' : /fault/i.test(m[5]) ? 'faulty' : 'off', watts: +m[4], device: '', cls: /^\d$/.test(m[6]) ? m[6] : '' }; return; }
      if ((m = l.match(/^\s*(\d+)\s*\|\s*(Yes|No)\s+\S+\s+\S+\s+([\d.]+)\s*W\s+([\d.]+)\s*W\s+(?:\S+\s+)?(Delivering|Searching|Disabled|Fault\w*|Denied|Other\w*)\s+(\d)/i))) {   // HP 2620 : « 4 | Yes low usage 17 W 2.7 W Delivering 4 off »
        poe.ports[m[1]] = { oper: /deliver/i.test(m[5]) ? 'on' : /fault/i.test(m[5]) ? 'faulty' : 'off', watts: +m[4], device: '', cls: m[6] }; return; }
      if ((m = l.match(/^(GE\d+|\d+)\s+(on|off)\s+(on|off|fault\w*)\s+([\d.]+)\s+(\d)\s*$/i))) { poe.ports[C.shortPort(m[1])] = { oper: m[3].toLowerCase().startsWith('fault') ? 'faulty' : m[3].toLowerCase(), watts: +m[4], device: '', cls: m[5] }; return; }
    });
    if (!poe.budget) { const b = t.match(/(?:Power Available|Available|Total Power Budget|Power Budget)[^:\n]*:\s*([\d.,]+)\s*W/i); if (b) poe.budget = parseFloat(b[1].replace(',', '.')); }
    if (!poe.budget) { const b = t.match(/Maximum Available Power\s*:\s*([\d.]+)/i); if (b) poe.budget = +b[1]; }
    if (!poe.used) { const u = t.match(/(?:PoE Power Consumption|Current Power Consumption)\s*:?\s*([\d.]+(?:\s*\.\s*\d+)?)\s*\[?W/i); if (u) poe.used = parseFloat(u[1].replace(/\s/g, '')) || 0; }
    if (!poe.budget && /IGS-5225-8P4S|IGS-10020PT|IGS-10020HPT/i.test(t + ' ' + (S['show version'] || ''))) poe.budget = 240;   // budget constructeur (non affiché par le switch)
    if (!poe.budget) { const pc = t.match(/Current Power Consumption[^(\n]*\((\d+)\s*%\)/i); if (pc && +pc[1] > 0 && poe.used) poe.budget = Math.round(poe.used * 100 / +pc[1] / 10) * 10; }
    if (!poe.used) { const u = t.match(/(?:Power Drawn|Used|Total Power Used|Consumed)[^:\n]*:\s*([\d.,]+)\s*W/i); if (u) poe.used = parseFloat(u[1].replace(',', '.')); }
    if (!poe.used) poe.used = Object.values(poe.ports).reduce((a, p) => a + (p.watts || 0), 0);
    poe.used = Math.round(poe.used * 10) / 10;
    poe.pct = poe.budget ? Math.round(100 * poe.used / poe.budget) : null;
    if (!poe.budget && !Object.keys(poe.ports).length) return null;
    return poe;
  }
  function parseErrors(S) {
    const t = S['show interfaces counters errors'] || ''; const out = {};
    let ok = false;
    t.split('\n').forEach(l => {
      if (/^Port\s+Align-Err\s+FCS-Err/i.test(l)) { ok = true; return; }
      if (/^Port\s+/i.test(l)) { ok = false; return; }
      const m = ok && l.match(/^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(\d+))?\s*$/);
      if (m) out[C.shortPort(m[1])] = { align: +m[2], fcs: +m[3], xmit: +m[4], rcv: +m[5] };
    });
    return out;
  }
  function parseCdpNative(text) {
    const out = {};
    String(text || '').split(/^\s*-{10,}\s*$/m).forEach(b => {
      const i = b.match(/^\s*Interface\s*:\s*([^,\n]+)/m), n = b.match(/Native VLAN\s*:\s*(\d+)/i), d = b.match(/Device ID\s*:\s*(\S+)/);
      if (i && n) out[C.shortPort(i[1].trim())] = { native: n[1], device: d ? d[1] : '' };
    });
    return out;
  }
  function parseLldpPvid(text) {
    const out = {}; let cur = null;
    String(text || '').split('\n').forEach(l => {
      let m = l.match(/^\s*(Local Intf|Local Interface|Local Port|Port)\s*:\s*(\S+)/i);
      if (m) { cur = C.shortPort(m[2]); return; }
      if (cur && (m = l.match(/^\s*(Pvid|Port VLAN ID|Vlan ID)\s*:\s*(\d+)/i))) out[cur] = m[2];
    });
    return out;
  }
  function parseMacFlap(S) {
    const t = S['show logging | include MACFLAP|HOST_FLAP|MAC_MOVE'] || ''; const out = [];
    t.split('\n').forEach(l => {
      if (!/MACFLAP|HOST_FLAP|MAC_MOVE/.test(l)) return;
      const m = l.match(/Host (\S+) in vlan (\d+) is flapping between port (\S+) and port (\S+)/i);
      out.push(m ? { mac: normMac(m[1]), vlan: m[2], ports: [C.shortPort(m[3]), C.shortPort(m[4])], ligne: l.trim() } : { mac: '', vlan: '', ports: [], ligne: l.trim() });
    });
    return out;
  }
  function parseIdentityV2(vendor, S) {
    const sv = S['show version'] || '', ss = S['show system'] || '';
    const all = [sv, ss, S['show sysinfo'] || '', S['show system-info'] || ''].join('\n');
    const id = { firmware: '', uptime: '', location: '', macBase: '', model: '', serial: '' };
    if (vendor === 'cisco') {
      let m = sv.match(/,\s*Version ([^,\s]+)/); if (m) id.firmware = m[1];
      m = sv.match(/uptime is ([^\n]+)/); if (m) id.uptime = m[1].trim();
      id.macBase = normMac(getVal(sv, ['Base ethernet MAC Address'])); id.model = getVal(sv, ['Model number']); id.serial = getVal(sv, ['System serial number']);
    } else if (vendor === 'arubacx') {
      id.firmware = getVal(sv, ['Version']) || getVal(ss, ['ArubaOS-CX Version']); id.uptime = getVal(ss, ['Up Time']); id.location = getVal(ss, ['System Location']);
      id.macBase = normMac(getVal(ss, ['Base MAC Address'])); id.model = getVal(ss, ['Product Name']); id.serial = getVal(ss, ['Chassis Serial Nbr']);
    } else if (vendor === 'hp') {
      let m = ss.match(/Software revision\s*:\s*(\S+)/i); if (m) id.firmware = m[1];
      m = ss.match(/Up Time\s*:\s*(.+?)(?:\s{2,}|$)/im); if (m) id.uptime = m[1].trim();
      m = ss.match(/System Location[ \t]*:[ \t]*(.*?)[ \t\r]*$/im); if (m && !/^Default Location$/i.test(m[1])) id.location = m[1];
      m = ss.match(/Base MAC Addr\s*:\s*(\S+)/i); if (m) id.macBase = normMac(m[1]);
      m = ss.match(/Serial Number\s*:\s*(\S+)/i); if (m) id.serial = m[1];
    } else {
      id.firmware = getVal(all, ['Software Version', 'Firmware Version', 'Firmware']); id.uptime = getVal(all, ['System Up Time', 'System Uptime', 'Up Time']);
      id.location = getVal(all, ['System Location']); id.macBase = normMac(getVal(all, ['Burned In MAC Address', 'MAC Address', 'System MAC Address']));
      id.model = getVal(all, ['Machine Model', 'Model Name', 'Model']); id.serial = getVal(all, ['Serial Number', 'Serial No']);
    }
    return id;
  }

  /* ---------- un relevé -> objet switch (modèle de CartoCore + champ ext) ---------- */
  function emptyExt() { return { vlans: [], trunks: {}, lags: [], stp: { mode: '', roots: [], selfRootFor: [] }, poe: null, errors: {}, macflap: [], cdpNative: {}, lldpPvid: {}, firmware: '', uptime: '', macBase: '', releve: null, commandesKo: [], fiab: '', legacy: false }; }
  /* ---------- journaux PuTTY / textes collés : découpage par commande (invite « nom# commande ») ---------- */
  const CMD_SENSIBLES = /^show (running-config|startup-config|run|tech-support|tech)\b/;
  function normCmd(c) {
    c = String(c || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const R = [[/^show\s?run/, 'show running-config'], [/^show\s?start/, 'show startup-config'], [/^show\s?tech/, 'show tech-support'], [/^show\s?span/, 'show spanning-tree'],
      [/^show\s?lldp\s?nei\w*(\s+detail)?$/, m => /detail/.test(m) ? c : 'show lldp neighbor'], [/^show\s?mac\s?add\w*(-\w+)?/, 'show mac address-table'], [/^show\s?info/, 'show info'],
      [/^show\s?ver/, 'show version'], [/^show\s?arp/, 'show arp'], [/^show\s?vlan$/, 'show vlan'], [/^show\s?int\w*\s+stat\w*$/, 'show interface status'], [/^show\s?int\w*\s+(?!switchport)\S.*\sstat\w*$/, 'show interface status'], [/^show\s?power\s?inl/, 'show power inline'], [/^show\s?int\w*\s+\*\s+switchport\b/, 'show interface switchport']];
    for (const [re, v] of R) if (re.test(c)) return typeof v === 'function' ? v(c) : v;
    return c;
  }
  function splitPutty(text) {
    const lines = decollerInvites(String(text || '').replace(/\r/g, '').replace(/^\uFEFF/, '')).split('\n');
    const S = {}, order = []; let cur = null, buf = [], invite = '', nCmd = 0, inconnues = 0;
    const flush = () => { if (cur !== null) { S[cur] = (S[cur] ? S[cur] + '\n' : '') + buf.join('\n'); } buf = []; };
    for (const l of lines) {
      const m = l.match(/^\(?([A-Za-z0-9][\w.\- ]{0,62}?)\)?\s?[#>]\s*(.*)$/);
      if (m && (!invite || m[1] === invite || /^[\w.\-]+$/.test(m[1]))) {
        flush(); invite = invite || m[1];
        const c = m[2].trim();
        if (!c) { cur = null; continue; }
        cur = normCmd(c); nCmd++; if (!order.includes(cur)) order.push(cur); continue;
      }
      if (cur !== null) {
        if (/^\s*(Unknown command|% ?Invalid input|Invalid command)/i.test(l)) { inconnues++; S['__inconnue__'] = 1; continue; }   // ex. « exti » mal tapé : ignoré sans erreur
        buf.push(l.replace(/^\s*-+\s?More\s?-+\s*/i, ''));
      }
    }
    flush();
    if (nCmd < 2) return null;
    delete S['__inconnue__'];
    Object.keys(S).forEach(k => { if (!/^show\b/.test(k) && !String(S[k]).trim()) { delete S[k]; const i = order.indexOf(k); if (i >= 0) order.splice(i, 1); } });   // exit, logout, fautes de frappe sans sortie
    return { invite, S, order, inconnues };
  }
  /* Signatures de marque pour les CLI « légères » (import .txt). Planet : [C] journal réel. Netgear : [P] (FASTPATH, OID 4526). ComNet : [V]. */
  function marqueLegere(t) {
    if (estPlanet(t)) return 'planet';
    if (/NETGEAR|ProSAFE|ProSafe|1\.3\.6\.1\.4\.1\.4526\b|^\s*Machine (Model|Type)\.{2,}/mi.test(t)) return 'netgear';
    if (/ComNet|COMNET|Communication Networks|\bCN(GE|GS|FE|WGE)[0-9A-Z+]+/.test(t)) return 'comnet';
    return '';
  }
  function estPlanet(t) { return /Layer 2 Managed|1\.3\.6\.1\.4\.1\.10456\b|\bPLANET\b|Planet Technology/i.test(t) || (/^\s*Loader Version\s*:/mi.test(t) && /^\s*Firmware Version\s*:/mi.test(t)); }
  /* Tableau à barres « A | B | C » suivi d'une ligne « ---+--- » (Planet, d'autres CLI légères) */
  function parsePipeTable(text) {
    const lines = String(text || '').split('\n'); let h = -1;
    for (let i = 0; i < lines.length - 1; i++) if (lines[i].includes('|') && /^[\s\-+]+$/.test(lines[i + 1]) && lines[i + 1].includes('+')) { h = i; break; }
    if (h < 0) return [];
    const cols = lines[h].split('|').map(x => x.trim().toLowerCase());
    const rows = [];
    for (let i = h + 2; i < lines.length; i++) {
      const l = lines[i]; if (!l.includes('|')) continue;
      const v = l.split('|').map(x => x.trim()); if (v.length < 2) continue;
      const o = {}; cols.forEach((c, k) => { o[c] = v[k] == null ? '' : v[k]; }); rows.push(o);
    }
    return rows;
  }
  const col = (o, re) => { for (const k in o) if (re.test(k)) return o[k]; return ''; };
  function planetCaps(c) { c = String(c || '').toLowerCase(); const r = []; if (/bridge|switch/.test(c)) r.push('bridge'); if (/router/.test(c)) r.push('router'); if (/station|host/.test(c)) r.push('host'); if (/wlan|access point/.test(c)) r.push('ap'); if (/phone|telephone/.test(c)) r.push('phone'); return r; }
  /* Parseur tolérant pour les CLI « légères » (Planet, ComNet, Netgear) : « Clé : valeur » ou « Clé....... valeur »,
     tableaux à barres « | » ou à colonnes, ports gi1 / 1/0/1 / g1 / GE1 / 1. Ne remplace une donnée déjà lue que par un tableau à barres.
     Fiabilité : Planet [C] sur un journal réel ; Netgear [P] ; ComNet [V] (aucun journal réel). */
  function sectionsDe(S, re) { return Object.keys(S).filter(k => re.test(k)).map(k => S[k]).join('\n'); }
  function parseLeger(vendor, S, ext, base) {
    const info = sectionsDe(S, /^show (info|version|system|sysinfo|system-info|system information|hardware)\b/);
    const nom = getVal(info, ['System Name', 'Host Name', 'Hostname', 'Switch Name', 'Device Name']);
    const ip = getVal(info, ['IP Address', 'Management IP', 'IPv4 Address']);
    const oid = getVal(info, ['System Object ID', 'System OID']);
    if (nom && (!base.name || base.name === 'Switch sans nom' || /\.txt$/i.test(base.name))) base.name = nom;
    if (nom && base.name !== nom && !/^(SW|switch)$/i.test(nom)) base.name = nom;
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) { base.mgmtIp = base.mgmtIp || ip; if (!base.ips.includes(ip)) base.ips.push(ip); }
    ext.firmware = ext.firmware || getVal(info, ['Firmware Version', 'Software Version', 'Firmware', 'Software Revision', 'Version']);
    ext.uptime = ext.uptime || getVal(info, ['System Up Time', 'System Uptime', 'Up Time', 'Uptime']);
    const mb = normMac(getVal(info, ['Burned In MAC Address', 'Base MAC Address', 'System MAC Address', 'MAC Address']));
    if (mb) { ext.macBase = ext.macBase || mb; if (!base.macs.includes(mb)) base.macs.push(mb); }
    base.serial = base.serial || getVal(info, ['Serial Number', 'Serial No', 'Serial No.']);
    if (!base.model && /Software,\s*Version/.test(String(info)) ) base.model = (String(info).match(/^\s*(?:PLANET\s+)?((?:SGS|XGS|GS|IGS|MGS|WGS)-[\w\-]+)\s+Software/mi) || [])[1] || '';
    if (!base.model) base.model = getVal(info, ['Machine Model', 'Model Name', 'Model', 'Product Name', 'Product']) || ((C.OID_MODELE || {})[oid]) || (String(info || '').match(/^\s*Product\s*:\s*PLANET,\s*([^,\n]+)/mi) || [])[1] || (String(base.name || '').match(/^(?:GS|SGS|XGS|MGS|IGS|WGS|GSD|FGSW|IGSW|WGSW)-[\w\-]+$/i) || [])[0] || ((VENDOR_LABEL[vendor] || vendor) + (oid ? ' (modèle non indiqué, OID ' + oid + ')' : ''));
    // voisins LLDP : tableau à barres prioritaire, sinon lecture déjà faite (détail clé:valeur ou liste à colonnes)
    const ll = parsePipeTable(sectionsDe(S, /lldp/));
    if (ll.length && ll.some(r => col(r, /device id|chassis|sysname|system name/))) base.neighbors = ll.map(r => {
      const ch = normMac(col(r, /device id|chassis/)); const ipv = (col(r, /addr|ip/).match(/\d+\.\d+\.\d+\.\d+/) || [''])[0];
      return { proto: 'LLDP', localPort: C.shortPort(col(r, /^port$|^local|^interface|^intf/)), name: col(r, /sysname|system name/), ip: ipv, platform: '', caps: planetCaps(col(r, /capab/)), portId: col(r, /port id|remote port/), portDescr: '', chassis: ch, descr: col(r, /descr/) };
    }).filter(n => n.localPort);
    // MAC
    const mt = parsePipeTable(sectionsDe(S, /mac/));
    if (mt.length && mt.some(r => col(r, /mac/))) base.macTable = mt.map(r => ({ mac: normMac(col(r, /mac/)), vlan: (col(r, /vid|vlan/).match(/^\d{1,4}$/) || [''])[0], port: C.shortPort(col(r, /port|interface/)), type: col(r, /type|status/) }))
      .filter(e => e.mac && e.port && !/cpu/i.test(e.port) && !/management|self|static cpu/i.test(e.type) && !(parseInt(e.mac.slice(0, 2), 16) & 1)).map(({ mac, vlan, port }) => ({ mac, vlan, port }));
    // VLAN
    const vt = parsePipeTable(sectionsDe(S, /vlan/));
    if (vt.length && vt.some(r => /^\d{1,4}$/.test(col(r, /^vid$|^vlan$|vlan id/)))) ext.vlans = vt.filter(r => /^\d{1,4}$/.test(col(r, /^vid$|^vlan$|vlan id/))).map(r => {
      const u = col(r, /untag/), g = col(r, /^tagged/), m = col(r, /^ports?$|member/), id = +col(r, /^vid$|^vlan$|vlan id/);
      const lst = s => (/^-+$/.test(s) || !s) ? [] : expandPorts(s);
      return { id, name: col(r, /name/), ports: lst(u).concat(lst(g), lst(m)), untagged: lst(u).concat(lst(m)), tagged: lst(g) };
    });
    // ports : tableau à barres (état, vitesse, VLAN), sinon déjà lus, sinon déduits
    const pt = parsePipeTable(sectionsDe(S, /^show (interface|interfaces|port|ports)\b/));
    if (pt.length && !Object.keys(base.ports).length) pt.forEach(r => {
      const k = C.shortPort(col(r, /^port$|^interface$|^intf$|^port no/)); if (!k || /^-+$/.test(k)) return;
      const st = col(r, /link|status|state|oper/), sp = col(r, /speed/);
      base.ports[k] = { port: k, desc: col(r, /name|descr/), status: /up|connected|link ?up/i.test(st) && !/down|not/i.test(st) ? 'up' : (st ? 'down' : ''), statusRaw: st || 'non relevé', vlan: (col(r, /pvid|vlan/).match(/^\d{1,4}$/) || [''])[0], mode: /trunk/i.test(col(r, /mode|vlan/)) ? 'trunk' : '', speed: sp, duplex: col(r, /duplex/), type: col(r, /type|media/), media: /fib|sfp|sx|lx/i.test(col(r, /type|media/)) ? 'fibre' : '' };
    });
    // PoE (tableau à barres) [V]
    const pp = parsePipeTable(sectionsDe(S, /poe|power/));
    if (pp.length && (!ext.poe || !Object.keys(ext.poe.ports || {}).length)) {
      const ports = {}; pp.forEach(r => { const k = C.shortPort(col(r, /^port|interface/)); const w = parseFloat(String(col(r, /power|watt|\(w\)/)).replace(',', '.')); if (k && !isNaN(w)) ports[k] = { oper: /fault|error/i.test(col(r, /status|state|oper/)) ? 'faulty' : (w > 0 ? 'on' : 'off'), watts: w, device: '', cls: col(r, /class/) }; });
      if (Object.keys(ports).length) { const used = Math.round(Object.values(ports).reduce((a, p) => a + p.watts, 0) * 10) / 10; const b = (sectionsDe(S, /poe|power/).match(/(?:Budget|Available|Total Power)[^:\n]*:\s*([\d.,]+)\s*W/i) || [])[1]; const budget = b ? parseFloat(b.replace(',', '.')) : 0; ext.poe = { budget, used, ports, pct: budget ? Math.round(100 * used / budget) : null }; }
    }
    const st = S['show spanning-tree'] || '';
    if (st && /disabled/i.test(st)) { const m = st.match(/mode\s+(\w+)/i); ext.stp = { mode: 'désactivé' + (m ? ' (' + m[1].toLowerCase() + ')' : ''), roots: [], selfRootFor: [], desactive: true }; }
    else if (st && !(ext.stp && ext.stp.mode)) { const m = st.match(/(?:mode|Spanning Tree Mode)[.\s:]+(\w+)/i); if (m) ext.stp = { mode: m[1].toLowerCase(), roots: [], selfRootFor: [], famille: /mst/i.test(m[1]) ? 'mstp' : 'rstp' }; }
    if (!Object.keys(base.ports).length) {
      const P = {};
      const add = (p, o) => { const k = C.shortPort(p); if (!k) return; P[k] = Object.assign(P[k] || { port: k, status: '', statusRaw: 'non relevé', desc: '', vlan: '', mode: '', speed: '', duplex: '', type: '', media: '' }, o || {}); };
      (ext.vlans || []).forEach(v => { (v.untagged || v.ports || []).forEach(p => add(p, { vlan: String(v.id), mode: P[C.shortPort(p)] && P[C.shortPort(p)].mode === 'trunk' ? 'trunk' : 'access' })); (v.tagged || []).forEach(p => add(p, { mode: 'trunk' })); });
      base.macTable.forEach(e => add(e.port, { status: 'up', statusRaw: 'actif (MAC apprises)' })); base.neighbors.forEach(n => add(n.localPort, { status: 'up', statusRaw: 'actif (voisin LLDP)' }));
      base.ports = P; ext.portsDeduits = Object.keys(P).length > 0;
    }
  }
  const parsePlanet = (S, ext, base) => parseLeger('planet', S, ext, base);
  const ipEntete = t => { const m = String(t || '').match(/^\uFEFF?\s*#\s*Relev\S*\s+Carto R\S+seau\s+-\s+(\d+\.\d+\.\d+\.\d+)/m); return m ? m[1] : ''; };
  /* Marque écrite par le script de relevé dans l'en-tête (« … - marque : HP / ArubaOS-Switch ») : elle prime sur la
     détection par mots-clés, que fausseraient les voisins (un HP voisin d'un Planet ou d'un ComNet). */
  const marqueEntete = t => {
    const m = String(t || '').match(/^\uFEFF?\s*#\s*Relev\S*\s+Carto R\S+seau\s+-.*?\bmarque\s*:\s*(.+?)\s*$/m); if (!m) return '';
    const v = m[1];
    return /mikrotik/i.test(v) ? 'mikrotik' : /aruba ?cx/i.test(v) ? 'arubacx' : /arubaos-switch|^hp\b|procurve/i.test(v) ? 'hp' : /cisco/i.test(v) ? 'cisco'
      : /planet/i.test(v) ? 'planet' : /comnet/i.test(v) ? 'comnet' : /netgear/i.test(v) ? 'netgear' : '';
  };
  /* Invite collée au texte précédent (HP : « no pagePON-HDV-SWA-01# show system ») : on la remet en début de ligne */
  function decollerInvites(t) {
    t = String(t || '').replace(/\uFEFF/g, '');
    const cnt = {};
    for (const m of t.matchAll(/^([A-Za-z0-9][\w.\-]{1,62})[#>] ?/gm)) cnt[m[1]] = (cnt[m[1]] || 0) + 1;
    Object.keys(cnt).filter(n => cnt[n] >= 3).forEach(n => {
      const e = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp('([^\\n])(?=' + e + '[#>] )', 'g'), '$1\n');
    });
    return t;
  }
  /* Version logicielle propre au switch (pas celle d'un voisin LLDP, d'où des motifs ancrés en début de ligne) */
  function firmwareTexte(t, vendor) {
    t = String(t || '');
    const R = vendor === 'cisco' ? [/^Cisco IOS(?: XE)? Software.*?,\s*Version\s+([^,\s]+)/m, /^Cisco Nexus.*\n(?:.*\n){0,8}?\s*NXOS: version\s+(\S+)/m]
      : [/^\s*Software revision\s*:?\s+([A-Z]{1,3}\.\d+\.\d+\.\d+)/m, /^\s*ArubaOS-CX Version\s*:\s*(\S+)/m, /^\s*Version\s*:\s*([A-Z]{2}\.\d+\.\d+\.\d+)/m,
         /^\s*(?:Software Version|Firmware Version)\s*:\s*(\S+)/mi,
         /Comware Software,\s*Version\s+([\d.]+),\s*Release\s+(\w+)/m,
         /Software,\s*Version\s+(\S+(?:\s+Build\s+\w+)?)/m,
         /^\s*Version\s*:\s*(v?\d[\w.\-]*)/m];
    { const m = t.match(/Comware Software,\s*Version\s+([\d.]+),\s*Release\s+(\w+)/m); if (m) return m[1] + ' R' + m[2]; }
    for (const r of R) { const m = t.match(r); if (m) return m[1]; }
    return '';
  }
  function nettoyerModele(s) {
    const m = String(s.model || '').match(/(?:^|PLANET,?\s*|\s)((?:GS|SGS|XGS|MGS|IGS|WGS|GSD|FGSW|IGSW|WGSW)-[\w\-+]+)/i);
    if (s.vendor === 'planet' && m && m[1] !== s.model) s.model = m[1];
  }
  function parseReleveV2(text, filename) {
    const avert = [];
    text = String(text || '').replace(/-- ?more ?--, next page: Space, continue: g, quit: \^C[ \t]*/gi, '\n');   // pagination Planet restée dans show version
    if (/^###\s+\/(?:system|interface|ip)\b/m.test(text.replace(/\r/g, ''))) {   // MikroTik RouterOS
      const s = C.parseSwitch(text, filename); s.id = newId();
      s.ext = emptyExt(); s.ext.fiab = VENDOR_FIAB.mikrotik;
      const g = re => { const m = text.match(re); return m ? m[1].trim() : ''; };
      s.ext.firmware = s.version || ''; s.ext.uptime = g(/^\s*uptime:\s*(.+)$/m); s.ext.macBase = (s.macs || [])[0] || '';
      s.mgmtIp = g(/^\s*#\s*Relev\S*\s+Carto R\S+seau\s+-\s+(\d+\.\d+\.\d+\.\d+)/m) || (s.ips || [])[0] || ''; s.extraIps = [];
      s.ext.commandes = (text.match(/^###\s+(.+)$/gm) || []).map(x => x.replace(/^###\s+/, '').trim());
      return controlerReleve(s);
    }
    let S0 = null;
    if (!/^### \S/m.test(text.replace(/\r/g, ''))) {
      const P = splitPutty(text);
      if (P) {
        const sens = Object.keys(P.S).filter(k => CMD_SENSIBLES.test(k));
        if (sens.length) avert.push('Configuration complète détectée (' + sens.join(', ') + ') : ignorée, non lue et non conservée. Ne joignez pas ce fichier tel quel : il peut contenir des secrets.');
        sens.forEach(k => delete P.S[k]);
        if (P.inconnues) avert.push(P.inconnues + ' commande(s) inconnue(s) du switch ignorée(s).');
        const tout = Object.keys(P.S).map(k => P.S[k]).join('\n');
        // relevé reconstitué au format annexe A : même chaîne d'analyse que le collecteur
        const mqE = marqueEntete(text);
        const marque = /^(planet|netgear|comnet)$/.test(mqE) ? mqE : (mqE ? '' : marqueLegere(tout));
        S0 = '=== nom=' + P.invite + ' marque=' + marque + ' ===\n' + Object.keys(P.S).map(k => '### ' + k + '\n' + P.S[k]).join('\n');
        if (!marque) {
          // autres marques : analyse d'origine, mais SANS la configuration
          const s = C.parseSwitch(Object.keys(P.S).map(k => P.invite + '#' + k + '\n' + P.S[k]).join('\n'), filename, mqE); s.id = newId();
          s.ext = emptyExt(); s.ext.legacy = true; s.ext.fiab = VENDOR_FIAB[s.vendor] || 'V'; s.ext.avertissements = avert;
          try { const S = P.S, v = s.vendor; s.ext.vlans = parseVlans(v, S); s.ext.stp = parseStp(v, S); s.ext.poe = parsePoe(v, S); s.ext.errors = parseErrors(S); s.ext.lags = parseLags(v, S);
            if (v === 'cisco') s.ext.trunks = parseCiscoTrunks(S['show interfaces trunk']); } catch (e) { /* lecture complémentaire seulement */ }
          if (!s.name || s.name === 'Switch sans nom') s.name = P.invite;
          if (!s.mgmtIp) s.mgmtIp = ipEntete(text);
          if (!Object.keys(s.ports || {}).length) {   // état des ports non relevé : ports actifs déduits des MAC et des voisins
            const P2 = {}; const add = p => { const k = C.shortPort(p); if (k && !/^cpu$/i.test(k)) P2[k] = { port: k, status: 'up', statusRaw: 'actif (déduit des MAC / voisins)', desc: '', vlan: '', mode: '', speed: '', duplex: '', type: '', media: '' }; };
            (s.macTable || []).forEach(e => add(e.port)); (s.neighbors || []).forEach(n => add(n.localPort));
            s.ports = P2; s.ext.portsDeduits = Object.keys(P2).length > 0;
          }
          if (!s.model) { const mm = text.match(/^\s*(?:Aruba|HPE?|ProCurve)\s+(J[A-Z]?\d{3,4}[A-Z])\s+(\S.*?)\s+Switch\s*$/m); if (mm) s.model = mm[2].trim() + ' (' + mm[1] + ')'; }
          if (s.ext && !s.ext.firmware) s.ext.firmware = firmwareTexte(text, s.vendor); nettoyerModele(s); lireEtat(s, text);
          return controlerReleve(s);
        }
      }
    }
    const s = parseReleveCoeur(S0 || text, filename);
    if (!s.mgmtIp) s.mgmtIp = ipEntete(text);
    if (s.vendor === 'comnet') comnetComplet(s, text);
    if (s.vendor !== 'comnet' && /^(switch|router|default)$/i.test(s.name || '')) { const mm = text.match(/^\s*(?:System )?Name\s*:\s*(\S+)\s*$/mi); if (mm) s.name = mm[1]; }
    if (s.ext && !s.ext.firmware) s.ext.firmware = firmwareTexte(text, s.vendor); nettoyerModele(s); lireEtat(s, text);
    s.ext.avertissements = avert.concat(s.ext.avertissements || []);
    return controlerReleve(s);
  }
  /* ComNet CNGE/CNGS… : formats lus sur un vrai relevé (Pontoise, CNGE2FE8MSPOE+ v1.37) */
  function comnetComplet(s, text) {
    const pn = p => { const m = String(p).match(/^Port\.?0*(\d+)$/i); return m ? 'P' + m[1] : String(p).toUpperCase(); };
    const RP = '((?:Port\\.\\d+)|G\\d+)';
    const P = {}, vl = {}, nb = [], poe = {};
    let budget = 0, used = null;
    text.split(/\r?\n/).forEach(l => {
      let m;
      if ((m = l.match(new RegExp('^\\s*' + RP + '\\s+(\\S+)\\s+(Up|Down)\\s+(Enable|Disable)\\s+(\\S+)', 'i')))) {
        const k = pn(m[1]), sp = m[5] === 'N/A' ? '' : m[5].split('/')[0];
        P[k] = { port: k, desc: '', status: /disable/i.test(m[4]) ? 'disabled' : /up/i.test(m[3]) ? 'up' : 'down', statusRaw: m[3] + ' ' + m[4], vlan: '', mode: 'access',
          duplex: (m[5].split('/')[1] || '').toLowerCase(), speed: sp.replace(/^1G$/i, '1000'), type: m[2], media: /SFP|FX|LX|SX/i.test(m[2]) && !/TX/i.test(m[2]) ? 'fibre' : /TX/i.test(m[2]) && !/SFP/i.test(m[2]) ? 'cuivre' : '' };
      } else if ((m = l.match(new RegExp('^\\s*' + RP + '\\s+(\\S+)-Link\\s+(\\d+)\\s+(\\S+)', 'i')))) {
        const k = pn(m[1]); vl[k] = { mode: /trunk|hybrid/i.test(m[2]) ? 'trunk' : 'access', untag: m[3], tag: /none/i.test(m[4]) ? [] : m[4].split(/[,\s]+/) };
      } else if ((m = l.match(new RegExp('^\\s*([0-9A-F]{2}(?:-[0-9A-F]{2}){5})\\s+(\\d+\\.\\d+\\.\\d+\\.\\d+|-+|\\S+)\\s+' + RP + '\\s*(.*)$', 'i')))) {
        const rp = /^[\x20-\x7e]+$/.test(m[4].trim()) ? m[4].trim() : '';
        nb.push({ proto: 'LLDP', localPort: pn(m[3]), name: '', ip: /^\d/.test(m[2]) ? m[2] : '', platform: '', caps: [], portId: rp, portDescr: '', chassis: C.normMac(m[1]), descr: '' });
      } else if ((m = l.match(new RegExp('^\\s*' + RP + '\\|\\s*(ON|OFF)\\|([^|]*)\\|([^|]*)\\|\\|([^|]*)\\|([^|]*)\\|([^|]*)\\|([^|]*)\\|(.*)$', 'i')))) {
        const mw = parseFloat(m[7]) || 0, cl = m[8].trim();
        poe[pn(m[1])] = { oper: /^off/i.test(m[2]) ? 'off' : /fault|error|over/i.test(m[9]) ? 'faulty' : mw > 0 ? 'on' : 'off', watts: Math.round(mw / 100) / 10, device: '', cls: /^\d$/.test(cl) ? cl : '' };
      } else if ((m = l.match(/Maximum Power Budget\s*:\s*([\d.]+)\s*W/i))) budget = +m[1];
      else if ((m = l.match(/Total Power Consumption\s*:\s*([\d.]+)\s*W/i))) used = +m[1];
      else if ((m = l.match(/Address gateway\s*:\s*(\d+\.\d+\.\d+\.\d+)/i))) s.defaultGw = m[1];
    });
    if (!Object.keys(P).length) return;
    Object.keys(vl).forEach(k => { if (P[k]) { P[k].vlan = vl[k].untag; P[k].mode = vl[k].mode; } });
    s.ports = P; s.ext.portsDeduits = false;
    if (nb.length) s.neighbors = nb;
    const vids = {}; Object.entries(vl).forEach(([k, v]) => { const add = (id, t) => { const o = vids[id] = vids[id] || { id: +id, name: '', ports: [], untagged: [], tagged: [] }; o.ports.push(k); o[t].push(k); }; add(v.untag, 'untagged'); v.tag.forEach(t => add(t, 'tagged')); });
    const nomV = text.match(/^VID:\s*(\d+)\s*[\r\n]+Name:\s*(.+)$/gmi) || []; nomV.forEach(b => { const m = b.match(/VID:\s*(\d+)\s*[\r\n]+Name:\s*(.+)/i); if (m && vids[m[1]]) vids[m[1]].name = m[2].trim(); });
    if (Object.keys(vids).length) s.ext.vlans = Object.values(vids);
    if (budget || Object.keys(poe).length) s.ext.poe = { budget: budget || null, used: used != null ? used : Object.values(poe).reduce((a, p) => a + p.watts, 0), ports: poe, pct: budget ? Math.round(100 * (used || 0) / budget) : null };
    // pas de nom en CLI : le nom système est le modèle (comme dans l'interface web et le LLDP des voisins)
    const nFE = Object.keys(P).filter(k => /^P\d+$/.test(k)).length, nG = Object.keys(P).filter(k => /^G\d+$/.test(k)).length;
    if (!s.model || /^comnet$/i.test(s.model)) s.model = 'CN' + (nG ? 'GE' + nG : '') + (nFE ? 'FE' + nFE : '') + 'MS' + (budget ? 'POE+' : '');
    if (!s.name || /^(switch|default)$/i.test(s.name)) s.name = s.model;
    s.ext.releve = {}; s.ext.avertissements = (s.ext.avertissements || []).filter(a => !/ports déduits|AUCUNE donnée/.test(a));
  }
  /* « Relevé OK » seulement si des données ont réellement été extraites */
  function controlerReleve(s) {
    const nP = Object.keys(s.ports || {}).length, nV = (s.neighbors || []).length, nM = (s.macTable || []).length, nVl = ((s.ext && s.ext.vlans) || []).length;
    s.ext.compte = { ports: nP, voisins: nV, vlan: nVl, mac: nM };
    const r = s.ext.releve = s.ext.releve || {};
    if (r.etat) return s;   // état fourni par le collecteur
    if (!nP && !nV && !nM) {
      r.etat = 'partiel'; r.raison = 'Marque ' + (VENDOR_LABEL[s.vendor] || s.vendor || 'inconnue') + ' reconnue mais AUCUNE donnée extraite (ports, voisins, MAC) : format non pris en charge ou commandes manquantes.';
      s.ext.avertissements = (s.ext.avertissements || []).concat(r.raison);
    } else if (s.ext.portsDeduits) {
      r.etat = 'partiel'; r.raison = 'État des ports non relevé (« show interface status » absent) : ports déduits des VLAN, MAC et voisins.';
      s.ext.avertissements = (s.ext.avertissements || []).concat(r.raison);
    }
    return s;
  }

  // température (Planet « Temperature : 62.0 C », HP « show system temperature », Cisco « show env ») et disponibilité HP « Up Time : 82 days »
  function lireEtat(s, text) {
    if (!s.ext) return;
    let m = String(text).match(/^\s*(?:Temperature|Current Temperature|Temp(?:erature)?\s*\(C\)|System Temperature|Inlet Temperature)\s*:?\s*(\d{2,3}(?:\.\d)?)\s*(?:C\b|°C|degrees?\s*C)/mi)
      || String(text).match(/^\s*\S+\s+(?:Chassis|System|Board|Switch)\s+(\d{2,3})C\s+\d{1,3}C/mi);
    if (m) s.ext.temp = parseFloat(m[1]);
    if (!s.ext.uptime && (m = String(text).match(/^[ \t]*Up Time[ \t]*:[ \t]*(\S.*?)(?:[ \t]{2,}|[ \t\r]*$)/m))) s.ext.uptime = m[1].replace(/^(\d+) days?$/, '$1 jours').trim();
    if (!s.location && (m = String(text).match(/^[ \t]*System Location[ \t]*:[ \t]*(\S.*?)[ \t\r]*$/m)) && !/^Default Location$/i.test(m[1])) s.location = m[1];
  }
  function parseReleveCoeur(text, filename) {    const R = splitReleve(text);
    if (!R) {
      const s = C.parseSwitch(text, filename); s.id = newId();
      s.ext = emptyExt(); s.ext.legacy = true; s.ext.fiab = VENDOR_FIAB[s.vendor] || 'V';
      return s;
    }
    const S = R.S; const sensR = Object.keys(S).filter(k => CMD_SENSIBLES.test(normCmd(k))); sensR.forEach(k => delete S[k]);
    const cmds = Object.keys(S);
    let vendor = String(R.meta.marque || '').toLowerCase();
    if (!VENDOR_LABEL[vendor] || vendor === '') vendor = marqueLegere(cmds.map(k => S[k]).join('\n')) || C.detectVendor(cmds.map(k => S[k]).join('\n'));
    const pick = re => cmds.filter(k => re.test(k)).map(k => S[k]).join('\n');
    const id = C.parseIdentity(pick(/^show (version|system|inventory|sysinfo|system-info|ip interface brief|ip|info)$/));
    const id2 = parseIdentityV2(vendor, S);
    const nbCdp = pick(/cdp/), nbLldp = pick(/lldp/);
    let neighbors = C.parseSwitch(nbCdp + '\n' + nbLldp, 'voisins').neighbors;
    if (!neighbors.some(n => n.proto !== 'CDP') && nbLldp) neighbors = neighbors.concat(parseLldpList(nbLldp));
    /* Correction (sans modifier le parseur d'origine) : en LLDP, la lettre « S » signifie Station, pas Switch.
       normCaps d'origine la traduit en « switch » : une caméra Axis (« Enabled Capabilities: S ») devenait un switch non relevé.
       Un vrai switch annonce « B » (Bridge) en LLDP. */
    neighbors.forEach(n => { if (n.proto === 'LLDP' && (n.caps || []).includes('switch') && !n.caps.includes('bridge')) n.caps = n.caps.filter(c => c !== 'switch').concat('host'); });
    const macTxt = pick(/mac/), arpTxt = pick(/arp/);
    let macTable = C.parseMacArp(macTxt, vendor).macs;
    if (!macTable.length) macTable = parseMacPositional(macTxt);
    const arp = C.parseMacArp(arpTxt, vendor).arp;
    const portTxt = pick(/^show (interfaces? status|interface brief|interfaces brief|interface status all)$/) + '\n' + pick(/^show interfaces? switchport\b/);
    let ports = C.parsePorts(portTxt);
    if (!Object.keys(ports).length) ports = parsePortsPositional(portTxt);
    if (!Object.keys(ports).length && S['show port all']) ports = parseNetgearPorts(S['show port all']);
    if (S['show name']) S['show name'].split('\n').forEach(l => { const m = l.match(/^\s*(\S+)\s+\S+\s+(\S.*?)\s*$/); if (m && ports[C.shortPort(m[1])] && !/^(port|-)/i.test(m[1])) ports[C.shortPort(m[1])].desc = m[2]; });
    const ext = emptyExt();
    Object.assign(ext, { firmware: id2.firmware, uptime: id2.uptime, macBase: id2.macBase, fiab: VENDOR_FIAB[vendor] || 'V' });
    ext.vlans = parseVlans(vendor, S);
    ext.trunks = vendor === 'cisco' ? parseCiscoTrunks(S['show interfaces trunk']) : {};
    if (vendor === 'arubacx') {   // trunk CX : VLAN natif dans show interface brief, VLAN autorisés d'après show vlan
      Object.values(ports).forEach(p => { if (p.mode === 'trunk') ext.trunks[p.port] = { port: p.port, native: p.vlan || '', allowed: ext.vlans.filter(v => v.ports.includes(p.port)).map(v => v.id) }; });
    }
    ext.lags = parseLags(vendor, S);
    ext.stp = parseStp(vendor, S);
    ext.poe = parsePoe(vendor, S);
    ext.errors = parseErrors(S);
    ext.macflap = parseMacFlap(S);
    ext.cdpNative = parseCdpNative(nbCdp);
    ext.lldpPvid = parseLldpPvid(nbLldp);
    ext.commandes = cmds;
    ext.commandesKo = R.meta.manquantes || [];
    ext.releve = { etat: R.meta.etat || '', profondeur: R.meta.profondeur, date: R.meta.date || '', privilege: R.meta.privilege || '', alias: R.meta.alias || [] };
    if (sensR.length) ext.avertissements = ['Configuration complète détectée (' + sensR.join(', ') + ') : ignorée, non lue et non conservée.'];
    const macs = new Set(id.macs); if (id2.macBase) macs.add(id2.macBase);
    const base = {
      id: newId(), name: R.meta.nom || id.name || String(filename || '').replace(/\.[^.]+$/, '') || 'Switch sans nom', vendor,
      model: id2.model || id.model, serial: id2.serial || id.serial, ips: id.ips, macs: [...macs], ports, neighbors, macTable, arp,
      source: filename || 'relevé', importedAt: new Date().toISOString(), location: id2.location || '', mgmtIp: R.meta.ip || '', extraIps: R.meta.alias || [], ext
    };
    if (['planet', 'comnet', 'netgear'].includes(vendor)) parseLeger(vendor, S, ext, base);
    return base;
  }

  /* ---------- import du JSON du collecteur ---------- */
  function importDecouverte(J) {
    if (!J || J.format !== 'carto-reseau-decouverte') throw new Error('Ce fichier JSON ne vient pas du collecteur Carto Réseau v2.');
    const sws = [];
    const terminaux = [];
    arr(J.equipements).forEach(e => {
      if (e.etat === 'alias') return;
      if (e.etat === 'terminal' || e.etat === 'ignore') { terminaux.push({ nom: e.nom, ip: e.ip, raison: e.raison || '', source: e.etat === 'ignore' ? 'utilisateur' : 'réponse CLI', depuis: e.depuis || '', port: e.portDepuis || '' }); return; }
      const hasData = arr(e.sorties).length > 0 && e.marque;
      let s;
      if (hasData) s = parseReleveV2(releveFromEquipement(e), (e.nom || e.ip) + '.txt');
      else {
        s = { id: newId(), name: e.nom || e.ip, vendor: e.marque || '', model: e.modele || '', serial: e.serie || '', ips: [e.ip].filter(Boolean), macs: [], ports: {}, neighbors: [], macTable: [], arp: [], source: 'découverte', importedAt: new Date().toISOString(), location: '', mgmtIp: e.ip, extraIps: arr(e.alias), placeholder: true, ext: emptyExt() };
      }
      s.mgmtIp = e.ip; s.extraIps = arr(e.alias);
      if (e.ip) s.id = 'ip' + String(e.ip).replace(/\D/g, '_');   // identifiant stable : la page garde sélection et positions lors des mises à jour
      s.ext.releve = { etat: e.etat, raison: e.raison || '', classeErreur: e.classeErreur || '', profondeur: e.profondeur, date: e.date || '', privilege: e.privilege || '', tentatives: e.tentatives || 0, essais: arr(e.essais), compte: e.compte || '', messageBrut: e.messageBrut || '', acces: e.acces || null, depuis: e.depuis || '', portDepuis: e.portDepuis || '' };
      s.ext.commandesKo = arr(e.commandes).filter(c => c.statut !== 'ok').map(c => c.commande + ' (' + c.statut + ')');
      if (e.firmware) s.ext.firmware = s.ext.firmware || e.firmware;
      if (e.uptime) s.ext.uptime = s.ext.uptime || e.uptime;
      if (!s.model && e.modele) s.model = e.modele;
      sws.push(s);
    });
    const decouverte = {
      depart: J.depart, perimetre: arr(J.perimetre), profondeurMax: J.profondeurMax, maxEquipements: J.maxEquipements, demarre: J.demarre, termine: J.termine,
      dureeSecondes: J.dureeSecondes, limiteAtteinte: !!J.limiteAtteinte, nonParcourus: arr(J.nonParcourus), journal: arr(J.journal).slice(-1500), dossier: J.dossier || '',
      exemple: !!J.exemple, avertissement: J.avertissement || '', executions: arr(J.executions), outil: J.outil || '',
      candidats: arr(J.candidats).map(c => ({ ip: c.ip, nom: c.nom, chassis: c.chassis, depuis: c.depuis, port: c.port, description: c.description, ssh: c.ssh, score: c.score, classe: c.classe, type: c.type, raisons: arr(c.raisons), coche: !!c.coche, marque: c.marque || '', statut: c.statut, ipsAlt: arr(c.ipsAlt) })),
      terminaux, refusAuth: J.refusAuth || 0
    };
    /* Voisins classés terminaux (§1bis) : AP dessiné comme borne Wi-Fi, caméra / autre comme équipement — jamais comme « switch non relevé » */
    const term = decouverte.candidats.filter(c => c.classe === 'terminal' || terminaux.some(x => x.ip && x.ip === c.ip));
    if (term.length) sws.forEach(s => (s.neighbors || []).forEach(n => {
      const c = term.find(c => (c.ip && n.ip === c.ip) || (c.chassis && n.chassis && normMac(c.chassis) === n.chassis) || (c.nom && n.name === c.nom));
      if (c) n.caps = c.type === 'ap' ? ['ap'] : ['host'];
    }));
    return { switches: sws, decouverte };
  }

  /* ---------- aides au modèle ---------- */
  function lagOf(s, port) { for (const g of (s.ext && s.ext.lags) || []) if (g.members.some(m => m.port === port)) return g; return null; }
  function trunkOf(s, port) {
    const t = (s.ext && s.ext.trunks) || {};
    if (t[port]) return t[port];
    const g = lagOf(s, port); if (g && t[g.id]) return t[g.id];
    return null;
  }
  function modeOf(s, port) {
    if (trunkOf(s, port)) return 'trunk';
    const p = (s.ports || {})[port]; if (p && p.mode) return p.mode;
    const g = lagOf(s, port); if (g && s.ports && s.ports[g.id] && s.ports[g.id].mode) return s.ports[g.id].mode;
    return '';
  }
  function swOfMacFn(sws) {
    const list = []; sws.forEach(s => { const w = /^(planet|mikrotik)$/.test(s.vendor) ? 0 : 128; (s.macs || []).forEach(h => list.push([parseInt(h, 16), s, w])); });
    return h => { if (!h) return null; const v = parseInt(h, 16); for (const [x, s, w] of list) if (Math.abs(x - v) <= w) return s; return null; };
  }
  function statusOfSwitch(s) {
    const r = (s.ext && s.ext.releve) || {};
    if (r.etat === 'inconnu') return 'inconnu';
    if (s.placeholder || r.etat === 'echec') return 'echec';
    if (r.etat === 'partiel') return 'partiel';
    return 'ok';
  }
  const CLASS_TXT = {
    auth: 'identifiants refusés', timeout: 'injoignable', refus: 'SSH refusé', fermeture: 'connexion fermée par l\'équipement', 'cle-modifiee': 'clé d\'hôte modifiée (sécurité)',
    'cle-refusee': 'clé d\'hôte non acceptée', 'cle-inconnue': 'clé d\'hôte non validée', algo: 'SSH incompatible', 'algo-faible': 'SSH ancien (mode compatibilité possible)', suspendu: 'non tenté (logins suspendus)', sessions: 'trop de sessions ouvertes', 'sans-invite': 'pas de réponse',
    'mdp-a-changer': 'changement de mot de passe demandé', coupure: 'session coupée', privilege: 'droits insuffisants', marque: 'modèle non reconnu', pwfile: 'mot de passe non transmis', inconnue: 'erreur'
  };

  /* ---------- anomalies (spec-reseau §3.2) ---------- */
  const DEF_CFG = { poeSeuil: 80, crcSeuil: 100, ageJours: 7 };
  function computeAnomalies(state, M, cfg) {
    cfg = Object.assign({}, DEF_CFG, cfg || {});
    const sws = state.switches || [], out = [];
    const byId = {}; sws.forEach(s => { byId[s.id] = s; });
    const nodeOf = id => M.nodes.find(n => n.id === id);
    const add = a => { a.id = 'a' + out.length; out.push(a); };
    const swOfMac = swOfMacFn(sws);

    // 1. état des relevés
    sws.forEach(s => {
      const r = (s.ext && s.ext.releve) || {}, st = statusOfSwitch(s);
      if (st === 'echec') {
        const cause = CLASS_TXT[r.classeErreur] || r.raison || 'non relevé';
        add({ sev: r.classeErreur === 'cle-modifiee' ? 'crit' : 'warn', cat: 'non-releve', fiab: 'confirmé', sw: s.name, swId: s.id, port: '',
          titre: s.name + ' non relevé : ' + cause, detail: (r.raison || '') + (r.tentatives ? ' · ' + r.tentatives + ' tentative(s)' : '') + (r.classeErreur === 'auth' ? ' · aucune relance automatique (risque de verrouillage du compte)' : ''),
          preuve: 'collecteur : ' + (r.classeErreur || 'échec'), simple: 'Le switch ' + s.name + ' n\'a pas pu être relevé (' + cause + ').' });
      } else if (st === 'inconnu') {
        add({ sev: 'warn', cat: 'non-releve', fiab: 'confirmé', sw: s.name, swId: s.id, port: '', titre: s.name + ' : marque non reconnue', detail: 'Seules les commandes de détection ont été envoyées. Fournir une sortie réelle (annexe B) pour ajouter ce modèle.', preuve: 'show version / show system', simple: 'Le modèle du switch ' + s.name + ' n\'est pas reconnu par l\'outil.' });
      } else if (st === 'partiel') {
        add({ sev: 'warn', cat: 'partiel', fiab: 'confirmé', sw: s.name, swId: s.id, port: '', titre: s.name + ' : relevé partiel', detail: (r.raison || '') + (s.ext.commandesKo.length ? ' Commandes non obtenues : ' + s.ext.commandesKo.join(', ') : ''), preuve: 'collecteur', simple: 'Le relevé du switch ' + s.name + ' est incomplet.' });
      }
      if (r.date && cfg.ageJours > 0) {
        const age = (Date.now() - new Date(r.date).getTime()) / 864e5;
        if (age > cfg.ageJours) add({ sev: 'warn', cat: 'ancien', fiab: 'confirmé', sw: s.name, swId: s.id, port: '', titre: s.name + ' : relevé de ' + Math.floor(age) + ' jours', detail: 'Date du relevé : ' + r.date + ' (seuil ' + cfg.ageJours + ' j).', preuve: 'date du relevé', simple: 'Les informations du switch ' + s.name + ' datent de ' + Math.floor(age) + ' jours.' });
      }
    });

    // 2. LAG dégradés
    sws.forEach(s => (s.ext ? s.ext.lags : []).forEach(g => {
      const ko = g.members.filter(m => !m.ok && !/H/.test(m.flags || ''));
      if (!g.up || ko.length) add({ sev: 'crit', cat: 'lag', fiab: 'confirmé', sw: s.name, swId: s.id, port: g.id,
        titre: 'LAG ' + g.id + ' dégradé sur ' + s.name, detail: (g.up ? '' : 'Agrégat hors service. ') + ko.map(m => m.port + ' ' + (m.etat || m.flags)).join(', '),
        preuve: 'show etherchannel summary : ' + g.id + '(' + g.flags + ') ' + g.members.map(m => m.port + '(' + m.flags + ')').join(' '), simple: 'Une liaison agrégée de ' + s.name + ' fonctionne en mode dégradé.' });
    }));

    // 3. liens : vus d'un seul côté, VLAN natif, trunks, nombre de membres LAG
    const pairs = {};
    M.links.forEach(L => {
      if (L.kind !== 'switch' || !L.a.startsWith('sw:') || !L.b.startsWith('sw:')) return;
      const A = byId[L.a.slice(3)], B = byId[L.b.slice(3)]; if (!A || !B) return;
      const key = [A.id, B.id].sort().join('|');
      (pairs[key] = pairs[key] || { A, B, links: [] }).links.push(L);
      if (!L.both && statusOfSwitch(B) === 'ok' && (B.neighbors || []).length) {
        add({ sev: 'warn', cat: 'asym', fiab: 'probable', sw: A.name, swId: A.id, port: L.aPort, lien: [L.a, L.b],
          titre: 'Lien vu d\'un seul côté : ' + A.name + ' ' + L.aPort + ' → ' + B.name + (L.bPort ? ' ' + L.bPort : ''),
          detail: A.name + ' voit ' + B.name + ' en LLDP/CDP, mais ' + B.name + ' ne voit pas ' + A.name + ' sur ce lien. Cause possible : lien simplex, port suspendu, LLDP désactivé d\'un côté. À confirmer sur site (UDLD / test).',
          preuve: 'voisins LLDP/CDP de ' + A.name + ' (' + L.aPort + ')', simple: 'Un lien entre ' + A.name + ' et ' + B.name + ' semble ne fonctionner que dans un sens.' });
      }
    });
    Object.values(pairs).forEach(({ A, B, links }) => {
      const seen = new Set();
      links.forEach(L => {
        const aS = byId[L.a.slice(3)], bS = byId[L.b.slice(3)];
        const pa = L.aPort, pb = L.bPort; if (!pa || !pb) return;
        const ta = trunkOf(aS, pa), tb = trunkOf(bS, pb);
        const na = ta && ta.native, nb = tb && tb.native;
        const k = (lagOf(aS, pa) || { id: pa }).id + '|' + (lagOf(bS, pb) || { id: pb }).id;
        if (seen.has(k)) return; seen.add(k);
        if (na && nb && na !== nb) add({ sev: 'warn', cat: 'natif', fiab: 'probable', sw: aS.name, swId: aS.id, port: pa, lien: [L.a, L.b],
          titre: 'VLAN natif différent : ' + aS.name + ' ' + (lagOf(aS, pa) || { id: pa }).id + ' (' + na + ') ↔ ' + bS.name + ' ' + (lagOf(bS, pb) || { id: pb }).id + ' (' + nb + ')',
          detail: 'Les deux extrémités du trunk n\'ont pas le même VLAN natif.', preuve: 'trunks des deux switchs', simple: 'Une liaison entre ' + aS.name + ' et ' + bS.name + ' est mal configurée (VLAN natif).' });
        const ma = modeOf(aS, pa), mb = modeOf(bS, pb);
        if (ma && mb && ma !== mb && /trunk|access/.test(ma) && /trunk|access/.test(mb)) add({ sev: 'warn', cat: 'trunk', fiab: 'probable', sw: aS.name, swId: aS.id, port: pa, lien: [L.a, L.b],
          titre: 'Mode différent : ' + aS.name + ' ' + pa + ' (' + ma + ') ↔ ' + bS.name + ' ' + pb + ' (' + mb + ')', detail: 'Un côté en trunk, l\'autre en accès.', preuve: 'état des ports', simple: 'Une liaison entre ' + aS.name + ' et ' + bS.name + ' est configurée différemment de chaque côté.' });
        if (ta && tb && ta.allowed && tb.allowed && ta.allowed.length && tb.allowed.length) {
          const sa = compactVlans(ta.allowed), sb = compactVlans(tb.allowed);
          if (sa !== sb) {
            const onlyA = ta.allowed.filter(v => !tb.allowed.includes(v)), onlyB = tb.allowed.filter(v => !ta.allowed.includes(v));
            add({ sev: 'warn', cat: 'trunk', fiab: 'probable', sw: aS.name, swId: aS.id, port: pa, lien: [L.a, L.b],
              titre: 'VLAN autorisés différents : ' + aS.name + ' ↔ ' + bS.name, detail: aS.name + ' : ' + sa + ' · ' + bS.name + ' : ' + sb + (onlyA.length ? ' · seulement ' + aS.name + ' : ' + compactVlans(onlyA) : '') + (onlyB.length ? ' · seulement ' + bS.name + ' : ' + compactVlans(onlyB) : ''),
              preuve: 'VLAN autorisés sur le trunk', simple: 'Une liaison entre ' + aS.name + ' et ' + bS.name + ' ne transporte pas les mêmes réseaux des deux côtés.' });
          }
        }
      });
      // CDP : VLAN natif annoncé par le voisin
      [[A, B], [B, A]].forEach(([X, Y]) => Object.entries((X.ext && X.ext.cdpNative) || {}).forEach(([port, c]) => {
        if (C.normMac && c.device && String(c.device).split('.')[0].toLowerCase() !== String(Y.name).toLowerCase()) return;
        const t = trunkOf(X, port);
        if (t && t.native && c.native && t.native !== c.native && !out.some(o => o.cat === 'natif' && o.fiab === 'confirmé (CDP)' && o.swId === X.id))
          add({ sev: 'warn', cat: 'natif', fiab: 'confirmé (CDP)', sw: X.name, swId: X.id, port, lien: null,
            titre: 'VLAN natif : ' + X.name + ' ' + port + ' en ' + t.native + ', le voisin ' + Y.name + ' annonce ' + c.native, detail: 'Discordance annoncée par CDP (champ Native VLAN).', preuve: 'show cdp neighbors detail : Native VLAN: ' + c.native, simple: 'La liaison entre ' + X.name + ' et ' + Y.name + ' est mal configurée (VLAN natif).' });
      }));
      // nombre de membres LAG des deux côtés
      const lagsA = new Set(), lagsB = new Set();
      links.forEach(L => { const a = lagOf(byId[L.a.slice(3)], L.aPort), b = L.bPort ? lagOf(byId[L.b.slice(3)], L.bPort) : null; if (a) lagsA.add(a); if (b) lagsB.add(b); });
      if (lagsA.size === 1 && lagsB.size === 1) {
        const ga = [...lagsA][0], gb = [...lagsB][0];
        if (ga.members.length !== gb.members.length) add({ sev: 'warn', cat: 'lag', fiab: 'probable', sw: A.name, swId: A.id, port: ga.id, titre: 'LAG ' + ga.id + ' / ' + gb.id + ' : nombre de membres différent', detail: ga.members.length + ' contre ' + gb.members.length, preuve: 'show etherchannel summary', simple: 'Une liaison agrégée n\'a pas le même nombre de câbles des deux côtés.' });
      }
    });

    // 4. STP
    const rootsBy = {}, modes = new Set();
    sws.forEach(s => { const st = s.ext && s.ext.stp; if (!st) return; if (st.famille) modes.add(st.famille + ':' + st.mode); (st.roots || []).forEach(r => { (rootsBy[r.vlan] = rootsBy[r.vlan] || []).push({ s, r }); }); });
    Object.entries(rootsBy).forEach(([vl, list]) => {
      const macs = [...new Set(list.map(x => x.r.mac))];
      if (macs.length > 1) add({ sev: 'warn', cat: 'stp', fiab: 'probable', sw: list.map(x => x.s.name).join(', '), swId: list[0].s.id, port: '', titre: 'Plusieurs racines STP pour ' + vl,
        detail: list.map(x => x.s.name + ' voit ' + C.fmtMac(x.r.mac) + (swOfMac(x.r.mac) ? ' (' + swOfMac(x.r.mac).name + ')' : '')).join(' · '), preuve: 'show spanning-tree root', simple: 'Le réseau a plusieurs « chefs d\'orchestre » STP pour un même VLAN.' });
      macs.forEach(mac => { const owner = swOfMac(mac); const n = owner && nodeOf('sw:' + owner.id); if (owner && n && n.swRole !== 'coeur') add({ sev: 'info', cat: 'stp', fiab: 'probable', sw: owner.name, swId: owner.id, port: '', titre: 'Racine STP ' + vl + ' : ' + owner.name + ' n\'est pas un cœur', detail: 'Peut être volontaire (cœur secondaire, région MST).', preuve: 'spanning-tree', simple: '' }); });
    });
    {
      const vus = {};
      Object.entries(rootsBy).forEach(([vl, list]) => list.forEach(({ s, r }) => { if (!r.mac || swOfMac(r.mac)) return; (vus[r.mac] = vus[r.mac] || []).push(s.name + (/^(CST|MST0)$/.test(vl) ? '' : ' (' + vl + ')')); }));
      Object.entries(vus).forEach(([mac, qui]) => {
        let ou = '';
        sws.forEach(s => { const P = M.ports[s.id] || {}; (s.macTable || []).forEach(e => { const p = P[e.port]; if (!ou && C.normMac(e.mac) === mac && p && p.cls !== 'switch' && !lagOf(s, e.port)) ou = s.name + ' port ' + e.port + (/\d/.test(p.speed || '') ? ' (' + String(p.speed).match(/\d+/)[0] + ' Mb/s)' : ''); }); });
        let ip = ''; sws.forEach(s => (s.arp || []).forEach(a => { if (!ip && C.normMac(a.mac) === mac) ip = a.ip; }));
        add({ sev: 'warn', cat: 'stp', fiab: 'probable', sw: qui.join(', '), swId: '', port: '', titre: 'Racine spanning-tree : ' + C.fmtMac(mac) + (ip ? ' (' + ip + ')' : '') + ' n\'est pas un switch relevé',
          detail: 'Vue comme racine par ' + [...new Set(qui)].join(', ') + (ou ? '. Branchée sur ' + ou : '') + '. Souvent une radio ou un pont qui fait du STP : il dirige tout le réseau et chaque coupure le fait recalculer. Donner la priorité la plus basse au cœur (Cisco : spanning-tree vlan … priority 4096 ; HP/Aruba : spanning-tree priority 1).',
          preuve: 'spanning-tree', simple: 'Un équipement qui n\'est pas un switch commande la protection anti-boucle du réseau.' });
      });
    }
    const sansStp = sws.filter(s => s.ext && s.ext.stp && s.ext.stp.mode === 'désactivé');
    if (sansStp.length) add({ sev: 'warn', cat: 'stp', fiab: 'certain', sw: sansStp.map(s => s.name).join(', '), swId: sansStp[0].id, port: '', titre: 'Spanning-tree désactivé : ' + sansStp.map(s => s.name).join(', '),
      detail: 'Aucune protection contre les boucles : un câble branché entre deux prises du même réseau peut bloquer tout le site (tempête de broadcast). À activer (HP : spanning-tree, puis priorité basse sur le cœur) dans une fenêtre de maintenance.',
      preuve: 'show spanning-tree : STP Enabled : No', simple: sansStp.length + ' switch(s) n\'ont pas de protection anti-boucle.' });
    sws.forEach(s => { const t = s.ext && s.ext.temp; if (t >= 60) add({ sev: t >= 70 ? 'warn' : 'info', cat: 'materiel', fiab: 'certain', sw: s.name, swId: s.id, port: '', titre: s.name + ' : température ' + t + ' °C',
      detail: 'Température interne relevée. Au-delà de 70 °C, vérifier la ventilation du local / de la baie et la poussière.', preuve: 'show version / show system temperature', simple: s.name + ' chauffe (' + t + ' °C).' }); });
    const fam = new Set([...modes].filter(m => !/^désactivé/.test(m)).map(m => m.split(':')[0]));
    if (fam.size > 1) add({ sev: 'warn', cat: 'stp', fiab: 'probable', sw: '', swId: '', port: '', titre: 'Modes STP différents entre switchs', detail: sws.filter(s => s.ext && s.ext.stp && s.ext.stp.mode).map(s => s.name + ' : ' + s.ext.stp.mode).join(' · '), preuve: 'spanning-tree', simple: 'Les switchs n\'utilisent pas tous le même mode de protection contre les boucles.' });

    // 5. firmware hétérogène
    const byModel = {};
    sws.forEach(s => { const fw = s.ext && s.ext.firmware; if (s.model && fw) (byModel[s.model] = byModel[s.model] || {})[fw] = (byModel[s.model][fw] || []).concat(s.name); });
    Object.entries(byModel).forEach(([mod, fws]) => {
      if (Object.keys(fws).length > 1) add({ sev: 'warn', cat: 'firmware', fiab: 'confirmé', sw: Object.values(fws).flat().join(', '), swId: '', port: '', titre: 'Firmware différent pour ' + mod, detail: Object.entries(fws).map(([f, n]) => f + ' : ' + n.join(', ')).join(' · ') + '. Pas de version « recommandée » sans source constructeur à jour.', preuve: 'show version', simple: Object.values(fws).flat().length + ' switchs ' + mod + ' n\'ont pas la même version de logiciel.' });
    });

    // 6. ports, PoE, erreurs
    sws.forEach(s => {
      const P = M.ports[s.id] || {};
      Object.values(P).forEach(p => {
        const up = (p.cls === 'switch' || p.cls === 'externe' || lagOf(s, p.port));
        if (/err-disabled/i.test(p.statusRaw || '')) add({ sev: up ? 'crit' : 'warn', cat: up ? 'lien-panne' : 'port', fiab: 'confirmé', sw: s.name, swId: s.id, port: p.port, titre: s.name + ' ' + p.port + ' en err-disabled', detail: (p.desc ? p.desc + ' · ' : '') + 'Port coupé par le switch (protection).', preuve: 'show interfaces status : err-disabled', simple: up ? 'Une liaison de ' + s.name + ' est coupée.' : 'Un port de ' + s.name + ' est coupé (' + (p.desc || p.port) + ').' });
        const e = (s.ext && s.ext.errors || {})[p.port];
        if (e && (e.fcs + e.align) > cfg.crcSeuil) add({ sev: 'warn', cat: 'port', fiab: 'probable', sw: s.name, swId: s.id, port: p.port, titre: s.name + ' ' + p.port + ' : ' + (e.fcs + e.align) + ' erreurs CRC', detail: 'Câble, connecteur ou SFP à vérifier (seuil ' + cfg.crcSeuil + ').', preuve: 'show interfaces counters errors : FCS-Err ' + e.fcs, simple: 'Un câble ou un port de ' + s.name + ' produit des erreurs.' });
        if (p.status === 'up' && /^(10|100)$/.test(String(p.speed || '').replace(/^a-/, '')) && !/10\/100BASE|100BaseTX$|^100TX$/i.test(p.type || '')) add({ sev: 'info', cat: 'port', fiab: 'probable', sw: s.name, swId: s.id, port: p.port, titre: s.name + ' ' + p.port + ' connecté à ' + String(p.speed).replace(/^a-/, '') + ' Mb/s', detail: (p.desc || '') + ' · négociation à vérifier si l\'équipement supporte 1 Gb/s.', preuve: 'état du port', simple: '' });
      });
      const poe = s.ext && s.ext.poe;
      if (poe && poe.pct != null && poe.pct > cfg.poeSeuil) add({ sev: 'warn', cat: 'poe', fiab: 'confirmé', sw: s.name, swId: s.id, port: '', titre: 'PoE à ' + poe.pct + ' % sur ' + s.name, detail: poe.used + ' W / ' + poe.budget + ' W (seuil ' + cfg.poeSeuil + ' %).', preuve: 'budget PoE', simple: 'L\'alimentation des caméras de ' + s.name + ' est presque au maximum (' + poe.pct + ' %).' });
      if (poe) Object.entries(poe.ports).forEach(([pt, x]) => { if (x.oper === 'faulty') add({ sev: 'warn', cat: 'poe', fiab: 'confirmé', sw: s.name, swId: s.id, port: pt, titre: s.name + ' ' + pt + ' : PoE en défaut', detail: 'Équipement alimenté en défaut ou court-circuit.', preuve: 'PoE : faulty', simple: 'Un équipement alimenté par ' + s.name + ' est en défaut.' }); });
      (s.ext ? s.ext.macflap : []).forEach(f => add({ sev: 'warn', cat: 'macflap', fiab: 'confirmé (journal)', sw: s.name, swId: s.id, port: f.ports.join(' / '), titre: 'MAC flapping sur ' + s.name + (f.mac ? ' : ' + C.fmtMac(f.mac) : ''), detail: f.ligne, preuve: 'show logging : MACFLAP', simple: 'Un équipement change sans cesse de port sur ' + s.name + ' (boucle possible).' }));
    });
    // même MAC sur deux ports « bord »
    const edge = {};
    sws.forEach(s => { const P = M.ports[s.id] || {}; (s.macTable || []).forEach(e => { const p = P[e.port]; if (!p || p.cls === 'switch' || p.cls === 'externe' || lagOf(s, e.port) || swOfMac(e.mac)) return; (edge[e.mac] = edge[e.mac] || new Set()).add(s.name + ' ' + e.port); }); });
    Object.entries(edge).forEach(([mac, set]) => { if (set.size > 1) add({ sev: 'warn', cat: 'macflap', fiab: 'probable', sw: [...set].join(', '), swId: '', port: '', titre: 'MAC ' + C.fmtMac(mac) + ' sur ' + set.size + ' ports d\'accès', detail: [...set].join(' · ') + '. Peut être normal (VM qui migre, cluster, agrégation de cartes).', preuve: 'tables MAC', simple: '' }); });

    // 7. doublons
    const byName = {}, byIp = {};
    sws.forEach(s => { const n = String(s.name).toLowerCase(); (byName[n] = byName[n] || []).push(s); [s.mgmtIp].concat(s.ips || []).filter(Boolean).forEach(ip => { (byIp[ip] = byIp[ip] || new Set()).add(s); }); });
    Object.values(byName).forEach(l => { if (l.length > 1) add({ sev: 'warn', cat: 'doublon', fiab: 'confirmé', sw: l[0].name, swId: l[0].id, port: '', titre: 'Deux équipements nommés ' + l[0].name, detail: l.map(s => (s.mgmtIp || s.ips[0] || '?') + ' S/N ' + (s.serial || '?')).join(' · '), preuve: 'noms d\'hôte', simple: 'Deux switchs portent le même nom (' + l[0].name + ').' }); });
    Object.entries(byIp).forEach(([ip, set]) => { if (set.size > 1) add({ sev: 'warn', cat: 'doublon', fiab: 'probable', sw: [...set].map(s => s.name).join(', '), swId: '', port: '', titre: 'IP ' + ip + ' portée par ' + set.size + ' switchs', detail: 'Conflit d\'IP ou erreur d\'alias.', preuve: 'interfaces IP', simple: 'Une même adresse IP est utilisée par plusieurs switchs.' }); });

    // 8. voisins non parcourus (découverte)
    const d = state.decouverte;
    if (d) {
      const grp = {};
      arr(d.nonParcourus).forEach(n => { const k = /non-switch|^terminal/.test(n.raison) ? 'non-switch' : /non retenu/.test(n.raison) ? 'non retenu à la validation' : n.raison; (grp[k] = grp[k] || []).push(n); });
      Object.entries(grp).forEach(([k, l]) => {
        const nonSw = k === 'non-switch';
        add({ sev: 'info', cat: 'voisin', fiab: 'confirmé', sw: '', swId: '', port: '', titre: l.length + ' voisin(s) non parcouru(s) : ' + k, detail: l.slice(0, 12).map(n => (n.nom || '?') + (n.ip ? ' (' + n.ip + ')' : '') + ' via ' + n.depuis + ' ' + n.port).join(' · ') + (l.length > 12 ? ' …' : ''),
          preuve: 'découverte', simple: nonSw ? '' : l.length + ' équipement(s) réseau vu(s) mais non relevé(s) (' + k + ').' });
      });
      if (d.limiteAtteinte) add({ sev: 'warn', cat: 'voisin', fiab: 'confirmé', sw: '', swId: '', port: '', titre: 'Limite du nombre d\'équipements atteinte (' + d.maxEquipements + ')', detail: 'La découverte s\'est arrêtée avant la fin.', preuve: 'collecteur', simple: 'La découverte n\'est pas complète (limite atteinte).' });
    }
    // 9. Genetec (si un inventaire est importé)
    if (state.genetec || state.gconfig) {
      const g = genetecControles(state, M);
      if (g.absentes.length) add({ sev: 'warn', cat: 'genetec', fiab: 'probable', sw: '', swId: '', port: '', titre: g.absentes.length + ' caméra(s) Genetec absente(s) du réseau relevé', detail: g.absentes.slice(0, 12).map(r => r.name + (r.ip ? ' (' + r.ip + ')' : '')).join(' · ') + ' — éteinte, débranchée, ou derrière un switch non relevé.', preuve: 'inventaire Genetec ↔ tables MAC/ARP', simple: g.absentes.length + ' caméra(s) déclarée(s) dans Genetec ne sont pas vues sur le réseau.' });
      if (g.ecartsIp.length) add({ sev: 'warn', cat: 'genetec', fiab: 'confirmé', sw: '', swId: '', port: '', titre: g.ecartsIp.length + ' écart(s) d\'IP ou de MAC entre Genetec et le réseau', detail: g.ecartsIp.map(r => r.name + ' : ' + r.note).join(' · '), preuve: 'inventaire Genetec ↔ ARP', simple: 'Des caméras n\'ont pas la même adresse dans Genetec et sur le réseau.' });
      if (g.doublonsIp.length || g.doublonsMac.length) add({ sev: 'warn', cat: 'genetec', fiab: 'confirmé', sw: '', swId: '', port: '', titre: 'Doublons dans l\'inventaire Genetec : ' + g.doublonsMac.length + ' MAC, ' + g.doublonsIp.length + ' IP', detail: g.doublonsMac.map(x => C.fmtMac(x.mac) + ' : ' + x.noms.join(', ')).concat(g.doublonsIp.map(x => x.ip + ' : ' + x.noms.join(', '))).join(' · '), preuve: 'inventaire Genetec', simple: 'L\'inventaire Genetec contient des adresses en double.' });
      if (g.conflitsNom.length) add({ sev: 'info', cat: 'genetec', fiab: 'confirmé', sw: '', swId: '', port: '', titre: g.conflitsNom.length + ' conflit(s) de nom (Genetec / réseau)', detail: g.conflitsNom.map(x => x.nom + ' — ' + x.detail).join(' · '), preuve: 'Genetec ↔ LLDP', simple: '' });
      const fh = g.firmware.filter(x => x.heterogene);
      if (fh.length) add({ sev: 'info', cat: 'genetec', fiab: 'confirmé', sw: '', swId: '', port: '', titre: 'Firmware caméras hétérogène pour ' + fh.length + ' modèle(s)', detail: fh.map(x => x.modele + ' : ' + Object.keys(x.versions).join(' / ')).join(' · '), preuve: 'inventaire Genetec (version du micrologiciel)', simple: '' });
    }
    // 10. passerelle configurée sur les switchs mais absente du réseau (aucune réponse ARP)
    const G = M.gwConfig;
    if (G && !G.repond) add({ sev: 'warn', cat: 'passerelle', fiab: 'confirmé', sw: G.switchs.join(', '), swId: '', port: '',
      titre: 'Passerelle ' + G.ip + ' configurée sur ' + G.switchs.length + ' switch(s) mais absente du réseau',
      detail: 'Aucune réponse ARP pour ' + G.ip + ' (adresse inexistante ou équipement éteint). Switchs : ' + G.switchs.join(', ') + (G.autres.length ? '. Autre(s) passerelle(s) configurée(s) : ' + G.autres.join(', ') : '') + '. Sans passerelle valide, ces switchs ne sont joignables que depuis leur propre réseau.',
      preuve: 'show ip (Default Gateway) ↔ tables ARP', simple: G.switchs.length + ' switch(s) utilisent une passerelle (' + G.ip + ') qui ne répond pas.' });
    const rank = { crit: 0, warn: 1, info: 2 };
    out.sort((a, b) => rank[a.sev] - rank[b.sev]);
    return out;
  }

  /* ---------- santé du site (règle publiée sur la page) ---------- */
  const HEALTH_RULE = 'Rouge : au moins un LAG dégradé ou une liaison inter-switch coupée (err-disabled). Orange : firmware hétérogène, PoE au-dessus du seuil, relevé ancien, ou switch non relevé / partiel. Vert : aucun de ces cas. Les autres anomalies sont listées sans changer la couleur.';
  function health(anoms) {
    if (anoms.some(a => a.sev === 'crit' && (a.cat === 'lag' || a.cat === 'lien-panne'))) return 'crit';
    if (anoms.some(a => ['firmware', 'poe', 'ancien', 'non-releve', 'partiel'].includes(a.cat) && a.sev !== 'info')) return 'warn';
    return 'ok';
  }
  function switchState(s, anoms) {
    const st = statusOfSwitch(s);
    if (st === 'echec' || st === 'inconnu') return 'unk';
    const mine = anoms.filter(a => a.swId === s.id);
    if (mine.some(a => a.sev === 'crit')) return 'crit';
    if (mine.some(a => a.sev === 'warn') || st === 'partiel') return 'warn';
    return 'ok';
  }
  function portStats(s, M) {
    const P = Object.values(M.ports[s.id] || {}).filter(p => isPhysical(p.port) && p.status);
    const up = P.filter(p => p.status === 'up').length;
    const libres = P.filter(p => p.status === 'down' && !/disabled/i.test(p.statusRaw || '') && !(p.macs && p.macs.size) && !(p.nbs && p.nbs.length)).length;
    const err = P.filter(p => /err-disabled/i.test(p.statusRaw || '')).length;
    return { total: P.length, up, libres, err, pct: P.length ? Math.round(100 * up / P.length) : null };
  }

  /* ---------- disposition par niveaux (ordre issu de l'auto-layout d'origine) ---------- */
  const TIER = { coeur: 0, distribution: 1, acces: 2 };
  function tierOf(n) { if (n.kind !== 'switch') return 3; return TIER[n.swRole] != null ? TIER[n.swRole] : TIER[n.swRoleShown] != null ? TIER[n.swRoleShown] : (n.level === 0 ? 0 : 2); }
  const NODE_SIZE = [{ w: 210, h: 62 }, { w: 196, h: 58 }, { w: 184, h: 54 }, { w: 176, h: 46 }];
  function tierLayout(model, opts) {
    opts = opts || {};
    const base = C.autoLayout(model, opts);
    const vis = model.nodes.filter(n => base[n.id]);
    const tiers = [[], [], [], []];
    vis.forEach(n => tiers[tierOf(n)].push(n));
    const GX = 34, GY = 56, maxPerRow = opts.perRow || 8, pos = {}, bands = [];
    let y = 46;
    const rowsW = [];
    tiers.forEach((list, t) => {
      if (!list.length) return;
      list.sort((a, b) => base[a.id].x - base[b.id].x || base[a.id].y - base[b.id].y);
      const sz = NODE_SIZE[t]; const rows = [];
      for (let i = 0; i < list.length; i += maxPerRow) rows.push(list.slice(i, i + maxPerRow));
      const top = y;
      rows.forEach(r => { rowsW.push(r.length * (sz.w + GX) - GX); r.forEach((n, i) => { pos[n.id] = { x: i * (sz.w + GX), y, w: sz.w, h: sz.h, row: rows.indexOf(r), rowLen: r.length, tier: t }; }); y += sz.h + 30; });
      bands.push({ tier: t, y: top - 30, h: y - top + 10 });
      y += GY - 30;
    });
    const W = Math.max(600, ...rowsW);
    Object.values(pos).forEach(p => { const sz = NODE_SIZE[p.tier]; const rw = p.rowLen * (sz.w + GX) - GX; p.x += 60 + (W - rw) / 2; });
    return { pos, bands, width: W + 120, height: y };
  }

  /* ---------- export Excel (.xlsx) sans bibliothèque : OOXML + ZIP non compressé ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    files.forEach(f => {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((a, x) => a + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    const all = parts.concat(central, [new Uint8Array(e.buffer)]);
    const out = new Uint8Array(all.reduce((a, x) => a + x.length, 0)); let p = 0; all.forEach(x => { out.set(x, p); p += x.length; });
    return out;
  }
  const xe = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function makeXlsx(sheets) {
    const used = new Set();
    const safe = n => { let s = String(n).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Feuille'; let k = s, i = 2; while (used.has(k.toLowerCase())) k = s.slice(0, 28) + ' ' + i++; used.add(k.toLowerCase()); return k; };
    const names = sheets.map(s => safe(s.name));
    const files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => '<sheet name="' + xe(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B7480"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    sheets.forEach((sh, i) => {
      const rows = [sh.cols.map(c => c.h)].concat(sh.rows);
      const lastCol = colName(Math.max(0, sh.cols.length - 1));
      const xml = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'];
      sh.cols.forEach((c, j) => xml.push('<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + (c.w || 14) + '" customWidth="1"/>'));
      xml.push('</cols><sheetData>');
      rows.forEach((r, ri) => {
        xml.push('<row r="' + (ri + 1) + '">');
        r.forEach((v, ci) => {
          const ref = colName(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : '';
          if (typeof v === 'number' && isFinite(v)) xml.push('<c r="' + ref + '"' + st + '><v>' + v + '</v></c>');
          else if (v !== '' && v != null) xml.push('<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + xe(v) + '</t></is></c>');
        });
        xml.push('</row>');
      });
      xml.push('</sheetData><autoFilter ref="A1:' + lastCol + Math.max(1, rows.length) + '"/></worksheet>');
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: xml.join('') });
    });
    return zipStore(files);
  }

  /* ---------- lecture Excel (.xlsx) sans bibliothèque : ZIP + DecompressionStream('deflate-raw') + XML ---------- */
  async function readXlsx(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), td = new TextDecoder();
    let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('fichier Excel illisible (ce n\'est pas un .xlsx ; un .xls ancien doit être réenregistré en .xlsx ou .csv)');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const meth = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      files[td.decode(u8.subarray(p + 46, p + 46 + nl))] = { meth, csize, off }; p += 46 + nl + xl + cl;
    }
    const get = async name => {
      const f = files[name]; if (!f) return null;
      const s = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true), data = u8.subarray(s, s + f.csize);
      if (f.meth === 0) return td.decode(data);
      if (f.meth !== 8 || typeof DecompressionStream === 'undefined') throw new Error('compression non prise en charge par ce navigateur : enregistrez la feuille en CSV');
      return td.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    };
    const xml = t => new DOMParser().parseFromString(t, 'application/xml');
    const tags = (d, t) => Array.from(d.getElementsByTagNameNS('*', t));
    const wb = xml(await get('xl/workbook.xml') || '<w/>'), rels = xml(await get('xl/_rels/workbook.xml.rels') || '<r/>');
    const first = tags(wb, 'sheet')[0]; if (!first) throw new Error('aucune feuille dans le classeur');
    const rid = first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || first.getAttribute('r:id');
    const rel = tags(rels, 'Relationship').find(r => r.getAttribute('Id') === rid);
    let path = rel ? rel.getAttribute('Target') : 'worksheets/sheet1.xml'; path = path.replace(/^\//, ''); if (!path.startsWith('xl/')) path = 'xl/' + path;
    const ssT = await get('xl/sharedStrings.xml'); const ss = ssT ? tags(xml(ssT), 'si').map(si => tags(si, 't').map(t => t.textContent).join('')) : [];
    const sh = xml(await get(path) || '<s/>'); const rows = [];
    const colIdx = r => { const m = String(r || '').match(/^([A-Z]+)/); let k = 0; if (m) for (const ch of m[1]) k = k * 26 + ch.charCodeAt(0) - 64; return k - 1; };
    tags(sh, 'row').forEach(r => {
      const ri = (+r.getAttribute('r') || rows.length + 1) - 1; const row = [];
      tags(r, 'c').forEach((c, j) => {
        const t = c.getAttribute('t'), v = tags(c, 'v')[0], k = c.getAttribute('r') ? colIdx(c.getAttribute('r')) : j;
        row[k] = t === 's' ? (ss[+(v && v.textContent)] || '') : t === 'inlineStr' ? tags(c, 't').map(x => x.textContent).join('') : (v ? v.textContent : '');
      });
      rows[ri] = Array.from(row, x => x == null ? '' : x);
    });
    return Array.from(rows, x => x || []);
  }

  /* ---------- Genetec : noms réels par port, contrôles ---------- */
  const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function portGenetec(M) {
    const out = {};
    (M.devices || []).forEach(d => { if (!d.loc || !d.gen) return; const k = d.loc.sw + '|' + d.loc.port; (out[k] = out[k] || []).push({ nom: d.gen.name || d.name, archiveur: d.gen.archiver || '', ip: d.ip || d.gen.ip || '', ipGenetec: d.gen.ip || '', modele: [d.gen.manufacturer, d.gen.model].filter(Boolean).join(' '), firmware: d.gen.firmware || '', nomReseau: d.netName || '' }); });
    return out;
  }
  function genetecControles(state, M) {
    const res = { absentes: [], sansCorrespondance: [], doublonsMac: [], doublonsIp: [], conflitsNom: [], firmware: [], ecartsIp: [], actif: !!(state.genetec || state.gconfig) };
    if (!res.actif) return res;
    const units = (state.genetec && state.genetec.units) || [];
    (M.genRows || []).forEach(r => { if (r.state === 'absent') res.absentes.push(r); if (r.state === 'diff') res.ecartsIp.push(r); });
    (M.devices || []).forEach(d => { if (d.gen || !d.loc || d.loc.cls !== 'equipement' || ['reseau', 'virtuel'].includes(d.cat)) return; res.sansCorrespondance.push(d); });
    units.forEach(u => { if (String(u.name).includes(' / ')) res.doublonsMac.push({ mac: u.mac, noms: u.name.split(' / '), ip: u.ip }); });
    const byIp = {}; units.forEach(u => { if (u.ip) (byIp[u.ip] = byIp[u.ip] || []).push(u); });
    Object.entries(byIp).forEach(([ip, l]) => { if (l.length > 1) res.doublonsIp.push({ ip, noms: l.map(u => u.name), macs: l.map(u => u.mac) }); });
    const byNom = {}; units.forEach(u => String(u.name).split(' / ').forEach(n => { const f = fold(n); if (f) (byNom[f] = byNom[f] || new Set()).add(u.mac || u.ip); }));
    Object.entries(byNom).forEach(([n, s]) => { if (s.size > 1) res.conflitsNom.push({ type: 'même nom Genetec sur plusieurs unités', nom: n, detail: [...s].join(', ') }); });
    units.forEach(u => { if ((u.autresNoms || []).length) res.conflitsNom.push({ type: 'nom différent selon le fichier importé', nom: u.name, detail: 'autre(s) nom(s) : ' + u.autresNoms.join(', ') + ' (le fichier le plus récent est retenu : ' + (u.source || '?') + ')' }); });
    (M.devices || []).forEach(d => {
      if (!d.gen || !d.netName) return;
      const net = d.netName; if (/^[0-9a-f]{12}$/i.test(net.replace(/[^0-9a-f]/gi, '')) && net.replace(/[^0-9a-f]/gi, '').length === 12) return;
      if (/^axis-[0-9a-f]{12}$/i.test(net)) return;   // nom LLDP par défaut d'Axis (axis-<MAC>) : pas un conflit
      if (fold(net) !== fold(d.gen.name) && !String(d.gen.name).split(' / ').some(n => fold(n) === fold(net))) res.conflitsNom.push({ type: 'nom Genetec ≠ nom annoncé sur le réseau (LLDP)', nom: d.gen.name, detail: 'réseau : ' + net + (d.mac ? ' · MAC ' + C.fmtMac(d.mac) : '') });
    });
    const byMod = {}; units.forEach(u => { const k = [u.manufacturer, u.model].filter(Boolean).join(' '); if (k && u.firmware) ((byMod[k] = byMod[k] || {})[u.firmware] = (byMod[k][u.firmware] || [])).push(u.name); });
    Object.entries(byMod).forEach(([m, f]) => res.firmware.push({ modele: m, versions: f, heterogene: Object.keys(f).length > 1 }));
    res.firmware.sort((a, b) => b.heterogene - a.heterogene || a.modele.localeCompare(b.modele));
    return res;
  }

  /* ---------- Genetec : fusion de plusieurs exports manuels (réimport = mise à jour, sans doublon) ---------- */
  const gKey = u => u.mac || (u.ip ? 'ip:' + u.ip : 'nom:' + fold(u.name));
  function mergeGenetecInventaire(prev, parsed, source, date) {
    const sources = ((prev && prev.sources) || []).filter(s => s.nom !== source);
    const keep = ((prev && prev.units) || []).filter(u => u.source !== source);   // réimport du même fichier : ses anciennes lignes sont remplacées
    const map = new Map(); keep.forEach(u => map.set(gKey(u), u));
    let maj = 0, ajout = 0;
    parsed.units.forEach(n => {
      n.source = source; n.importe = date;
      const k = gKey(n), old = map.get(k);
      if (old) {   // même équipement dans un autre fichier : le plus récent l'emporte, l'ancien nom est gardé pour contrôle
        if (old.name && fold(old.name) !== fold(n.name)) n.autresNoms = [...new Set([...(old.autresNoms || []), old.name])];
        ['manufacturer', 'model', 'firmware', 'archiver', 'status', 'ip', 'mac'].forEach(f => { if (!n[f] && old[f]) n[f] = old[f]; });
        maj++;
      } else ajout++;
      map.set(k, n);
    });
    sources.push({ nom: source, type: 'inventaire', date, lignes: parsed.units.length, colonnes: parsed.cols || [] });
    return { units: [...map.values()], sources, source: sources.map(s => s.nom).join(', '), cols: parsed.cols || [], importedAt: date, ajout, maj };
  }
  function mergeGenetecConfig(prev, parsed, source, date) {
    const sources = ((prev && prev.sources) || []).filter(s => s.nom !== source);
    const map = new Map();
    ((prev && prev.rows) || []).filter(r => r.source !== source).forEach(r => map.set(fold(r.name || r.unit) + '|' + fold(r.stream), r));
    parsed.rows.forEach(r => { r.source = source; map.set(fold(r.name || r.unit) + '|' + fold(r.stream), r); });
    sources.push({ nom: source, type: 'configuration', date, lignes: parsed.rows.length, colonnes: parsed.cols || [] });
    return { rows: [...map.values()], sources, source: sources.map(s => s.nom).join(', '), cols: parsed.cols || [], headers: parsed.headers, importedAt: date };
  }
  function removeGenetecSource(state, nom) {
    if (state.genetec) { state.genetec.units = state.genetec.units.filter(u => u.source !== nom); state.genetec.sources = (state.genetec.sources || []).filter(s => s.nom !== nom); if (!state.genetec.units.length) state.genetec = null; }
    if (state.gconfig) { state.gconfig.rows = state.gconfig.rows.filter(r => r.source !== nom); state.gconfig.sources = (state.gconfig.sources || []).filter(s => s.nom !== nom); if (!state.gconfig.rows.length) state.gconfig = null; }
  }
  /* Import d'un tableau (CSV ou feuille Excel) : inventaire ou configuration, détecté par les colonnes (FR ou EN) */
  function importGenetecRows(state, rows, source, date) {
    if (C.classifyGenetec(rows) === 'cfg') {
      const g = C.parseGenetecConfig(rows, source); if (g.error) return { ok: false, msg: 'colonnes non reconnues (' + (g.headers || []).join(', ') + ')' };
      state.gconfig = mergeGenetecConfig(state.gconfig, g, source, date); return { ok: true, msg: g.rows.length + ' flux (configuration caméras)' };
    }
    const g = C.parseGenetecRows(rows, source); if (g.error) return { ok: false, msg: 'colonnes MAC / IP introuvables (' + (g.headers || []).join(', ') + ')' };
    state.genetec = mergeGenetecInventaire(state.genetec, g, source, date);
    return { ok: true, msg: g.units.length + ' unités (' + state.genetec.ajout + ' nouvelles, ' + state.genetec.maj + ' mises à jour)' };
  }

  /* ---------- exclusions (équipements importés par erreur) : mémorisées par identité MAC/Chassis ID, puis IP, puis nom ---------- */
  function identSwitch(s) {
    const macs = [...new Set([(s.ext && s.ext.macBase) || ''].concat(s.macs || []).filter(Boolean))];
    return { type: 'switch', nom: s.name || '', mac: macs[0] || '', macs, ip: s.mgmtIp || (s.ips || [])[0] || '', ips: [s.mgmtIp].concat(s.ips || [], s.extraIps || []).filter(Boolean) };
  }
  function identDevice(d) { return { type: 'equipement', nom: d.name || d.netName || '', mac: d.mac || '', macs: d.mac ? [d.mac] : [], ip: d.ip || '', ips: d.ip ? [d.ip] : [] }; }
  function correspond(ex, id) {
    if (ex.mac) return id.macs.includes(ex.mac);
    if (ex.ip) return id.ips.includes(ex.ip);
    return !!ex.nom && fold(ex.nom) === fold(id.nom);
  }
  function appliquerExclusions(state) {
    const ex = arr(state.exclusions);
    if (!ex.length) return state;
    const exMac = new Set(ex.filter(e => e.mac).map(e => e.mac)), exIp = new Set(ex.filter(e => !e.mac && e.ip).map(e => e.ip));
    const exNom = new Set(ex.filter(e => !e.mac && !e.ip && e.nom).map(e => fold(e.nom)));
    const nomsSw = new Set();
    const switches = arr(state.switches).filter(s => { const id = identSwitch(s); const x = ex.some(e => correspond(e, id)); if (x) { nomsSw.add(fold(s.name)); id.macs.forEach(m => exMac.add(m)); id.ips.forEach(i => exIp.add(i)); } return !x; })
      .map(s => Object.assign({}, s, {
        macTable: (s.macTable || []).filter(e => !exMac.has(e.mac)),
        arp: (s.arp || []).filter(a => !exMac.has(a.mac) && !exIp.has(a.ip)),
        neighbors: (s.neighbors || []).filter(n => !(n.chassis && exMac.has(n.chassis)) && !(n.ip && exIp.has(n.ip)) && !exNom.has(fold(n.name)) && !nomsSw.has(fold(String(n.name || '').split('.')[0])))
      }));
    const manualLinks = arr(state.manualLinks).filter(l => ![l.a, l.b].some(v => nomsSw.has(fold(v)) || exNom.has(fold(v))));
    return Object.assign({}, state, { switches, manualLinks, exclusionsAppliquees: ex.length });
  }

  root.CartoV2 = {
    identSwitch, identDevice, appliquerExclusions, splitPutty, normCmd, parsePipeTable, estPlanet, marqueLegere, parseLeger,
    mergeGenetecInventaire, mergeGenetecConfig, removeGenetecSource, importGenetecRows,
    readXlsx, portGenetec, genetecControles,
    splitReleve, releveFromEquipement, parseReleveV2, importDecouverte, computeAnomalies, health, switchState, statusOfSwitch, portStats, tierLayout, tierOf, NODE_SIZE,
    makeXlsx, zipStore, crc32, expandVlans, compactVlans, expandPorts, speedLabel, speedMbps, isLagName, isPhysical, lagOf, trunkOf, modeOf, parseVlans, parseCiscoTrunks,
    parseLags, parseStp, parsePoe, parseErrors, parseMacPositional, parsePortsPositional, parseNetgearPorts, parseLldpList, HEALTH_RULE, DEF_CFG, VENDOR_LABEL, VENDOR_FIAB, CLASS_TXT, arr
  };
})(typeof window !== 'undefined' ? window : globalThis);
