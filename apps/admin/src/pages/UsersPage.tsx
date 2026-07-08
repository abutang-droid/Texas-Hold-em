import { useState } from 'react';
import { adminApi, type AdminUser } from '../api/client';

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'BANNED' ? 'badge-banned' : status === 'FROZEN' ? 'badge-frozen' : 'badge-active';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adjust, setAdjust] = useState<Record<number, string>>({});
  const [reason, setReason] = useState<Record<number, string>>({});

  const search = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.searchUsers(q);
      setUsers(res.list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const ban = async (id: number, status: 'BANNED' | 'FROZEN' | 'ACTIVE') => {
    await adminApi.banUser(id, status);
    await search();
  };

  const doAdjust = async (id: number) => {
    const amount = Number(adjust[id]);
    if (!Number.isFinite(amount) || amount === 0) return;
    await adminApi.adjustChips(id, amount, reason[id] ?? 'admin adjust');
    await search();
  };

  return (
    <div>
      <h2>用户管理</h2>
      <div className="card row">
        <input
          placeholder="搜索 ID / 昵称 / deviceId"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button className="btn btn-primary" onClick={search} disabled={loading}>
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>昵称</th>
              <th>筹码</th>
              <th>等级</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.nickname}</td>
                <td>{u.chipsBalance}</td>
                <td>Lv{u.level}</td>
                <td>
                  <StatusBadge status={u.status} />
                </td>
                <td>
                  <div className="row">
                    <button className="btn btn-danger" onClick={() => ban(u.id, 'BANNED')}>
                      封禁
                    </button>
                    <button className="btn btn-secondary" onClick={() => ban(u.id, 'FROZEN')}>
                      冻结
                    </button>
                    <button className="btn btn-secondary" onClick={() => ban(u.id, 'ACTIVE')}>
                      解冻
                    </button>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <input
                      type="number"
                      placeholder="±筹码"
                      value={adjust[u.id] ?? ''}
                      onChange={(e) => setAdjust({ ...adjust, [u.id]: e.target.value })}
                      style={{ width: 100 }}
                    />
                    <input
                      placeholder="原因"
                      value={reason[u.id] ?? ''}
                      onChange={(e) => setReason({ ...reason, [u.id]: e.target.value })}
                      style={{ width: 120 }}
                    />
                    <button className="btn btn-primary" onClick={() => doAdjust(u.id)}>
                      调账
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="muted">输入关键词搜索用户</p>}
      </div>
    </div>
  );
}
