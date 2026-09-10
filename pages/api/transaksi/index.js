import { getAllTransaksi, tambahTransaksi } from '../../../lib/sheets';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return res.status(200).json(await getAllTransaksi());
    if (req.method === 'POST') {
      const { pegawai, keterangan, qty, harga, jenis } = req.body;
      return res.status(200).json(await tambahTransaksi({ pegawai, keterangan, qty, harga, jenis }));
    }
    res.status(405).end();
  } catch (err) {
    
    res.status(500).json({ error: err.message });
  }
}