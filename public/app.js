// State Aplikasi
let currentResults = [];
let filteredResults = [];
let activeFilter = 'all';

// DOM Elements
const domainInput = document.getElementById('domainInput');
const domainCountLabel = document.getElementById('domainCountLabel');
const fileUpload = document.getElementById('fileUpload');
const btnSample = document.getElementById('btnSample');
const btnClear = document.getElementById('btnClear');
const btnCheckSSL = document.getElementById('btnCheckSSL');
const btnCheckText = document.getElementById('btnCheckText');
const btnSpinner = document.getElementById('btnSpinner');
const btnIconCheck = document.getElementById('btnIconCheck');
const progressWrap = document.getElementById('progressWrap');

const metricsGrid = document.getElementById('metricsGrid');
const statTotal = document.getElementById('statTotal');
const statSafeNextYear = document.getElementById('statSafeNextYear');
const statUpdateThisYear = document.getElementById('statUpdateThisYear');
const statExpired = document.getElementById('statExpired');

const resultsSection = document.getElementById('resultsSection');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const tableBody = document.getElementById('tableBody');
const showingCountText = document.getElementById('showingCountText');

const countAll = document.getElementById('countAll');
const countSafe = document.getElementById('countSafe');
const countUpdate = document.getElementById('countUpdate');
const countError = document.getElementById('countError');

const btnExportExcel = document.getElementById('btnExportExcel');
const btnExportCSV = document.getElementById('btnExportCSV');

// Modal Elements
const detailModal = document.getElementById('detailModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCloseBtn2 = document.getElementById('modalCloseBtn2');
const modalDomain = document.getElementById('modalDomain');
const modalStatusText = document.getElementById('modalStatusText');
const modalBody = document.getElementById('modalBody');

// Contoh list domain untuk quick testing
const SAMPLE_DOMAINS = [
  'google.com',
  'https://github.com',
  'cloudflare.com',
  'wikipedia.org',
  'microsoft.com',
  'bca.co.id',
  'tokopedia.com',
  'expired.badssl.com',
  'self-signed.badssl.com'
];

// Helper: parse string input menjadi array domain
function getDomainList() {
  const text = domainInput.value || '';
  return text
    .split(/[\r\n,]+/)
    .map(d => d.trim())
    .filter(d => d.length > 0);
}

// Update count label saat user mengetik
domainInput.addEventListener('input', () => {
  const count = getDomainList().length;
  domainCountLabel.textContent = `${count} domain terdeteksi`;
});

// Tombol Muat Contoh Domain
btnSample.addEventListener('click', () => {
  domainInput.value = SAMPLE_DOMAINS.join('\n');
  domainCountLabel.textContent = `${SAMPLE_DOMAINS.length} domain terdeteksi`;
});

// Tombol Bersihkan
btnClear.addEventListener('click', () => {
  domainInput.value = '';
  domainCountLabel.textContent = '0 domain terdeteksi';
  domainInput.focus();
});

// Upload File .TXT / .CSV
fileUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target.result;
    const lines = content
      .split(/[\r\n,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    domainInput.value = lines.join('\n');
    domainCountLabel.textContent = `${lines.length} domain terdeteksi dari file (${file.name})`;
  };
  reader.readAsText(file);
});

// Jalankan Audit SSL
btnCheckSSL.addEventListener('click', async () => {
  const domains = getDomainList();
  if (domains.length === 0) {
    alert('Harap masukkan setidaknya satu domain untuk diperiksa.');
    domainInput.focus();
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/check-ssl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP Error ${response.status}`);
    }

    const res = await response.json();
    currentResults = res.data || [];

    // Render Metrics
    renderMetrics(res.stats);

    // Render Table
    applyFilterAndSearch();

    // Show sections
    metricsGrid.style.display = 'grid';
    resultsSection.style.display = 'block';

    // Scroll ke bagian hasil
    metricsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    alert(`Terjadi kesalahan saat memeriksa SSL: ${err.message}`);
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  btnCheckSSL.disabled = isLoading;
  if (isLoading) {
    btnSpinner.style.display = 'inline-block';
    btnIconCheck.style.display = 'none';
    btnCheckText.textContent = 'Sedang Memeriksa SSL...';
    progressWrap.style.display = 'block';
  } else {
    btnSpinner.style.display = 'none';
    btnIconCheck.style.display = 'inline-block';
    btnCheckText.textContent = 'Audit SSL Sekarang';
    progressWrap.style.display = 'none';
  }
}

// Render Dashboard Metrics
function renderMetrics(stats) {
  if (!stats) return;
  statTotal.textContent = stats.total || 0;
  statSafeNextYear.textContent = stats.safeNextYear || 0;
  statUpdateThisYear.textContent = stats.updateThisYear || 0;
  statExpired.textContent = (stats.expired || 0) + (stats.error || 0);

  countAll.textContent = stats.total || 0;
  countSafe.textContent = stats.safeNextYear || 0;
  countUpdate.textContent = stats.updateThisYear || 0;
  countError.textContent = (stats.expired || 0) + (stats.error || 0);
}

// Filter Buttons
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    applyFilterAndSearch();
  });
});

// Search Input Real-time
searchInput.addEventListener('input', () => {
  applyFilterAndSearch();
});

// Filter & Search Logic
function applyFilterAndSearch() {
  const query = (searchInput.value || '').trim().toLowerCase();

  filteredResults = currentResults.filter(item => {
    // Check Filter Category (safe = aman s.d tahun depan+, update = perlu tahun ini, expired = sudah lewat / error)
    let matchesCategory = true;
    const badgeType = item.badge || item.badge2027;

    if (activeFilter === 'safe') {
      matchesCategory = badgeType === 'success';
    } else if (activeFilter === 'update') {
      matchesCategory = badgeType === 'warning';
    } else if (activeFilter === 'expired') {
      matchesCategory = badgeType === 'danger' || item.status === 'expired' || item.status === 'error';
    }

    // Check Search Query
    let matchesQuery = true;
    if (query) {
      const d = (item.domain || '').toLowerCase();
      const iss = (item.issuer || '').toLowerCase();
      const renewal = (item.renewalStatus || item.status2027 || '').toLowerCase();
      matchesQuery = d.includes(query) || iss.includes(query) || renewal.includes(query);
    }

    return matchesCategory && matchesQuery;
  });

  renderTable(filteredResults);
}

// Render Table Rows
function renderTable(data) {
  tableBody.innerHTML = '';
  showingCountText.textContent = `Menampilkan ${data.length} dari ${currentResults.length} domain`;

  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          Tidak ada domain yang cocok dengan filter atau pencarian Anda.
        </td>
      </tr>
    `;
    return;
  }

  data.forEach((item, index) => {
    const tr = document.createElement('tr');

    // Badge Renewal Status
    const badgeType = item.badge || item.badge2027;
    let badgeClass = 'badge-2027-warning';
    let badgeIcon = '⚠️';
    if (badgeType === 'success') {
      badgeClass = 'badge-2027-success';
      badgeIcon = '✅';
    } else if (badgeType === 'danger') {
      badgeClass = 'badge-2027-danger';
      badgeIcon = '❌';
    }

    // Days pill styling
    let daysHtml = '-';
    if (item.daysRemaining !== null) {
      if (item.daysRemaining < 0) {
        daysHtml = `<span class="days-pill bad">${item.daysRemaining} hari</span>`;
      } else if (item.daysRemaining <= 30) {
        daysHtml = `<span class="days-pill warn">${item.daysRemaining} hari</span>`;
      } else {
        daysHtml = `<span class="days-pill good">${item.daysRemaining} hari</span>`;
      }
    }

    const statusDisplay = item.renewalStatus || item.status2027 || '-';

    tr.innerHTML = `
      <td style="text-align: center; color: var(--text-sub);">${index + 1}</td>
      <td>
        <span class="domain-cell">${escapeHtml(item.domain)}</span>
        <span class="domain-port">:${item.port}</span>
      </td>
      <td>
        <span class="badge ${badgeClass}">
          ${badgeIcon} ${escapeHtml(statusDisplay)}
        </span>
      </td>
      <td>
        <span class="badge-status ${item.status}">
          ${escapeHtml(item.statusText)}
        </span>
      </td>
      <td style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px;">
        ${item.validToFormatted || '-'}
      </td>
      <td>${daysHtml}</td>
      <td style="color: var(--text-muted); font-size: 12.5px;">
        ${escapeHtml(item.issuer || '-')}
      </td>
      <td style="text-align: right;">
        <button class="btn btn-secondary btn-sm" onclick="openDetailModal(${currentResults.indexOf(item)})">
          Detail
        </button>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

// Modal Detail
window.openDetailModal = function(index) {
  const item = currentResults[index];
  if (!item) return;

  const renewalDisplay = item.renewalStatus || item.status2027 || '-';
  const badgeType = item.badge || item.badge2027;

  modalDomain.textContent = item.domain;
  modalStatusText.textContent = `${item.statusText} • ${renewalDisplay}`;

  let sanListHtml = '<span style="color: var(--text-muted); font-size: 12px;">Tidak ada SAN khusus</span>';
  if (Array.isArray(item.san) && item.san.length > 0) {
    sanListHtml = `
      <div class="san-tags-wrap">
        ${item.san.map(san => `<span class="san-tag">${escapeHtml(san)}</span>`).join('')}
      </div>
    `;
  }

  modalBody.innerHTML = `
    <div class="detail-section-title">Status Masa Aktif & Pembaruan</div>
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-label">Status Pembaruan</div>
        <div class="detail-val" style="color: ${badgeType === 'success' ? '#34d399' : badgeType === 'warning' ? '#fbbf24' : '#fb7185'}">
          ${escapeHtml(renewalDisplay)}
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Status Sertifikat</div>
        <div class="detail-val">${escapeHtml(item.statusText)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Tanggal Mulai (Valid From)</div>
        <div class="detail-val mono">${item.validFromFormatted || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Tanggal Kedaluwarsa (Valid To)</div>
        <div class="detail-val mono">${item.validToFormatted || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Sisa Waktu Aktif</div>
        <div class="detail-val mono">${item.daysRemaining !== null ? `${item.daysRemaining} Hari` : '-'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Verifikasi Otoritas (Authorized)</div>
        <div class="detail-val">${item.isAuthorized ? 'Terverifikasi (Trusted CA)' : (item.authError || 'Tidak Valid / Untrusted')}</div>
      </div>
    </div>

    <div class="detail-section-title">Informasi Penerbit & Subjek</div>
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-label">Penerbit Sertifikat (Issuer Org)</div>
        <div class="detail-val">${escapeHtml(item.issuer || '-')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Issuer Common Name (CN)</div>
        <div class="detail-val mono">${escapeHtml(item.issuerCN || '-')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Common Name Subjek (CN)</div>
        <div class="detail-val mono">${escapeHtml(item.subjectCN || '-')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Organisasi Pemilik</div>
        <div class="detail-val">${escapeHtml(item.subjectOrg || '-')}</div>
      </div>
      <div class="detail-item full-width">
        <div class="detail-label">Subject Alternative Names (SAN) - Total ${item.san ? item.san.length : 0} Nama</div>
        ${sanListHtml}
      </div>
    </div>

    <div class="detail-section-title">Parameter Teknis & Kriptografi</div>
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-label">Protokol SSL/TLS</div>
        <div class="detail-val mono">${escapeHtml(item.protocol || '-')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Cipher Suite</div>
        <div class="detail-val mono">${escapeHtml(item.cipher || '-')}</div>
      </div>
      <div class="detail-item full-width">
        <div class="detail-label">Serial Number</div>
        <div class="detail-val mono">${escapeHtml(item.serialNumber || '-')}</div>
      </div>
      <div class="detail-item full-width">
        <div class="detail-label">Fingerprint SHA-256</div>
        <div class="detail-val mono" style="font-size: 11px;">${escapeHtml(item.fingerprint256 || '-')}</div>
      </div>
      ${item.error ? `
        <div class="detail-item full-width" style="border-color: rgba(244, 63, 94, 0.4); background: rgba(244, 63, 94, 0.05);">
          <div class="detail-label" style="color: #fb7185;">Pesan Error / Diagnostik</div>
          <div class="detail-val" style="color: #fb7185; font-size: 12px;">${escapeHtml(item.error)}</div>
        </div>
      ` : ''}
    </div>
  `;

  detailModal.style.display = 'flex';
};

// Close Modal
function closeModal() {
  detailModal.style.display = 'none';
}
modalCloseBtn.addEventListener('click', closeModal);
modalCloseBtn2.addEventListener('click', closeModal);
detailModal.addEventListener('click', (e) => {
  if (e.target === detailModal) closeModal();
});

// Export Excel (.xlsx) melalui server
btnExportExcel.addEventListener('click', async () => {
  if (currentResults.length === 0) {
    alert('Belum ada data untuk diekspor ke Excel. Lakukan pengecekan terlebih dahulu.');
    return;
  }

  const origHtml = btnExportExcel.innerHTML;
  btnExportExcel.disabled = true;
  btnExportExcel.innerHTML = `<span>Menyiapkan Excel...</span>`;

  try {
    const res = await fetch('/api/export-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: currentResults })
    });

    if (!res.ok) {
      throw new Error(`Gagal mengunduh file Excel: ${res.statusText}`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Ambil filename dari header jika ada atau generate
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    a.download = `Laporan_Audit_SSL_${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (err) {
    console.error(err);
    alert('Gagal mendownload file Excel: ' + err.message);
  } finally {
    btnExportExcel.disabled = false;
    btnExportExcel.innerHTML = origHtml;
  }
});

// Export CSV (Spreadsheet)
btnExportCSV.addEventListener('click', () => {
  if (currentResults.length === 0) {
    alert('Belum ada data untuk diekspor. Lakukan pengecekan terlebih dahulu.');
    return;
  }

  const headers = [
    'No',
    'Domain',
    'Status_Sertifikat',
    'Status_Target_2027',
    'Tanggal_Kedaluwarsa',
    'Sisa_Hari',
    'Tanggal_Mulai',
    'Penerbit_Issuer',
    'Subject_CN',
    'SAN_List',
    'Protokol_TLS',
    'Cipher',
    'Serial_Number',
    'Catatan_Error'
  ];

  const rows = currentResults.map((item, index) => [
    index + 1,
    `"${(item.domain || '').replace(/"/g, '""')}"`,
    `"${(item.statusText || '').replace(/"/g, '""')}"`,
    `"${(item.status2027 || '').replace(/"/g, '""')}"`,
    `"${item.validToFormatted || '-'}"`,
    item.daysRemaining !== null ? item.daysRemaining : '-',
    `"${item.validFromFormatted || '-'}"`,
    `"${(item.issuer || '').replace(/"/g, '""')}"`,
    `"${(item.subjectCN || '').replace(/"/g, '""')}"`,
    `"${(Array.isArray(item.san) ? item.san.slice(0, 5).join('; ') : '').replace(/"/g, '""')}"`,
    `"${(item.protocol || '').replace(/"/g, '""')}"`,
    `"${(item.cipher || '').replace(/"/g, '""')}"`,
    `"${(item.serialNumber || '').replace(/"/g, '""')}"`,
    `"${(item.error || 'Normal').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  a.href = url;
  a.download = `Laporan_Audit_SSL_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
