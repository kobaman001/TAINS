function tokenize(text) {
  // Extract Japanese words (3+ chars) and ASCII words
  const jp = text.match(/[ぁ-んァ-ヶー一-龯]{2,}/g) ?? [];
  const ascii = text.match(/[a-zA-Z0-9]{2,}/g) ?? [];
  return [...jp, ...ascii].map(t => t.toLowerCase());
}

function scoreRule(inputTokens, inputRaw, rule) {
  const normalized = inputRaw.toLowerCase();

  // Exact question match (highest score)
  if (rule.question && normalized.includes(rule.question.toLowerCase())) return 10000;

  let score = 0;

  // Pattern match
  for (const pattern of rule.patterns) {
    if (normalized.includes(pattern.toLowerCase())) {
      score += 10 + pattern.length; // longer match = higher score
    }
  }

  // Token overlap with question
  if (rule.question) {
    const qTokens = tokenize(rule.question);
    const overlap = inputTokens.filter(t => qTokens.includes(t)).length;
    score += overlap * 5;
  }

  // Boost popular questions
  if (rule.popular) score += 5;

  return score;
}

export function matchRule(input, rules) {
  const inputTokens = tokenize(input);

  const scored = rules
    .map(rule => ({ rule, score: scoreRule(inputTokens, input, rule) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.rule ?? null;
}

export async function loadRules() {
  const res = await fetch('/rules.json');
  if (!res.ok) throw new Error('ルールファイルの読み込みに失敗しました');
  return res.json();
}
