#!/usr/bin/env node
/**
 * version-manager.js
 * ------------------------------------------------------------------
 * Mengelola riwayat versi aplikasi SSL Checker.
 *
 * Perintah yang tersedia:
 *   node scripts/version-manager.js list
 *       Menampilkan daftar semua versi yang tersimpan.
 *
 *   node scripts/version-manager.js show <versi>
 *       Menampilkan detail satu versi.
 *
 *   node scripts/version-manager.js restore <versi>
 *       Menampilkan rencana pemulihan (dry-run, belum mengubah file).
 *
 *   node scripts/version-manager.js restore <versi> --apply
 *       Memulihkan file aplikasi ke kondisi versi tersebut.
 *       Sebelum menimpa, versi saat ini otomatis di-backup ke
 *       .versions/_backup-<timestamp>/ sehingga bisa dikembalikan lagi.
 * ------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSIONS_DIR = path.join(ROOT, '.versions');
const VERSIONS_JSON_PATH = path.join(ROOT, 'public', 'versions.json');

function log(msg) {
    console.log(msg);
}

function readVersionsIndex() {
    if (!fs.existsSync(VERSIONS_JSON_PATH)) return { current: null, versions: [] };
    try {
        return JSON.parse(fs.readFileSync(VERSIONS_JSON_PATH, 'utf8'));
    } catch (e) {
        return { current: null, versions: [] };
    }
}

function listVersions() {
    const index = readVersionsIndex();
    if (!index.versions || index.versions.length === 0) {
        log('Belum ada versi yang tercatat. Jalankan: node scripts/version-bump.js patch "pesan"');
        return;
    }
    log(`Versi terkini: ${index.current || '-'}`);
    log('Daftar versi (terbaru di atas):');
    log('--------------------------------------------------------------');
    index.versions.forEach((v) => {
        const marker = v.version === index.current ? ' (aktif)' : '';
        log(`  v${v.version}${marker}`);
        log(`    Tanggal : ${v.date}`);
        log(`    Update  : ${v.message}`);
        log(`    Commit  : ${v.commit}`);
        log(`    Pulihkan: node scripts/version-manager.js restore ${v.version} --apply`);
        log('--------------------------------------------------------------');
    });
}

function showVersion(version) {
    const index = readVersionsIndex();
    const entry = (index.versions || []).find((v) => v.version === version);
    if (!entry) {
        log(`Versi ${version} tidak ditemukan di catatan.`);
        return;
    }
    log(`Detail versi v${entry.version}`);
    log(`  Tanggal : ${entry.date}`);
    log(`  Update  : ${entry.message}`);
    log(`  Commit  : ${entry.commit}`);
    const snapDir = path.join(VERSIONS_DIR, version);
    if (fs.existsSync(snapDir)) {
        log(`  Snapshot berkas:`);
        walkRel(snapDir).forEach((f) => log(`    - ${f}`));
    } else {
        log(`  Snapshot tidak ditemukan (${snapDir}).`);
    }
}

function walkRel(dir, base = dir, out = []) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            walkRel(full, base, out);
        } else {
            out.push(path.relative(base, full).replace(/\\/g, '/'));
        }
    }
    return out;
}

function copyTree(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const name of fs.readdirSync(srcDir)) {
        const src = path.join(srcDir, name);
        const dest = path.join(destDir, name);
        if (fs.statSync(src).isDirectory()) {
            copyTree(src, dest);
        } else {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
        }
    }
}

function restoreVersion(version, apply) {
    const snapDir = path.join(VERSIONS_DIR, version);
    if (!fs.existsSync(snapDir)) {
        log(`Snapshot untuk v${version} tidak ditemukan di ${snapDir}.`);
        process.exit(1);
    }

    const files = walkRel(snapDir);
    if (!apply) {
        log(`DRY-RUN: file berikut akan dipulihkan dari v${version}:`);
        files.forEach((f) => log(`  - ${f}`));
        log('');
        log('Versi terbaru saat ini akan otomatis di-backup sebelum ditimpa.');
        log(`Jalankan ulang dengan flag --apply untuk benar-benar memulihkan:`);
        log(`  node scripts/version-manager.js restore ${version} --apply`);
        return;
    }

    // Backup kondisi saat ini agar perubahan terbaru tidak hilang
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(VERSIONS_DIR, `_backup-${stamp}`);
    const currentFiles = files.filter((f) => fs.existsSync(path.join(ROOT, f)));
    currentFiles.forEach((f) => {
        const src = path.join(ROOT, f);
        const dest = path.join(backupDir, f);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    });
    log(`Backup kondisi saat ini disimpan di .versions/_backup-${stamp}/`);

    // Pulihkan tiap berkas dari snapshot
    files.forEach((f) => {
        const src = path.join(snapDir, f);
        const dest = path.join(ROOT, f);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    });

    // Sinkronkan package.json version ke versi yang dipulihkan
    try {
        const pkgPath = path.join(ROOT, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.version = version;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    } catch (e) {
        /* abaikan bila package.json tidak ada */
    }

    log(`Berhasil memulihkan ${files.length} berkas ke versi v${version}.`);
    log('Jalankan `npm start` untuk menguji versi yang dipulihkan.');
    log(`Untuk kembali ke versi sebelum pemulihan, salin dari .versions/_backup-${stamp}/`);
}

function main() {
    const cmd = (process.argv[2] || 'list').toLowerCase();
    const version = process.argv[3];
    const apply = process.argv.includes('--apply');

    switch (cmd) {
        case 'list':
            listVersions();
            break;
        case 'show':
            if (!version) {
                log('Sertakan nomor versi. Contoh: node scripts/version-manager.js show 1.0.1');
                process.exit(1);
            }
            showVersion(version);
            break;
        case 'restore':
            if (!version) {
                log('Sertakan nomor versi. Contoh: node scripts/version-manager.js restore 1.0.1 --apply');
                process.exit(1);
            }
            restoreVersion(version, apply);
            break;
        default:
            log('Perintah tidak dikenal. Gunakan: list | show <versi> | restore <versi> [--apply]');
            process.exit(1);
    }
}

main();