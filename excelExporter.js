const ExcelJS = require('exceljs');

/**
 * Membuat Workbook Excel lengkap dengan visual styling profesional
 * @param {object[]} data Hasil inspeksi SSL
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function generateSSLWorkbook(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bulk SSL Checker';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Laporan Audit SSL', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] // Freeze header row
  });

  // Definisi Kolom
  worksheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Domain / Host', key: 'domain', width: 26 },
    { header: 'Status Sertifikat', key: 'statusText', width: 22 },
    { header: 'Status Pembaruan (Masa Aktif)', key: 'renewalStatus', width: 36 },
    { header: 'Tanggal Kedaluwarsa', key: 'validTo', width: 20 },
    { header: 'Sisa Hari', key: 'daysRemaining', width: 12 },
    { header: 'Tanggal Terbit', key: 'validFrom', width: 20 },
    { header: 'Penerbit (Issuer)', key: 'issuer', width: 28 },
    { header: 'Common Name (CN)', key: 'subjectCN', width: 26 },
    { header: 'Alt Names (SAN)', key: 'san', width: 35 },
    { header: 'Protokol & Cipher', key: 'crypto', width: 30 },
    { header: 'Serial Number', key: 'serialNumber', width: 26 },
    { header: 'Catatan / Error', key: 'error', width: 32 }
  ];

  // Styling Header (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.font = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' } // Dark Slate Navy
  };

  // Tambahkan baris data
  data.forEach((item, index) => {
    const row = worksheet.addRow({
      no: index + 1,
      domain: item.domain || item.input,
      statusText: item.statusText || '-',
      renewalStatus: item.renewalStatus || item.status2027 || '-',
      validTo: item.validToFormatted || '-',
      daysRemaining: item.daysRemaining !== null ? item.daysRemaining : '-',
      validFrom: item.validFromFormatted || '-',
      issuer: item.issuer ? `${item.issuer} (${item.issuerCN || ''})` : '-',
      subjectCN: item.subjectCN || '-',
      san: Array.isArray(item.san) ? item.san.slice(0, 5).join(', ') + (item.san.length > 5 ? ` (+${item.san.length - 5} lainnya)` : '') : '-',
      crypto: item.protocol ? `${item.protocol} / ${item.cipher || ''}` : '-',
      serialNumber: item.serialNumber || '-',
      error: item.error || 'Normal'
    });

    row.height = 24;
    row.alignment = { vertical: 'middle' };

    // Format warna untuk cell 'renewalStatus' (Kolom D) dan 'statusText' (Kolom C)
    const statusCell = row.getCell('statusText');
    const renewalCell = row.getCell('renewalStatus');
    const daysCell = row.getCell('daysRemaining');

    // Alignment khusus
    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('validTo').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('validFrom').alignment = { vertical: 'middle', horizontal: 'center' };
    daysCell.alignment = { vertical: 'middle', horizontal: 'center' };
    statusCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Styling badge pembaruan (Aman vs Perlu Update Tahun Ini vs Expired/Error)
    const badgeType = item.badge || item.badge2027;
    if (badgeType === 'success') {
      renewalCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDCFCE7' } // Hijau pastel (Aman s.d Tahun Depan+)
      };
      renewalCell.font = { bold: true, color: { argb: 'FF15803D' } }; // Hijau teks
    } else if (badgeType === 'warning') {
      renewalCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' } // Kuning/Gold pastel (Perlu Update Tahun Ini)
      };
      renewalCell.font = { bold: true, color: { argb: 'FFB45309' } }; // Amber teks
    } else {
      renewalCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' } // Merah pastel (Expired / Error)
      };
      renewalCell.font = { bold: true, color: { argb: 'FFB91C1C' } }; // Merah teks
    }

    // Border tipis untuk semua sel
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // Tambahkan Auto-Filter ke Header
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.length + 1, column: worksheet.columns.length }
  };

  return workbook;
}

module.exports = {
  generateSSLWorkbook
};
