import { PDFParse } from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';

const BODY_LIMIT = 160;
const MAX_SOURCE_CHARS = 12000; // cap text sent to the model / used for the fallback summarizer

// ---------------------------------------------------------------------------
// PDF / URL text extraction
// ---------------------------------------------------------------------------

export async function extractFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fc/,
  /^\[?fe80/,
];

export function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('URLの形式が正しくありません');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('http または https のURLのみ利用できます');
  }
  const host = parsed.hostname.toLowerCase();
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) {
    throw new Error('内部/プライベートアドレスへのアクセスはできません');
  }
  return parsed;
}

function htmlToText(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return text
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export async function extractFromUrl(rawUrl) {
  const url = assertSafeUrl(rawUrl);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TAINS-LinePostGenerator/1.0)' },
  });
  if (!res.ok) {
    throw new Error(`URLの取得に失敗しました（status ${res.status}）`);
  }
  const contentType = res.headers.get('content-type') || '';
  const buffer = Buffer.from(await res.arrayBuffer());

  if (contentType.includes('application/pdf') || url.pathname.toLowerCase().endsWith('.pdf')) {
    return extractFromPdf(buffer);
  }
  return htmlToText(buffer.toString('utf-8'));
}

// ---------------------------------------------------------------------------
// 裁判所名・日付の自動抽出（正規表現ベースのヒューリスティック。ユーザーが後で修正可能）
// ---------------------------------------------------------------------------

const COURT_RE =
  /最高裁判所|[^\s、。,.()（）「」『』0-9０-９]{1,6}(?:高等|地方|簡易|家庭)裁判所(?:[^\s、。,.()（）「」『』0-9０-９]{0,6}支部)?|[^\s、。,.()（）「」『』0-9０-９]{0,6}国税不服審判所(?:[^\s、。,.()（）「」『』0-9０-９]{0,6}支部)?/g;

const DATE_RE =
  /(?:令和|平成|昭和|大正|明治)(?:元|[0-9０-９]{1,2})年[0-9０-９]{1,2}月[0-9０-９]{1,2}日|[0-9０-９]{4}年[0-9０-９]{1,2}月[0-9０-９]{1,2}日/g;

export function extractCourtAndDate(text) {
  const courtMatches = [...text.matchAll(COURT_RE)].map((m) => ({ value: m[0], index: m.index }));
  const dateMatches = [...text.matchAll(DATE_RE)].map((m) => ({ value: m[0], index: m.index }));

  let court = '';
  if (courtMatches.length > 0) {
    const counts = new Map();
    for (const m of courtMatches) {
      const entry = counts.get(m.value) || { count: 0, lastIndex: -1 };
      entry.count += 1;
      entry.lastIndex = m.index;
      counts.set(m.value, entry);
    }
    let best = null;
    for (const [value, entry] of counts) {
      if (
        !best ||
        entry.count > best.entry.count ||
        (entry.count === best.entry.count && entry.lastIndex > best.entry.lastIndex)
      ) {
        best = { value, entry };
      }
    }
    court = best.value;
  }

  let date = '';
  if (dateMatches.length > 0) {
    const primaryCourtIndex = courtMatches.find((m) => m.value === court)?.index;
    const scored = dateMatches.map((m) => {
      let score = 0;
      const tail = text.slice(m.index + m.value.length, m.index + m.value.length + 10);
      if (/^\s*(判決|裁決|決定)/.test(tail)) score += 100;
      if (primaryCourtIndex != null && Math.abs(m.index - primaryCourtIndex) < 60) score += 50;
      return { ...m, score };
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    date = scored[0].value;
  }

  return { court, date };
}

// ---------------------------------------------------------------------------
// 本文組み立て（160字ハードリミットはここで必ず担保する）
// ---------------------------------------------------------------------------

function composeTitle(headline, court, date) {
  return [headline.trim(), court, date].filter(Boolean).join(' ').trim();
}

function composeBody(summary, sourceUrl) {
  const url = (sourceUrl || '').trim();
  const sep = url ? '\n' : '';
  const maxSummaryLen = Math.max(0, BODY_LIMIT - url.length - sep.length);
  let text = summary.trim().replace(/\s+/g, ' ');
  if (text.length > maxSummaryLen) {
    text = maxSummaryLen > 0 ? text.slice(0, Math.max(0, maxSummaryLen - 1)) + '…' : '';
  }
  return `${text}${sep}${url}`;
}

// ---------------------------------------------------------------------------
// ルールベースのフォールバック要約（ANTHROPIC_API_KEY 未設定時に使用）
// ---------------------------------------------------------------------------

function splitSentences(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[。！？\n])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isBoilerplate(sentence) {
  if (sentence.length < 8) return true;
  if (/^(主文|理由|事実及び理由|事案の概要|争点|判断|第\s*[0-9０-９]+\b)/.test(sentence)) return true;
  return false;
}

function fallbackGenerate(text) {
  const sentences = splitSentences(text).filter((s) => !isBoilerplate(s));
  const firstSentence = sentences[0] || text.trim().slice(0, 60);

  let headline = firstSentence.replace(/[。]+$/, '');
  const HEADLINE_MAX = 34;
  if (headline.length > HEADLINE_MAX) {
    headline = headline.slice(0, HEADLINE_MAX) + '…';
  }

  let summary = '';
  const SUMMARY_TARGET = 110;
  for (const s of sentences) {
    if ((summary + s).length > SUMMARY_TARGET) break;
    summary += s;
  }
  if (!summary) summary = firstSentence;

  return { headline, summary };
}

// ---------------------------------------------------------------------------
// Anthropic API を使った生成（キーが設定されている場合のみ）
// ---------------------------------------------------------------------------

async function aiGenerate(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

  const prompt = `あなたは税務専門メディアのSNS編集者です。以下は税務訴訟又は税務裁決の全文（抜粋含む）です。
LINE公式アカウントで配信するための投稿文の材料として、次の2つを日本語で作成してください。

1. headline: 内容の要点を捉えた、読者の関心を引く見出し。30文字前後。裁判所名や日付、句読点の「。」は含めないこと。
2. summary: 判決・裁決の要旨を簡潔にまとめた文章。120文字前後。URLや裁判所名・日付は含めないこと。

出力は次のJSON形式のみとし、他のテキストは一切含めないこと。
{"headline": "...", "summary": "..."}

---
${text.slice(0, MAX_SOURCE_CHARS)}
---`;

  const response = await client.messages.create({
    model,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.headline === 'string' && typeof parsed.summary === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// エントリポイント
// ---------------------------------------------------------------------------

export async function generateLineContent({ text, court, date, sourceUrl }) {
  if (!text || !text.trim()) {
    throw new Error('本文となるテキストがありません');
  }

  let generated;
  let usedAi = false;
  try {
    generated = await aiGenerate(text);
    usedAi = generated != null;
  } catch {
    generated = null;
  }
  if (!generated) {
    generated = fallbackGenerate(text);
  }

  const title = composeTitle(generated.headline, court, date);
  const body = composeBody(generated.summary, sourceUrl);

  return { title, body, usedAi };
}
