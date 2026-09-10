import { useState, useEffect } from 'react';
import { IconEdit, IconTrash, IconCheck, IconX, IconPrinter } from '../components/Icons';

const formatRp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

export default function Home() {
  const [petugas, setPetugas] = useState('');
  const [editingStaff, setEditingStaff] = useState(false);
  const [staffInput, setStaffInput] = useState('');

  const [saldo, setSaldo] = useState(0);
  const [data, setData] = useState([]);
  const [mingguan, setMingguan] = useState([]);
  const [bulanan, setBulanan] = useState([]);
  const [activeTab, setActiveTab] = useState('input');

  const [keterangan, setKeterangan] = useState('');
  const [qty, setQty] = useState('');
  const [harga, setHarga] = useState('');
  const [jenis, setJenis] = useState('masuk');

  const [editingNo, setEditingNo] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [printData, setPrintData] = useState(null);

  useEffect(() => {
    setPetugas(localStorage.getItem('petugasAktif') || '');
    loadData();
  }, []);

  async function loadData() {
    const res = await fetch('/api/transaksi');
    setData(await res.json());
    const resSaldo = await fetch('/api/saldo');
    const { saldo } = await resSaldo.json();
    setSaldo(saldo);
  }

  async function loadMingguan() {
    const res = await fetch('/api/rekap/mingguan');
    setMingguan(await res.json());
  }

  async function loadBulanan() {
    const res = await fetch('/api/rekap/bulanan');
    setBulanan(await res.json());
  }

  function pilihTab(name) {
    setActiveTab(name);
    if (name === 'mingguan') loadMingguan();
    if (name === 'bulanan') loadBulanan();
  }

  function simpanPetugas() {
    setPetugas(staffInput.trim());
    localStorage.setItem('petugasAktif', staffInput.trim());
    setEditingStaff(false);
  }

  async function submitTransaksi() {
    if (!petugas) { alert('Isi nama petugas jaga dulu di atas'); return; }
    if (!keterangan) { alert('Isi keterangan dulu'); return; }
    await fetch('/api/transaksi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pegawai: petugas, keterangan, qty: qty || 0, harga: harga || 0, jenis }),
    });
    setKeterangan(''); setQty(''); setHarga('');
    loadData();
  }

  async function hapus(no) {
    if (!confirm('Hapus transaksi ini?')) return;
    await fetch('/api/transaksi/' + no, { method: 'DELETE' });
    loadData();
  }

  function mulaiEdit(t) {
    setEditingNo(t.no);
    setEditForm({ pegawai: t.pegawai, keterangan: t.keterangan, qty: t.qty, harga: t.harga, jenis: t.keluar ? 'keluar' : 'masuk' });
  }

  async function simpanEdit(no) {
    if (!editForm.keterangan) { alert('Keterangan gak boleh kosong'); return; }
    await fetch('/api/transaksi/' + no, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditingNo(null);
    loadData();
  }

  function hitungPeriode(tanggalArr) {
    if (!tanggalArr.length) return '-';
    const toDate = s => { const [d, m, y] = s.split('/'); return new Date(y, m - 1, d); };
    const sorted = [...tanggalArr].sort((a, b) => toDate(a) - toDate(b));
    return sorted[0] + ' s/d ' + sorted[sorted.length - 1];
  }

  function cetakLaporan(jenisLaporan) {
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    if (jenisLaporan === 'input') {
      const totalMasuk = data.reduce((a, b) => a + Number(b.masuk || 0), 0);
      const totalKeluar = data.reduce((a, b) => a + Number(b.keluar || 0), 0);
      const saldoAkhir = data.length ? data[0].saldo : 0;
      setPrintData({
        title: 'RIWAYAT TRANSAKSI KEUANGAN',
        periode: hitungPeriode(data.map(d => d.tanggal)),
        dicetak: tanggalCetak,
        head: ['No', 'Tanggal', 'Petugas', 'Keterangan', 'Qty', 'Harga Satuan', 'Masuk', 'Keluar', 'Saldo'],
        rows: [...data].reverse().map(t => [t.no, t.tanggal, t.pegawai || '-', t.keterangan, t.qty || '-', t.harga ? formatRp(t.harga) : '-', t.masuk ? formatRp(t.masuk) : '-', t.keluar ? formatRp(t.keluar) : '-', formatRp(t.saldo)]),
        summary: [['Total Pemasukan', formatRp(totalMasuk)], ['Total Pengeluaran', formatRp(totalKeluar)], ['Saldo Akhir', formatRp(saldoAkhir)]],
      });
    } else {
      const src = jenisLaporan === 'mingguan' ? mingguan : bulanan;
      const totalMasuk = src.reduce((a, b) => a + Number(b.masuk || 0), 0);
      const totalKeluar = src.reduce((a, b) => a + Number(b.keluar || 0), 0);
      setPrintData({
        title: jenisLaporan === 'mingguan' ? 'REKAP MINGGUAN KEUANGAN' : 'REKAP BULANAN KEUANGAN',
        periode: src.length ? src[0].periode + ' s/d ' + src[src.length - 1].periode : '-',
        dicetak: tanggalCetak,
        head: ['Periode', 'Masuk', 'Keluar', 'Saldo'],
        rows: src.map(r => [r.periode, formatRp(r.masuk), formatRp(r.keluar), formatRp(r.saldo)]),
        summary: [['Total Pemasukan', formatRp(totalMasuk)], ['Total Pengeluaran', formatRp(totalKeluar)], ['Selisih', formatRp(totalMasuk - totalKeluar)]],
      });
    }
    setTimeout(() => window.print(), 50);
  }

  return (
    <div className="container">
      <div className="header">
        <div className="eyebrow">Nesastech</div>
        <h1>Catatan Keuangan</h1>
      </div>

      <div className="staff-bar">
        {editingStaff ? (
          <>
            <input className="staff-input" autoFocus placeholder="Nama petugas jaga" defaultValue={petugas}
              onChange={e => setStaffInput(e.target.value)} />
            <button className="staff-save" onClick={simpanPetugas}><IconCheck /></button>
            <button className="staff-cancel" onClick={() => setEditingStaff(false)}><IconX /></button>
          </>
        ) : (
          <>
            <span className="staff-label">Petugas jaga:</span>
            <span className={'staff-name' + (petugas ? '' : ' empty')}>{petugas || 'Belum diatur'}</span>
            <button className="staff-edit-btn" onClick={() => { setStaffInput(petugas); setEditingStaff(true); }}><IconEdit /></button>
          </>
        )}
      </div>

      <div className="balance-card">
        <div className="label">Saldo saat ini</div>
        <div className="saldo">{formatRp(saldo)}</div>
      </div>

      <div className="tabs">
        <button className={'tab-btn' + (activeTab === 'input' ? ' active' : '')} onClick={() => pilihTab('input')}>Input & Riwayat</button>
        <button className={'tab-btn' + (activeTab === 'mingguan' ? ' active' : '')} onClick={() => pilihTab('mingguan')}>Rekap Mingguan</button>
        <button className={'tab-btn' + (activeTab === 'bulanan' ? ' active' : '')} onClick={() => pilihTab('bulanan')}>Rekap Bulanan</button>
      </div>

      {activeTab === 'input' && (
        <>
          <div className="card">
            <div className="form-grid">
              <input placeholder="Nama / keperluan" value={keterangan} onChange={e => setKeterangan(e.target.value)} />
              <input type="number" placeholder="Qty" min="1" value={qty} onChange={e => setQty(e.target.value)} />
              <input type="number" placeholder="Harga satuan (Rp)" value={harga} onChange={e => setHarga(e.target.value)} />
            </div>
            <div className="jumlah-preview">Jumlah: <b>{formatRp(Number(qty || 0) * Number(harga || 0))}</b></div>
            <div className="form-row2">
              <div className="jenis-toggle">
                <button type="button" className={'jenis-btn masuk' + (jenis === 'masuk' ? ' active' : '')} onClick={() => setJenis('masuk')}>Masuk</button>
                <button type="button" className={'jenis-btn keluar' + (jenis === 'keluar' ? ' active' : '')} onClick={() => setJenis('keluar')}>Keluar</button>
              </div>
              <button className="submit" onClick={submitTransaksi}>+ Tambah</button>
            </div>
          </div>

          <div className="card">
            <div className="toolbar">
              <button className="print-btn" onClick={() => cetakLaporan('input')}><IconPrinter /> Cetak / Export PDF</button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>No</th><th>Tanggal</th><th>Petugas</th><th>Keterangan</th><th>Qty</th><th>Harga Satuan</th><th>Masuk</th><th>Keluar</th><th>Saldo</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {data.length === 0 && <tr><td colSpan={10} className="empty">Belum ada transaksi</td></tr>}
                  {data.map(t => editingNo === t.no ? (
                    <tr key={t.no} className="editing">
                      <td>{t.no}</td><td>-</td>
                      <td><input value={editForm.pegawai} onChange={e => setEditForm({ ...editForm, pegawai: e.target.value })} /></td>
                      <td><input value={editForm.keterangan} onChange={e => setEditForm({ ...editForm, keterangan: e.target.value })} /></td>
                      <td><input type="number" value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value })} /></td>
                      <td><input type="number" value={editForm.harga} onChange={e => setEditForm({ ...editForm, harga: e.target.value })} /></td>
                      <td colSpan={2}>
                        <div className="jenis-toggle">
                          <button type="button" className={'jenis-btn masuk' + (editForm.jenis === 'masuk' ? ' active' : '')} onClick={() => setEditForm({ ...editForm, jenis: 'masuk' })}>Masuk</button>
                          <button type="button" className={'jenis-btn keluar' + (editForm.jenis === 'keluar' ? ' active' : '')} onClick={() => setEditForm({ ...editForm, jenis: 'keluar' })}>Keluar</button>
                        </div>
                      </td>
                      <td>-</td>
                      <td className="aksi">
                        <button className="save-btn" onClick={() => simpanEdit(t.no)}><IconCheck /></button>
                        <button className="cancel-btn" onClick={() => setEditingNo(null)}><IconX /></button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.no}>
                      <td>{t.no}</td><td>{t.tanggal}</td><td>{t.pegawai || '-'}</td><td>{t.keterangan}</td>
                      <td>{t.qty || '-'}</td><td>{t.harga ? formatRp(t.harga) : '-'}</td>
                      <td className="masuk">{t.masuk ? formatRp(t.masuk) : '-'}</td>
                      <td className="keluar">{t.keluar ? formatRp(t.keluar) : '-'}</td>
                      <td>{formatRp(t.saldo)}</td>
                      <td className="aksi">
                        <button className="edit-btn" onClick={() => mulaiEdit(t)}><IconEdit /></button>
                        <button onClick={() => hapus(t.no)}><IconTrash /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'mingguan' && (
        <div className="card">
          <div className="toolbar">
            <button className="print-btn" onClick={() => cetakLaporan('mingguan')}><IconPrinter /> Cetak / Export PDF</button>
          </div>
          <table>
            <thead><tr><th>Periode</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr></thead>
            <tbody>
              {mingguan.length === 0 && <tr><td colSpan={4} className="empty">Belum ada data</td></tr>}
              {mingguan.map((r, i) => (
                <tr key={i}><td>{r.periode}</td><td className="masuk">{formatRp(r.masuk)}</td><td className="keluar">{formatRp(r.keluar)}</td><td>{formatRp(r.saldo)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'bulanan' && (
        <div className="card">
          <div className="toolbar">
            <button className="print-btn" onClick={() => cetakLaporan('bulanan')}><IconPrinter /> Cetak / Export PDF</button>
          </div>
          <table>
            <thead><tr><th>Periode</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr></thead>
            <tbody>
              {bulanan.length === 0 && <tr><td colSpan={4} className="empty">Belum ada data</td></tr>}
              {bulanan.map((r, i) => (
                <tr key={i}><td>{r.periode}</td><td className="masuk">{formatRp(r.masuk)}</td><td className="keluar">{formatRp(r.keluar)}</td><td>{formatRp(r.saldo)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div id="print-report">
        {printData && (
          <>
            <div className="rp-title">{printData.title}</div>
            <div className="rp-sub">Nesastech</div>
            <div className="rp-meta">
              <span>Periode: {printData.periode}</span>
              <span>Dicetak: {printData.dicetak}</span>
            </div>
            <table>
              <thead><tr>{printData.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>
                {printData.rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <div className="rp-summary">
              {printData.summary.map(([label, val], i) => (
                <div key={i} className={i === printData.summary.length - 1 ? 'rp-total' : ''}>
                  <span>{label}</span><span>{val}</span>
                </div>
              ))}
            </div>
            <div className="rp-footer">
              <div className="rp-sign"><div className="line">Penanggung Jawab</div></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}