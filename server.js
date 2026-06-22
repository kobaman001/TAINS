import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, 'public', 'rules.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/rules', (req, res) => {
  try {
    const data = fs.readFileSync(RULES_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: 'rules.json の読み込みに失敗しました' });
  }
});

app.put('/api/rules', (req, res) => {
  try {
    const backup = RULES_PATH + '.bak';
    if (fs.existsSync(RULES_PATH)) {
      fs.copyFileSync(RULES_PATH, backup);
    }
    fs.writeFileSync(RULES_PATH, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'rules.json の保存に失敗しました' });
  }
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
