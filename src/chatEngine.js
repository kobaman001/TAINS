export function matchRule(input, rules) {
  const normalized = input.toLowerCase();

  const matched = rules
    .filter(rule =>
      rule.patterns.some(pattern => normalized.includes(pattern.toLowerCase()))
    )
    .sort((a, b) => b.priority - a.priority);

  return matched[0] ?? null;
}

export async function loadRules() {
  const res = await fetch('/rules.json');
  if (!res.ok) throw new Error('ルールファイルの読み込みに失敗しました');
  return res.json();
}
