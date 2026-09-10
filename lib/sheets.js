const key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');


import { google } from 'googleapis';

const SHEET_NAME = 'Transaksi';
const RANGE_ALL = `${SHEET_NAME}!A2:I`;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}



function parseAngka(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  const bersih = String(value).replace(/[^0-9.-]/g, '');
  const num = Number(bersih);
  return isNaN(num) ? 0 : num;
}


async function getRawRows() {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE_ALL,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  return (res.data.values || []).filter(r => r[0] !== undefined && r[0] !== '');
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcMillis = utcDays * 86400 * 1000;
  const dateOnly = new Date(utcMillis);
  const fractionalDay = serial - Math.floor(serial);
  const totalSeconds = Math.round(fractionalDay * 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), hours, minutes, seconds));
}



function formatTanggal(value) {
  if (value === undefined || value === null || value === '') return '-';
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    const d = excelSerialToDate(num);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return String(value);
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export async function getAllTransaksi() {
  const rows = await getRawRows();
  return rows.map(r => ({
    no: Number(r[0]),
    tanggal: formatTanggal(r[1]),
    pegawai: r[2] || '',
    keterangan: r[3] || '',
    qty: parseAngka(r[4]),
    harga: parseAngka(r[5]),
    masuk: parseAngka(r[6]),
    keluar: parseAngka(r[7]),
    saldo: parseAngka(r[8]),
  })).reverse();
}

export async function getSaldoTotal() {
  const rows = await getRawRows();
  if (!rows.length) return 0;
  return Number(rows[rows.length - 1][8] || 0);
}

async function appendBaris({ pegawai, keterangan, qty, harga, masuk, keluar }) {
  const sheets = getSheetsClient();
  const rows = await getRawRows();
  const noBaru = rows.length + 1;
  const saldoSebelumnya = rows.length ? Number(rows[rows.length - 1][8] || 0) : 0;
  const saldoBaru = saldoSebelumnya + masuk - keluar;
  const tanggalISO = new Date().toISOString().slice(0, 10);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE_ALL,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[noBaru, tanggalISO, pegawai, keterangan, qty, harga, masuk, keluar, saldoBaru]] },
  });
}

export async function tambahTransaksi({ pegawai, keterangan, qty, harga, jenis }) {
  const jumlah = Number(qty || 0) * Number(harga || 0);
  const masuk = jenis === 'masuk' ? jumlah : 0;
  const keluar = jenis === 'keluar' ? jumlah : 0;
  await appendBaris({ pegawai, keterangan, qty: Number(qty || 0), harga: Number(harga || 0), masuk, keluar });
  return getAllTransaksi();
}

export async function hitungUlangSaldo() {
  const sheets = getSheetsClient();
  const rows = await getRawRows();
  if (!rows.length) return;
  let saldo = 0;
  const noCol = [], saldoCol = [];
  rows.forEach((r, i) => {
    saldo += Number(r[6] || 0) - Number(r[7] || 0);
    noCol.push([i + 1]);
    saldoCol.push([saldo]);
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${SHEET_NAME}!A2:A${rows.length + 1}`, values: noCol },
        { range: `${SHEET_NAME}!I2:I${rows.length + 1}`, values: saldoCol },
      ],
    },
  });
}

export async function editTransaksi({ no, pegawai, keterangan, qty, harga, jenis }) {
  const sheets = getSheetsClient();
  const rows = await getRawRows();
  const idx = rows.findIndex(r => Number(r[0]) === Number(no));
  if (idx === -1) throw new Error('Transaksi tidak ditemukan');
  const rowNumber = idx + 2;
  const jumlah = Number(qty || 0) * Number(harga || 0);
  const masuk = jenis === 'masuk' ? jumlah : 0;
  const keluar = jenis === 'keluar' ? jumlah : 0;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!C${rowNumber}:H${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[pegawai, keterangan, Number(qty || 0), Number(harga || 0), masuk, keluar]] },
  });

  await hitungUlangSaldo();
  return getAllTransaksi();
}

async function getSheetGid(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);
  return sheet.properties.sheetId;
}

export async function hapusTransaksi(no) {
  const sheets = getSheetsClient();
  const rows = await getRawRows();
  const idx = rows.findIndex(r => Number(r[0]) === Number(no));
  if (idx === -1) throw new Error('Transaksi tidak ditemukan');
  const rowNumber = idx + 2;
  const gid = await getSheetGid(sheets);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId: gid, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber },
        },
      }],
    },
  });

  await hitungUlangSaldo();
  return getAllTransaksi();
}

export async function getRekapMingguan() {
  const rows = await getRawRows();
  const rekap = {};
  rows.forEach(r => {
    if (!r[1]) return; // skip baris tanpa tanggal valid
    const tgl = excelSerialToDate(Number(r[1]));
    // cari hari Senin di minggu itu
    const day = tgl.getUTCDay() || 7;
    const senin = new Date(tgl);
    senin.setUTCDate(tgl.getUTCDate() - day + 1);
    const minggu = new Date(senin);
    minggu.setUTCDate(senin.getUTCDate() + 6);
    const fmt = d => `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    const key = `${fmt(senin)} - ${fmt(minggu)}/${minggu.getUTCFullYear()}`;
    if (!rekap[key]) rekap[key] = { periode: key, masuk: 0, keluar: 0, urut: senin.getTime() };
    rekap[key].masuk += parseAngka(r[6]);
    rekap[key].keluar += parseAngka(r[7]);
  });
  return Object.values(rekap)
    .sort((a, b) => a.urut - b.urut)
    .map(({ urut, ...h }) => ({ ...h, saldo: h.masuk - h.keluar }));
}

export async function getRekapBulanan() {
  const rows = await getRawRows();
  const rekap = {};
  rows.forEach(r => {
    if (!r[1]) return; // skip baris tanpa tanggal valid
    const tgl = excelSerialToDate(Number(r[1]));
    const key = tgl.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    if (!rekap[key]) rekap[key] = { periode: key, masuk: 0, keluar: 0 };
    rekap[key].masuk += parseAngka(r[6]);
    rekap[key].keluar += parseAngka(r[7]);
  });
  return Object.values(rekap).map(h => ({ ...h, saldo: h.masuk - h.keluar }));
}

export async function resetSaldoHarian() {
  const saldoSekarang = await getSaldoTotal();
  const SALDO_AWAL = 10000;
  if (saldoSekarang > SALDO_AWAL) {
    const jumlahSetoran = saldoSekarang - SALDO_AWAL;
    await appendBaris({ pegawai: 'Sistem (Otomatis)', keterangan: 'Setoran', qty: 0, harga: 0, masuk: 0, keluar: jumlahSetoran });
  }
}