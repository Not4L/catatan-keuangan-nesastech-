import { editTransaksi, hapusTransaksi } from '../../../lib/sheets';

export default async function handler(req, res) {
  const { no } = req.query;
  try {
    if (req.method === 'PUT') {
      const { pegawai, keterangan, qty, harga, jenis } = req.body;
      return res.status(200).json(await editTransaksi({ no, pegawai, keterangan, qty, harga, jenis }));
    }
    if (req.method === 'DELETE') return res.status(200).json(await hapusTransaksi(no));
    res.status(405).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}