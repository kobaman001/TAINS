import { useState, useRef } from 'react';

const BODY_LIMIT = 160;
const MODES = [
  { key: 'pdf', label: 'PDFアップロード' },
  { key: 'text', label: 'テキスト入力' },
  { key: 'url', label: 'URL入力' },
];

async function extractRequest({ mode, file, text, url }) {
  let res;
  if (mode === 'pdf') {
    const form = new FormData();
    form.append('file', file);
    res = await fetch('/api/line-post/extract', { method: 'POST', body: form });
  } else {
    res = await fetch('/api/line-post/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'url' ? { url } : { text }),
    });
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '抽出に失敗しました');
  return data;
}

async function generateRequest(payload) {
  const res = await fetch('/api/line-post/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '生成に失敗しました');
  return data;
}

function CopyButton({ text, disabled }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('コピーに失敗しました');
    }
  };
  return (
    <button type="button" className="lp-copy-btn" onClick={handleCopy} disabled={disabled}>
      {copied ? 'コピーしました ✓' : 'コピー'}
    </button>
  );
}

export default function LinePostPage() {
  const [mode, setMode] = useState('pdf');
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [url, setUrl] = useState('');

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedText, setExtractedText] = useState('');

  const [court, setCourt] = useState('');
  const [date, setDate] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);

  const canExtract =
    (mode === 'pdf' && !!file) ||
    (mode === 'text' && pastedText.trim().length > 0) ||
    (mode === 'url' && url.trim().length > 0);

  const handleModeChange = (m) => {
    setMode(m);
    setExtractError('');
  };

  const handleExtract = async () => {
    setExtracting(true);
    setExtractError('');
    setResult(null);
    try {
      const data = await extractRequest({ mode, file, text: pastedText, url });
      setExtractedText(data.text);
      setCourt(data.court || '');
      setDate(data.date || '');
      setSourceUrl(data.sourceUrl || sourceUrl);
    } catch (e) {
      setExtractError(e.message);
    }
    setExtracting(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError('');
    try {
      const data = await generateRequest({ text: extractedText, court, date, sourceUrl });
      setResult(data);
    } catch (e) {
      setGenerateError(e.message);
    }
    setGenerating(false);
  };

  const bodyLen = result?.body.length ?? 0;

  return (
    <div className="line-post-page">
      <header className="lp-header">
        <h1>LINE配信文ジェネレーター</h1>
        <a href="#/" className="btn btn-secondary">チャットへ</a>
      </header>

      <div className="lp-content">
        <section className="lp-section">
          <h2>1. ソースを入力</h2>
          <div className="lp-tabs">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`lp-tab${mode === m.key ? ' active' : ''}`}
                onClick={() => handleModeChange(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'pdf' && (
            <div className="lp-field">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <span className="lp-file-name">{file.name}</span>}
            </div>
          )}

          {mode === 'text' && (
            <textarea
              className="lp-textarea"
              rows={8}
              placeholder="判決文・裁決文などのテキストを貼り付けてください"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          )}

          {mode === 'url' && (
            <input
              className="lp-input"
              type="url"
              placeholder="https://example.org/decision/123"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExtract}
            disabled={!canExtract || extracting}
          >
            {extracting ? '抽出中...' : 'テキストを抽出'}
          </button>
          {extractError && <p className="lp-error">{extractError}</p>}
        </section>

        {extractedText && (
          <section className="lp-section">
            <h2>2. 抽出内容の確認・修正</h2>

            <label className="lp-label">抽出テキスト（必要に応じて編集可）</label>
            <textarea
              className="lp-textarea"
              rows={6}
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
            />

            <div className="lp-meta-row">
              <div className="lp-field">
                <label className="lp-label">裁判所等の名称</label>
                <input
                  className="lp-input"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  placeholder="例：東京地方裁判所"
                />
              </div>
              <div className="lp-field">
                <label className="lp-label">日付</label>
                <input
                  className="lp-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="例：令和6年3月15日"
                />
              </div>
            </div>

            <label className="lp-label">コンテンツ収録URL（本文の末尾に付加されます）</label>
            <input
              className="lp-input"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.tains.org/..."
            />

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generating || !extractedText.trim()}
            >
              {generating ? '生成中...' : 'LINE投稿文を生成'}
            </button>
            {generateError && <p className="lp-error">{generateError}</p>}
          </section>
        )}

        {result && (
          <section className="lp-section lp-result">
            <h2>3. 生成結果</h2>
            <p className="lp-engine-note">
              {result.usedAi ? 'AI（Claude）による生成' : 'ルールベース生成（ANTHROPIC_API_KEY未設定）'}
            </p>

            <label className="lp-label">タイトル</label>
            <div className="lp-output-row">
              <textarea
                className="lp-textarea"
                rows={2}
                value={result.title}
                onChange={(e) => setResult((r) => ({ ...r, title: e.target.value }))}
              />
              <CopyButton text={result.title} />
            </div>

            <label className="lp-label">
              本文
              <span className={`lp-char-count${bodyLen > BODY_LIMIT ? ' over' : ''}`}>
                {bodyLen} / {BODY_LIMIT}
              </span>
            </label>
            <div className="lp-output-row">
              <textarea
                className="lp-textarea"
                rows={5}
                value={result.body}
                onChange={(e) => setResult((r) => ({ ...r, body: e.target.value }))}
              />
              <CopyButton text={result.body} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
