// State Aplikasi
let currentResults = [];
let filteredResults = [];
let activeFilter = 'all';
let lastCheckedAt = null; // timestamp saat pengecekan terakhir

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
const btnExportWord = document.getElementById('btnExportWord');
const btnBulkScreenshot = document.getElementById('btnBulkScreenshot');
const btnExportCSV = document.getElementById('btnExportCSV');
const btnDownloadJPG = document.getElementById('btnDownloadJPG');

// Bulk Progress Modal Elements
const bulkProgressModal = document.getElementById('bulkProgressModal');
const bulkProgressTitle = document.getElementById('bulkProgressTitle');
const bulkProgressDesc = document.getElementById('bulkProgressDesc');
const bulkProgressBarInner = document.getElementById('bulkProgressBarInner');
const bulkProgressDomain = document.getElementById('bulkProgressDomain');
const bulkProgressCount = document.getElementById('bulkProgressCount');

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
    lastCheckedAt = new Date(); // simpan waktu pengecekan

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

// Helper: Render data detail domain ke dalam modal
function populateModalContent(item) {
  const renewalDisplay = item.renewalStatus || item.status2027 || '-';
  const badgeType = item.badge || item.badge2027;

  // Format waktu pengecekan
  let checkedAtHtml = '';
  if (lastCheckedAt) {
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = lastCheckedAt.toLocaleDateString('id-ID', opts);
    const timeStr = lastCheckedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    checkedAtHtml = `<div class="checked-at-badge">🕐 Dicek pada: <strong>${dateStr}, ${timeStr} WIB</strong></div>`;
  }

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
    ${checkedAtHtml}
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
}

// Modal Detail
window.openDetailModal = function(index) {
  const item = currentResults[index];
  if (!item) return;

  populateModalContent(item);
  detailModal.style.display = 'flex';
  detailModal.dataset.activeIndex = index;
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

// Download Modal sebagai JPG
btnDownloadJPG.addEventListener('click', async () => {
  const index = parseInt(detailModal.dataset.activeIndex, 10);
  const item = currentResults[index];
  if (!item) return;

  const origHtml = btnDownloadJPG.innerHTML;
  btnDownloadJPG.disabled = true;
  btnDownloadJPG.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite"></span> Mengambil gambar...';

  try {
    const modalContainer = document.querySelector('.modal-container');
    const canvas = await html2canvas(modalContainer, {
      backgroundColor: '#0f172a',
      scale: 2,
      useCORS: true,
      logging: false,
      ignoreElements: (element) => {
        return element.classList && (element.classList.contains('modal-footer') || element.classList.contains('modal-close-btn'));
      }
    });

    const link = document.createElement('a');
    const safeDomain = (item.domain || 'ssl').replace(/[^a-z0-9.-]/gi, '_');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    link.download = `SSL_Detail_${safeDomain}_${dateStr}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  } catch (err) {
    console.error('Gagal mengambil screenshot:', err);
    alert('Gagal membuat gambar: ' + err.message);
  } finally {
    btnDownloadJPG.disabled = false;
    btnDownloadJPG.innerHTML = origHtml;
  }
});

// Download Bulk Screenshot Detail (Semua Domain yang tampil sekaligus ke file .ZIP)
btnBulkScreenshot.addEventListener('click', async () => {
  const itemsToCapture = (filteredResults && filteredResults.length > 0) ? filteredResults : currentResults;
  if (!itemsToCapture || itemsToCapture.length === 0) {
    alert('Belum ada data untuk diunduh. Lakukan audit SSL terlebih dahulu.');
    return;
  }

  if (typeof JSZip === 'undefined') {
    alert('Library JSZip belum siap. Silakan refresh halaman.');
    return;
  }

  const origBtnHtml = btnBulkScreenshot.innerHTML;
  btnBulkScreenshot.disabled = true;
  btnBulkScreenshot.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite"></span> Memproses...';

  // Reset modal title & description for Bulk Screenshot
  if (bulkProgressTitle) bulkProgressTitle.textContent = 'Bulk Screenshot JPG';
  if (bulkProgressDesc) bulkProgressDesc.textContent = 'Mengambil screenshot detail setiap domain dan menyimpannya ke dalam file ZIP...';

  // Simpan status modal sebelum bulk capture
  const wasModalOpen = detailModal.style.display === 'flex';
  const prevActiveIndex = detailModal.dataset.activeIndex;

  // Tampilkan modal progress
  bulkProgressModal.style.display = 'flex';
  bulkProgressBarInner.style.width = '0%';
  bulkProgressCount.textContent = `0 / ${itemsToCapture.length}`;
  bulkProgressDomain.textContent = 'Menyiapkan...';

  // Pastikan detailModal aktif untuk proses capture html2canvas
  detailModal.style.display = 'flex';
  const modalContainer = detailModal.querySelector('.modal-container');

  const zip = new JSZip();
  const total = itemsToCapture.length;

  try {
    for (let i = 0; i < total; i++) {
      const item = itemsToCapture[i];
      const domainName = item.domain || `domain-${i+1}`;
      
      // Update info progress
      const percent = Math.round(((i + 1) / total) * 100);
      bulkProgressBarInner.style.width = `${percent}%`;
      bulkProgressCount.textContent = `${i + 1} / ${total}`;
      bulkProgressDomain.textContent = domainName;

      // Render isi modal untuk domain ini
      populateModalContent(item);

      // Delay sangat singkat untuk memastikan render selesai
      await new Promise(resolve => setTimeout(resolve, 60));

      // Capture screenshot modal
      const canvas = await html2canvas(modalContainer, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false,
        ignoreElements: (element) => {
          return element.classList && (element.classList.contains('modal-footer') || element.classList.contains('modal-close-btn'));
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92).replace(/^data:image\/jpeg;base64,/, '');
      const safeDomain = domainName.replace(/[^a-z0-9.-]/gi, '_');
      const filename = `${String(i + 1).padStart(2, '0')}_${safeDomain}.jpg`;
      zip.file(filename, imgData, { base64: true });
    }

    bulkProgressDomain.textContent = 'Mengompres file ZIP...';
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Download ZIP
    const link = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    link.download = `Bulk_SSL_Detail_Screenshots_${dateStr}.zip`;
    link.href = URL.createObjectURL(zipBlob);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error('Gagal membuat bulk screenshot:', err);
    alert('Terjadi kesalahan saat membuat bulk screenshot: ' + err.message);
  } finally {
    bulkProgressModal.style.display = 'none';
    btnBulkScreenshot.disabled = false;
    btnBulkScreenshot.innerHTML = origBtnHtml;

    // Kembalikan status modal semula
    if (wasModalOpen && prevActiveIndex !== undefined && currentResults[parseInt(prevActiveIndex, 10)]) {
      populateModalContent(currentResults[parseInt(prevActiveIndex, 10)]);
      detailModal.style.display = 'flex';
      detailModal.dataset.activeIndex = prevActiveIndex;
    } else {
      detailModal.style.display = 'none';
    }
  }
});

// Download Laporan Microsoft Word (.docx) 1 Halaman 1 Gambar per Domain
btnExportWord.addEventListener('click', async () => {
  const itemsToExport = (filteredResults && filteredResults.length > 0) ? filteredResults : currentResults;
  if (!itemsToExport || itemsToExport.length === 0) {
    alert('Belum ada data untuk diekspor ke Word. Lakukan audit SSL terlebih dahulu.');
    return;
  }

  if (typeof JSZip === 'undefined') {
    alert('Library pembuat dokumen belum siap. Silakan refresh halaman.');
    return;
  }

  const origBtnHtml = btnExportWord.innerHTML;
  btnExportWord.disabled = true;
  btnExportWord.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite"></span> Memproses Word...';

  // Simpan status modal sebelum capture
  const wasModalOpen = detailModal.style.display === 'flex';
  const prevActiveIndex = detailModal.dataset.activeIndex;

  // Format tanggal & waktu pengecekan
  const checkDateObj = lastCheckedAt || new Date();
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const formattedCheckDate = `${checkDateObj.getDate()} ${months[checkDateObj.getMonth()]} ${checkDateObj.getFullYear()}, ${String(checkDateObj.getHours()).padStart(2, '0')}:${String(checkDateObj.getMinutes()).padStart(2, '0')}:${String(checkDateObj.getSeconds()).padStart(2, '0')} WIB`;

  // Tampilkan progress modal
  if (bulkProgressTitle) bulkProgressTitle.textContent = 'Download Laporan Word (.docx)';
  if (bulkProgressDesc) bulkProgressDesc.textContent = 'Membuat 1 halaman per domain lengkap dengan detail data dan gambar screenshot...';
  bulkProgressModal.style.display = 'flex';
  bulkProgressBarInner.style.width = '0%';
  bulkProgressCount.textContent = `0 / ${itemsToExport.length}`;
  bulkProgressDomain.textContent = 'Menyiapkan dokumen Word...';

  detailModal.style.display = 'flex';
  const modalContainer = detailModal.querySelector('.modal-container');

  const zip = new JSZip();
  const total = itemsToExport.length;

  // Helper escape karakter XML OpenXML
  function xmlEscape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Helper baris tabel Word OpenXML
  function makeWordTableRow(label, val) {
    return `
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2600" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="18"/><w:color w:val="334155"/></w:rPr>
              <w:t>${xmlEscape(label)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="7038" w:type="dxa"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="0F172A"/></w:rPr>
              <w:t>${xmlEscape(val)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    `;
  }

  let docRelsXml = '';
  let docBodyXml = '';

  try {
    for (let i = 0; i < total; i++) {
      const item = itemsToExport[i];
      const domainName = item.domain || `domain-${i+1}`;
      
      // Update info progress
      const percent = Math.round(((i + 1) / total) * 100);
      bulkProgressBarInner.style.width = `${percent}%`;
      bulkProgressCount.textContent = `${i + 1} / ${total}`;
      bulkProgressDomain.textContent = `Memproses: ${domainName}`;

      // Render isi modal untuk domain ini
      populateModalContent(item);

      // Delay sangat singkat untuk memastikan render selesai
      await new Promise(resolve => setTimeout(resolve, 60));

      // Capture screenshot modal
      const canvas = await html2canvas(modalContainer, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false,
        ignoreElements: (element) => {
          return element.classList && (element.classList.contains('modal-footer') || element.classList.contains('modal-close-btn'));
        }
      });

      const imgBase64 = canvas.toDataURL('image/jpeg', 0.90).replace(/^data:image\/jpeg;base64,/, '');
      const imgFileName = `image${i + 1}.jpeg`;
      zip.file(`word/media/${imgFileName}`, imgBase64, { base64: true });

      // Relationship XML untuk gambar ini
      docRelsXml += `
        <Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgFileName}"/>
      `;

      // Hitung dimensi gambar dalam EMUs agar pas dalam 1 halaman A4
      const maxW = 5400000; // ~15 cm
      const maxH = 5000000; // ~13.9 cm
      let cx = maxW;
      let cy = Math.round(cx * (canvas.height / canvas.width));
      if (cy > maxH) {
        cy = maxH;
        cx = Math.round(cy * (canvas.width / canvas.height));
      }

      // Tentukan status audit 2027
      const auditStatusText = item.status2027 || (item.badge === 'success' ? 'Aman s.d Tahun Depan' : (item.badge === 'warning' ? 'Perlu Update Tahun Ini' : 'Expired / Error'));

      // Susun 1 halaman untuk domain ini
      docBodyXml += `
        <!-- Judul Halaman Domain -->
        <w:p>
          <w:pPr>
            <w:jc w:val="left"/>
            <w:spacing w:before="100" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:sz w:val="28"/>
              <w:color w:val="1E40AF"/>
            </w:rPr>
            <w:t>${i + 1}. ${xmlEscape(domainName)}</w:t>
          </w:r>
        </w:p>

        <!-- Tabel Detail & Tanggal Dicek -->
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="9638" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
              <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            </w:tblBorders>
          </w:tblPr>
          ${makeWordTableRow('Domain / Host', domainName)}
          ${makeWordTableRow('Tanggal & Waktu Dicek', formattedCheckDate)}
          ${makeWordTableRow('Status Pembaruan (Audit)', auditStatusText)}
          ${makeWordTableRow('Status Sertifikat SSL', item.statusText || '-')}
          ${makeWordTableRow('Masa Berlaku', `${item.validFromFormatted || '-'} s.d ${item.validToFormatted || '-'} (${item.daysRemaining !== null ? item.daysRemaining + ' Hari Sisa' : '-'})`)}
          ${makeWordTableRow('Penerbit (Issuer)', item.issuer || '-')}
          ${makeWordTableRow('Common Name Subjek (CN)', item.subjectCN || '-')}
          ${makeWordTableRow('Protokol & Cipher', `${item.protocol || '-'} (${item.cipher || '-'})`)}
          ${item.error ? makeWordTableRow('Catatan Error / Diagnostik', item.error) : ''}
        </w:tbl>

        <!-- Judul Gambar Screenshot -->
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:before="160" w:after="100"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:i/>
              <w:sz w:val="18"/>
              <w:color w:val="1E3A8A"/>
            </w:rPr>
            <w:t>Gambar ${i + 1}: Tangkapan Layar Detail SSL — ${xmlEscape(domainName)} (Dicek: ${xmlEscape(formattedCheckDate)})</w:t>
          </w:r>
        </w:p>

        <!-- Gambar Screenshot -->
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:after="100"/>
          </w:pPr>
          <w:r>
            <w:drawing>
              <wp:inline distT="0" distB="0" distL="0" distR="0">
                <wp:extent cx="${cx}" cy="${cy}"/>
                <wp:effectExtent l="0" t="0" r="0" b="0"/>
                <wp:docPr id="${i + 1}" name="Picture ${i + 1}"/>
                <wp:cNvGraphicFramePr>
                  <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
                </wp:cNvGraphicFramePr>
                <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                  <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:nvPicPr>
                        <pic:cNvPr id="${i + 1}" name="${imgFileName}"/>
                        <pic:cNvPicPr/>
                      </pic:nvPicPr>
                      <pic:blipFill>
                        <a:blip r:embed="rIdImg${i + 1}"/>
                        <a:stretch><a:fillRect/></a:stretch>
                      </pic:blipFill>
                      <pic:spPr>
                        <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                      </pic:spPr>
                    </pic:pic>
                  </a:graphicData>
                </a:graphic>
              </wp:inline>
            </w:drawing>
          </w:r>
        </w:p>
      `;

      // Page break jika bukan halaman terakhir
      if (i < total - 1) {
        docBodyXml += `
          <w:p>
            <w:r>
              <w:br w:type="page"/>
            </w:r>
          </w:p>
        `;
      }
    }

    bulkProgressDomain.textContent = 'Menyusun file Word (.docx)...';

    // 1. [Content_Types].xml
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    // 2. _rels/.rels
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // 3. word/_rels/document.xml.rels
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${docRelsXml}
</Relationships>`);

    // 4. word/document.xml
    const finalDocXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${docBodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', finalDocXml);

    const docxBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    // Download Word Document
    const link = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    link.download = `Laporan_Audit_SSL_${dateStr}.docx`;
    link.href = URL.createObjectURL(docxBlob);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error('Gagal membuat dokumen Word:', err);
    alert('Terjadi kesalahan saat membuat file Word: ' + err.message);
  } finally {
    bulkProgressModal.style.display = 'none';
    btnExportWord.disabled = false;
    btnExportWord.innerHTML = origBtnHtml;

    // Kembalikan status modal semula
    if (wasModalOpen && prevActiveIndex !== undefined && currentResults[parseInt(prevActiveIndex, 10)]) {
      populateModalContent(currentResults[parseInt(prevActiveIndex, 10)]);
      detailModal.style.display = 'flex';
      detailModal.dataset.activeIndex = prevActiveIndex;
    } else {
      detailModal.style.display = 'none';
    }
  }
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
