const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { inspectBatch, inspectSSL, parseTarget } = require('./sslChecker');
const { generateSSLWorkbook } = require('./excelExporter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint Cek Batch SSL
app.post('/api/check-ssl', async (req, res) => {
  try {
    let { domains } = req.body;
    if (!domains) {
      return res.status(400).json({ error: 'Harap masukkan setidaknya satu domain.' });
    }

    if (typeof domains === 'string') {
      domains = domains
        .split(/[\r\n,]+/)
        .map(d => d.trim())
        .filter(Boolean);
    }

    if (!Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ error: 'Daftar domain kosong atau tidak valid.' });
    }

    console.log(`[SSL Check] Memulai pengecekan untuk ${domains.length} domain (urutan sesuai input)...`);
    const startTime = Date.now();

    const results = await inspectBatch(domains, 10);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[SSL Check] Selesai memeriksa ${results.length} domain dalam ${duration} detik.`);

    // Statistik Ringkasan
    const stats = {
      total: results.length,
      safeNextYear: results.filter(r => r.badge === 'success').length,
      updateThisYear: results.filter(r => r.badge === 'warning').length,
      expired: results.filter(r => r.status === 'expired').length,
      error: results.filter(r => r.status === 'error').length,
      warning: results.filter(r => r.status === 'warning').length,
      duration: `${duration}s`
    };

    return res.json({
      success: true,
      stats,
      data: results
    });
  } catch (error) {
    console.error('Error saat memeriksa SSL:', error);
    return res.status(500).json({
      error: 'Terjadi kesalahan pada server saat memproses pengecekan SSL.',
      details: error.message
    });
  }
});

// Endpoint Export Excel (.xlsx)
app.post('/api/export-excel', async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data untuk diekspor ke Excel.' });
    }

    const workbook = await generateSSLWorkbook(data);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `SSL_Audit_Report_${dateStr}_${timeStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error saat export Excel:', error);
    return res.status(500).json({
      error: 'Gagal membuat file Excel.',
      details: error.message
    });
  }
});

// Fallback route untuk SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 Aplikasi SSL Checker Berjalan di Port: ${PORT}`);
    console.log(`👉 Buka di browser: http://localhost:${PORT}`);
    console.log(`===================================================`);
  });
}

module.exports = app;
