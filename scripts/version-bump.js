#!/usr/bin/env node
/**
 * version-bump.js
 * ------------------------------------------------------------------
 * Otomatis membuat catatan versi (version history) setiap kali
 * aplikasi di-push / di-release.
 *
 * Cara kerja:
 *   1. Membaca versi terakhir dari package.json
 *   2. Menaikkan versi (major/minor/patch)
 *   3. Menulis entri baru ke CHANGELOG.md (versi lama tetap tersimpan)
 *   4. Menyinkronkan daftar versi ke public/versions.json
 *   5. Menyimpan snapshot file penting ke .versions/<versi>/
 *
 * Pemakaian:
 *   node scripts/version-bump.js patch "Perbaikan export excel"
 *   node scripts/version-bump.js minor "Tambah filter status"
 *   node scripts/version-bump.js major "Rombak UI dashboard"
 * ------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const VERSIONS_JSON_PATH = path.join(ROOT, 'public', 'versions.json');
const VERSIONS_DIR = path.join(ROOT, '.versions');

// File yang disnapshot tiap versi agar bisa dipulihkan kembali
const SNAPSHOT_FILES = [
    'server.js',
    'sslChecker.js',
    'excelExporter.js',
    'package.json',
    'vercel.json',
    'public/index.html',
    'public/style.css',
    'public/app.js',
];

function log(msg) {
    console.log(`[version-bump] ${msg}`);
}

function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function bumpVersion(current, type) {
    const clean = String(current).replace(/^v/, '').split('.').map(Number);
    let [major, minor, patch] = [clean[0] || 0, clean[1] || 0, clean[2] || 0];
    switch (type) {
        case 'major':
            major += 1;
            minor = 0;
            patch = 0;
            break;
        case 'minor':
            minor += 1;
            patch = 0;
            break;
        case 'patch':
        default:
            patch += 1;
            break;
    }
    return `${major}.${minor}.${patch}`;
}

function gitOutput(cmd, fallback = '') {
    try {
        return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim();
    } catch (e) {
        return fallback;
    }
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function snapshot(version) {
    const dir = path.join(VERSIONS_DIR, version);
    fs.mkdirSync(dir, { recursive: true });
    const copied = [];
    for (const rel of SNAPSHOT_FILES) {
        const src = path.join(ROOT, rel);
        if (!fs.existsSync(src)) continue;
        const dest = path.join(dir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        copied.push(rel);
    }
    log(`Snapshot ${copied.length} file ke .versions/${version}/`);
}

function updateChangelog(version, message) {
    const date = todayISO();
    const commit = gitOutput('git rev-parse --short HEAD', 'local');
    const branch = gitOutput('git rev-parse --abbrev-ref HEAD', 'local');
    const entry =
        `## [${version}] - ${date}\n\n` +
        `- **Update:** ${message}\n` +
        `- **Commit:** \`${commit}\` (branch: \`${branch}\`)\n` +
        `- **Berkas snapshot:** \`.versions/${version}/\`\n` +
        `- **Pulihkan versi ini:** \`node scripts/version-manager.js restore ${version} --apply\`\n\n`;

    let header = '# Changelog\n\nSemua catatan perubahan penting pada aplikasi SSL Checker.\n\n';
    const body = fs.existsSync(CHANGELOG_PATH)
        ? fs.readFileSync(CHANGELOG_PATH, 'utf8').replace(/^# Changelog[\s\S]*?\n(?=## |$)/, '')
        : '';
    fs.writeFileSync(CHANGELOG_PATH, header + entry + body, 'utf8');
    log(`CHANGELOG.md diperbarui dengan versi ${version}`);
}

function updateVersionsIndex(version, message) {
    let index = { current: version, versions: [] };
    if (fs.existsSync(VERSIONS_JSON_PATH)) {
        try {
            index = readJSON(VERSIONS_JSON_PATH);
        } catch (e) {
            /* abaikan, pakai default */
        }
    }
    index.current = version;
    index.versions = Array.isArray(index.versions) ? index.versions : [];
    index.versions.unshift({
        version,
        date: todayISO(),
        message,
        commit: gitOutput('git rev-parse --short HEAD', 'local'),
        restore: `node scripts/version-manager.js restore ${version} --apply`,
    });
    fs.mkdirSync(path.dirname(VERSIONS_JSON_PATH), { recursive: true });
    writeJSON(VERSIONS_JSON_PATH, index);
    log(`public/versions.json diperbarui (versi terkini: ${version})`);
}

function main() {
    const type = (process.argv[2] || 'patch').toLowerCase();
    const message = process.argv.slice(3).join(' ') || 'Perubahan tanpa keterangan';

    if (!['major', 'minor', 'patch'].includes(type)) {
        console.error(`Tipe versi tidak valid: "${type}". Gunakan major|minor|patch.`);
        process.exit(1);
    }

    const pkg = readJSON(PKG_PATH);
    const newVersion = bumpVersion(pkg.version, type);
    pkg.version = newVersion;
    writeJSON(PKG_PATH, pkg);
    log(`Versi ${pkg.version ? '' : ''}dinaikkan menjadi ${newVersion}`);

    updateChangelog(newVersion, message);
    updateVersionsIndex(newVersion, message);
    snapshot(newVersion);

    log('Selesai. Jalankan:');
    log(`  git add -A && git commit -m "release: v${newVersion} - ${message}" && git push`);
}

main();