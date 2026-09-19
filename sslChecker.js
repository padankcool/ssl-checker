const tls = require('node:tls');
const net = require('node:net');
const url = require('node:url');

/**
 * Membersihkan input domain / URL menjadi hostname murni dan port
 * @param {string} input 
 * @returns {{ host: string, port: number, raw: string }}
 */
function parseTarget(input) {
  let raw = (input || '').trim();
  if (!raw) return null;

  let cleaned = raw;
  // Jika diawali dengan protokol, parse dengan URL
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    let host = parsed.hostname;
    let port = parsed.port ? parseInt(parsed.port, 10) : 443;
    
    // Hapus kurung siku jika ada (IPv6)
    host = host.replace(/^\[|\]$/g, '');
    
    return { host, port, raw };
  } catch {
    // Fallback regex sederhana
    let parts = raw.replace(/^https?:\/\//i, '').split('/')[0].split(':');
    let host = parts[0].trim();
    let port = parts[1] ? parseInt(parts[1], 10) : 443;
    return { host, port, raw };
  }
}

/**
 * Mengecek SSL dari satu target domain
 * @param {string} rawInput 
 * @param {number} timeoutMs 
 * @returns {Promise<object>}
 */
function inspectSSL(rawInput, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const target = parseTarget(rawInput);
    if (!target || !target.host) {
      return resolve({
        input: rawInput,
        domain: rawInput,
        port: 443,
        status: 'error',
        statusText: 'Format domain tidak valid',
        error: 'Invalid domain format',
        isSafeNextYear: false,
        needsUpdateThisYear: false,
        renewalStatus: 'Format Tidak Valid',
        badge: 'danger'
      });
    }

    const { host, port } = target;
    const now = new Date();

    const socketOptions = {
      host: host,
      port: port,
      servername: host, // SNI
      rejectUnauthorized: false, // Dapatkan sertifikat walaupun untrusted/expired
      timeout: timeoutMs,
    };

    let isResolved = false;
    const finish = (result) => {
      if (isResolved) return;
      isResolved = true;
      try {
        socket.destroy();
      } catch (_) {}
      resolve(result);
    };

    const socket = tls.connect(socketOptions, () => {
      try {
        const cert = socket.getPeerCertificate(true);
        const protocol = socket.getProtocol ? socket.getProtocol() : 'Unknown';
        const cipher = socket.getCipher ? socket.getCipher() : null;
        const isAuthorized = socket.authorized;
        const authError = socket.authorizationError || null;

        if (!cert || Object.keys(cert).length === 0) {
          return finish({
            input: rawInput,
            domain: host,
            port,
            status: 'error',
            statusText: 'Tidak ada sertifikat SSL ditemukan',
            error: 'No peer certificate returned',
            isSafeNextYear: false,
            needsUpdateThisYear: false,
            renewalStatus: 'Tidak Ada SSL',
            badge: 'danger'
          });
        }

        const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
        const validTo = cert.valid_to ? new Date(cert.valid_to) : null;

        let daysRemaining = null;
        let isExpiredNow = false;
        if (validTo) {
          const diffMs = validTo.getTime() - now.getTime();
          daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          isExpiredNow = diffMs < 0;
        }

        // Penilaian masa aktif: Tahun Ini vs Tahun Depan (Dinamis)
        const currentYear = now.getFullYear();
        const nextYear = currentYear + 1;
        const endOfCurrentYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59));

        let isSafeNextYear = false;
        let needsUpdateThisYear = false;
        let renewalStatus = '';
        let badge = 'warning'; // 'success' | 'warning' | 'danger' | 'neutral'

        if (isExpiredNow) {
          renewalStatus = `Sudah Kedaluwarsa (${Math.abs(daysRemaining)} hari lalu)`;
          badge = 'danger';
        } else if (validTo && validTo > endOfCurrentYear) {
          isSafeNextYear = true;
          const expYear = validTo.getFullYear();
          if (expYear === nextYear) {
            renewalStatus = `Aman s.d Tahun Depan (${validTo.toISOString().slice(0, 10)})`;
          } else {
            renewalStatus = `Sangat Aman s.d ${expYear} (${validTo.toISOString().slice(0, 10)})`;
          }
          badge = 'success';
        } else if (validTo) {
          needsUpdateThisYear = true;
          renewalStatus = `Perlu Diperbarui Tahun Ini (${validTo.toISOString().slice(0, 10)})`;
          badge = 'warning';
        } else {
          renewalStatus = 'Tanggal Tidak Diketahui';
          badge = 'neutral';
        }

        // Tentukan status umum sertifikat
        let certStatus = 'valid';
        let certStatusText = 'Valid & Aktif';
        if (isExpiredNow) {
          certStatus = 'expired';
          certStatusText = 'Kedaluwarsa';
        } else if (!isAuthorized) {
          certStatus = 'warning';
          certStatusText = authError ? `Peringatan: ${authError}` : 'Sertifikat Tidak Terpercaya (Untrusted)';
        }

        // Parsing SAN (Subject Alternative Name)
        let sanList = [];
        if (cert.subjectaltname) {
          sanList = cert.subjectaltname
            .split(',')
            .map(s => s.trim().replace(/^DNS:/i, ''))
            .filter(Boolean);
        }

        // Issuer & Subject parsing
        const issuerName = cert.issuer ? (cert.issuer.O || cert.issuer.CN || 'Unknown') : 'Unknown';
        const issuerCN = cert.issuer ? (cert.issuer.CN || '') : '';
        const subjectCN = cert.subject ? (cert.subject.CN || host) : host;
        const subjectOrg = cert.subject ? (cert.subject.O || '') : '';

        return finish({
          input: rawInput,
          domain: host,
          port,
          status: certStatus,
          statusText: certStatusText,
          isAuthorized,
          authError,
          // Tanggal & Durasi
          validFrom: validFrom ? validFrom.toISOString() : null,
          validTo: validTo ? validTo.toISOString() : null,
          validFromFormatted: validFrom ? formatDate(validFrom) : '-',
          validToFormatted: validTo ? formatDate(validTo) : '-',
          daysRemaining: daysRemaining,
          // Status Pembaruan (Tahun ini vs Tahun Depan)
          isSafeNextYear,
          needsUpdateThisYear,
          renewalStatus,
          badge,
          // Organisasi & Entitas
          issuer: issuerName,
          issuerCN,
          subjectCN,
          subjectOrg,
          san: sanList,
          sanCount: sanList.length,
          // Data Teknis
          protocol,
          cipher: cipher ? `${cipher.name} (${cipher.version})` : 'Unknown',
          serialNumber: cert.serialNumber || '-',
          fingerprint256: cert.fingerprint256 || cert.fingerprint || '-',
          bits: cert.bits || null,
          error: null
        });
      } catch (err) {
        return finish({
          input: rawInput,
          domain: host,
          port,
          status: 'error',
          statusText: 'Gagal membaca sertifikat',
          error: err.message,
          isSafeNextYear: false,
          needsUpdateThisYear: false,
          renewalStatus: 'Gagal Membaca SSL',
          badge: 'danger'
        });
      }
    });

    socket.on('timeout', () => {
      finish({
        input: rawInput,
        domain: host,
        port,
        status: 'error',
        statusText: 'Koneksi Timeout (Waktu Habis)',
        error: `Connection timed out after ${timeoutMs / 1000}s`,
        isSafeNextYear: false,
        needsUpdateThisYear: false,
        renewalStatus: 'Koneksi Timeout',
        badge: 'danger'
      });
    });

    socket.on('error', (err) => {
      let friendlyMessage = err.message;
      if (err.code === 'ENOTFOUND') friendlyMessage = 'Domain tidak ditemukan (DNS error)';
      else if (err.code === 'ECONNREFUSED') friendlyMessage = 'Koneksi ditolak (Port 443 tidak aktif)';
      else if (err.code === 'ETIMEDOUT') friendlyMessage = 'Koneksi timed out';
      else if (err.code === 'ECONNRESET') friendlyMessage = 'Koneksi di-reset oleh server';

      finish({
        input: rawInput,
        domain: host,
        port,
        status: 'error',
        statusText: friendlyMessage,
        error: `${err.code || 'ERROR'}: ${err.message}`,
        isSafeNextYear: false,
        needsUpdateThisYear: false,
        renewalStatus: 'Koneksi Gagal',
        badge: 'danger'
      });
    });
  });
}

function formatDate(d) {
  if (!d) return '-';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Menjalankan inspeksi batch dengan batas konkurensi (misal max 10 proses simultan)
 * @param {string[]} domainList 
 * @param {number} concurrency 
 * @param {Function} [onProgress]
 * @returns {Promise<object[]>}
 */
async function inspectBatch(domainList, concurrency = 8, onProgress = null) {
  const results = [];
  const queue = [...domainList];
  let completed = 0;
  const total = domainList.length;

  async function worker() {
    while (queue.length > 0) {
      const target = queue.shift();
      const res = await inspectSSL(target);
      results.push(res);
      completed++;
      if (onProgress) {
        onProgress({ completed, total, currentResult: res });
      }
    }
  }

  const workers = [];
  const workerCount = Math.min(concurrency, total);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

module.exports = {
  inspectSSL,
  inspectBatch,
  parseTarget
};
