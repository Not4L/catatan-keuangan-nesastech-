import { getRekapMingguan } from '../../../lib/sheets';

export default async function handler(req, res) {
  try {
    res.status(200).json(await getRekapMingguan());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

