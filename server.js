import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { extractFromPdf, extractFromUrl, extractCourtAndDate, generateLineContent } from './server/linePost.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, 'public', 'rules.json');

const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/rules', (req, res) => {
  try {
    const data = fs.readFileSync(RULES_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch {
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
  } catch {
    res.status(500).json({ error: 'rules.json の保存に失敗しました' });
  }
});

app.post('/api/line-post/extract', upload.single('file'), async (req, res) => {
  try {
    let text = '';
    if (req.file) {
      if (req.file.mimetype !== 'application/pdf' && !req.file.originalname.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'PDFファイルを指定してください' });
      }
      text = await extractFromPdf(req.file.buffer);
    } else if (req.body.url) {
      text = await extractFromUrl(req.body.url);
    } else if (req.body.text) {
      text = req.body.text;
    } else {
      return res.status(400).json({ error: 'PDF、テキスト、URLのいずれかを指定してください' });
    }

    if (!text || !text.trim()) {
      return res.status(422).json({ error: 'テキストを抽出できませんでした' });
    }

    const { court, date } = extractCourtAndDate(text);
    const sourceUrl = req.body.url || '';
    res.json({ text, court, date, sourceUrl });
  } catch (e) {
    res.status(500).json({ error: e.message || '抽出に失敗しました' });
  }
});

app.post('/api/line-post/generate', async (req, res) => {
  try {
    const { text, court, date, sourceUrl } = req.body;
    const result = await generateLineContent({ text, court, date, sourceUrl });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || '生成に失敗しました' });
  }
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
