import { useState, useEffect, useMemo } from 'react';

const CATEGORIES = [
  '入退会・会員制度',
  '会費・利用料の支払い',
  'ログイン・ログアウトについて',
  '会員情報の変更・登録（マイページ）',
  'データベースの使い方',
  '推奨環境について',
  '動画について',
  'その他のサービス',
  '税理士新規登録者6か月無料制度',
];

function newRule() {
  return {
    id: `faq_${Date.now()}`,
    priority: 20,
    category: CATEGORIES[0],
    subcategory: '',
    popular: false,
    related: '',
    patterns: [],
    question: '',
    response: '',
  };
}

export default function AdminPage() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [editRule, setEditRule] = useState(null); // rule being edited
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetch('/api/rules')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => alert('rules.json の読み込みに失敗しました'));
  }, []);

  const filtered = useMemo(() => {
    if (!config) return [];
    return config.rules.filter(r => {
      const matchCat = !filterCat || r.category === filterCat;
      const q = search.toLowerCase();
      const matchSearch = !q
        || r.question?.toLowerCase().includes(q)
        || r.response?.toLowerCase().includes(q)
        || r.subcategory?.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [config, search, filterCat]);

  const save = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setSaveMsg(data.ok ? '保存しました ✓' : `エラー: ${data.error}`);
    } catch {
      setSaveMsg('保存に失敗しました');
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const openEdit = (rule) => {
    setEditRule(JSON.parse(JSON.stringify(rule)));
    setIsNew(false);
  };

  const openNew = () => {
    setEditRule(newRule());
    setIsNew(true);
  };

  const closeModal = () => setEditRule(null);

  const applyEdit = () => {
    if (!editRule.question.trim() || !editRule.response.trim()) {
      alert('質問と回答は必須です');
      return;
    }
    setConfig(prev => {
      const rules = isNew
        ? [...prev.rules, editRule]
        : prev.rules.map(r => r.id === editRule.id ? editRule : r);
      return { ...prev, rules };
    });
    closeModal();
  };

  const deleteRule = (id) => {
    if (!confirm('このルールを削除しますか？')) return;
    setConfig(prev => ({ ...prev, rules: prev.rules.filter(r => r.id !== id) }));
  };

  if (!config) {
    return <div className="admin-loading">読み込み中...</div>;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>FAQ管理画面</h1>
        <div className="admin-header-right">
          <span className="rule-count">{config.rules.length}件</span>
          {saveMsg && <span className="save-msg">{saveMsg}</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
          <a href="#/" className="btn btn-secondary">チャットへ</a>
        </div>
      </header>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="質問・回答で絞り込み..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="admin-filter"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="">全カテゴリ</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn btn-add" onClick={openNew}>＋ 新規追加</button>
      </div>

      <div className="admin-default-msg">
        <label>デフォルトメッセージ（未一致時）</label>
        <textarea
          rows={2}
          value={config.defaultMessage}
          onChange={e => setConfig(prev => ({ ...prev, defaultMessage: e.target.value }))}
        />
      </div>

      <div className="rule-table-wrap">
        <table className="rule-table">
          <thead>
            <tr>
              <th>#</th>
              <th>カテゴリ</th>
              <th>小カテゴリ</th>
              <th>質問</th>
              <th>人気</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rule, i) => (
              <tr key={rule.id}>
                <td className="td-num">{i + 1}</td>
                <td className="td-cat">{rule.category}</td>
                <td className="td-subcat">{rule.subcategory}</td>
                <td className="td-question">{rule.question}</td>
                <td className="td-popular">{rule.popular ? '⭐' : ''}</td>
                <td className="td-actions">
                  <button className="btn-edit" onClick={() => openEdit(rule)}>編集</button>
                  <button className="btn-delete" onClick={() => deleteRule(rule.id)}>削除</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="td-empty">該当するルールがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editRule && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isNew ? '新規ルール追加' : 'ルール編集'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <label>カテゴリ</label>
              <select
                value={editRule.category}
                onChange={e => setEditRule(r => ({ ...r, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <label>小カテゴリ</label>
              <input
                value={editRule.subcategory}
                onChange={e => setEditRule(r => ({ ...r, subcategory: e.target.value }))}
              />

              <label>質問 <span className="required">*</span></label>
              <input
                value={editRule.question}
                onChange={e => setEditRule(r => ({ ...r, question: e.target.value }))}
                placeholder="ユーザーが入力する質問文"
              />

              <label>回答 <span className="required">*</span></label>
              <textarea
                rows={6}
                value={editRule.response}
                onChange={e => setEditRule(r => ({ ...r, response: e.target.value }))}
                placeholder="チャットボットが返す回答"
              />

              <label>マッチングパターン（カンマ区切り）</label>
              <input
                value={editRule.patterns.join(', ')}
                onChange={e => setEditRule(r => ({
                  ...r,
                  patterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                }))}
                placeholder="退会, 退会方法, 辞める"
              />

              <label>関連グループ</label>
              <input
                value={editRule.related}
                onChange={e => setEditRule(r => ({ ...r, related: e.target.value }))}
              />

              <div className="modal-check-row">
                <label>
                  <input
                    type="checkbox"
                    checked={editRule.popular}
                    onChange={e => setEditRule(r => ({ ...r, popular: e.target.checked }))}
                  />
                  よく見られている質問（⭐）
                </label>
                <label>
                  優先度
                  <input
                    type="number"
                    className="input-priority"
                    value={editRule.priority}
                    onChange={e => setEditRule(r => ({ ...r, priority: Number(e.target.value) }))}
                  />
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>キャンセル</button>
              <button className="btn btn-primary" onClick={applyEdit}>
                {isNew ? '追加' : '更新'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
