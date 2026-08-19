'use strict';

/**
 * Module — Fingerprinting de service (banner grabbing)
 *
 * Sur chaque port ouvert détecté, lit les premiers octets renvoyés par le
 * service. Pour les protocoles qui n'émettent rien spontanément (HTTP),
 * envoie un stimulus minimal (requête HEAD/GET) afin d'obtenir une bannière.
 *
 * Extrait ensuite une version depuis les bannières connues (SSH, FTP, SMTP,
 * HTTP...) à l'aide d'expressions régulières, pour alimenter le matching CVE.
 */

const net = require('net');

/**
 * Ports pour lesquels on envoie un stimulus applicatif afin de provoquer une
 * réponse (sinon le service reste muet).
 */
const HTTP_PORTS = new Set([80, 81, 591, 2080, 8000, 8008, 8080, 8081, 8888, 3000, 5000]);

function buildProbe(port) {
  if (HTTP_PORTS.has(port)) {
    return 'HEAD / HTTP/1.0\r\nHost: scan\r\nUser-Agent: SecAudit-Active/1.0\r\nConnection: close\r\n\r\n';
  }
  return null; // services « bavards » (SSH/FTP/SMTP) : on écoute seulement
}

/**
 * Récupère la bannière brute d'un service.
 * @returns {Promise<string|null>}
 */
function grab(host, port, timeout) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let data = Buffer.alloc(0);
    let settled = false;

    const done = () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(data.length ? data.toString('utf8', 0, Math.min(data.length, 2048)) : null);
    };

    socket.setTimeout(timeout);
    socket.once('connect', () => {
      const probe = buildProbe(port);
      if (probe) socket.write(probe);
    });
    socket.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
      if (data.length >= 2048) done();
    });
    socket.once('timeout', done);
    socket.once('error', done);
    socket.once('close', done);
    socket.once('end', done);

    try {
      socket.connect(port, host);
    } catch (err) {
      done();
    }
  });
}

/**
 * Signatures d'extraction de service + version.
 * Chaque regex capture le produit (groupe 1) et/ou la version (groupe 2).
 */
const SERVICE_SIGNATURES = [
  {
    name: 'OpenSSH',
    cpe: 'cpe:2.3:a:openbsd:openssh',
    re: /SSH-\d+\.\d+-OpenSSH[_-]([\d.p]+)/i,
    versionGroup: 1,
  },
  {
    name: 'SSH (générique)',
    re: /SSH-(\d+\.\d+)-([^\r\n]+)/i,
    versionGroup: null,
  },
  {
    name: 'vsftpd',
    cpe: 'cpe:2.3:a:vsftpd:vsftpd',
    re: /vsFTPd\s+([\d.]+)/i,
    versionGroup: 1,
  },
  {
    name: 'ProFTPD',
    cpe: 'cpe:2.3:a:proftpd:proftpd',
    re: /ProFTPD\s+([\d.]+)/i,
    versionGroup: 1,
  },
  {
    name: 'Pure-FTPd',
    re: /Pure-FTPd/i,
    versionGroup: null,
  },
  {
    name: 'Apache httpd',
    cpe: 'cpe:2.3:a:apache:http_server',
    re: /Server:\s*Apache\/([\d.]+)/i,
    versionGroup: 1,
  },
  {
    name: 'nginx',
    cpe: 'cpe:2.3:a:nginx:nginx',
    re: /Server:\s*nginx\/([\d.]+)/i,
    versionGroup: 1,
  },
  {
    name: 'Microsoft IIS',
    cpe: 'cpe:2.3:a:microsoft:internet_information_services',
    re: /Server:\s*Microsoft-IIS\/([\d.]+)/i,
    versionGroup: 1,
  },
  {
    name: 'Postfix SMTP',
    re: /220[^\r\n]*Postfix/i,
    versionGroup: null,
  },
  {
    name: 'Exim SMTP',
    cpe: 'cpe:2.3:a:exim:exim',
    re: /220[^\r\n]*Exim\s+([\d.]+)/i,
    versionGroup: 1,
  },
  {
    name: 'MySQL',
    cpe: 'cpe:2.3:a:mysql:mysql',
    re: /([\d]+\.[\d]+\.[\d]+)[-\w]*(?:MariaDB|mysql)?/i,
    versionGroup: 1,
    onlyPorts: [3306],
  },
];

/**
 * Analyse une bannière et en extrait service + version.
 */
function fingerprint(banner, port) {
  if (!banner) return { service: null, version: null, cpe: null, raw: null };

  for (const sig of SERVICE_SIGNATURES) {
    if (sig.onlyPorts && !sig.onlyPorts.includes(port)) continue;
    const m = sig.re.exec(banner);
    if (m) {
      return {
        service: sig.name,
        version: sig.versionGroup ? m[sig.versionGroup] || null : null,
        cpe: sig.cpe || null,
        raw: banner.split(/\r?\n/)[0].slice(0, 200),
      };
    }
  }

  return {
    service: null,
    version: null,
    cpe: null,
    raw: banner.split(/\r?\n/)[0].slice(0, 200),
  };
}

/**
 * Récupère et analyse les bannières pour une liste de ports ouverts.
 * @returns {Promise<object[]>}
 */
async function grabAll(host, openPorts, options = {}) {
  const timeout = options.timeout || 3000;
  const out = [];
  for (const port of openPorts) {
    const banner = await grab(host, port, timeout);
    const fp = fingerprint(banner, port);
    out.push({ port, ...fp });
  }
  return out;
}

module.exports = { grab, grabAll, fingerprint, SERVICE_SIGNATURES };
