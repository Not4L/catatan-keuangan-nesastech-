import { getRekapBulanan } from '../../../lib/sheets';

export default async function handler(req, res) {
  try {
    res.status(200).json(await getRekapBulanan());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}