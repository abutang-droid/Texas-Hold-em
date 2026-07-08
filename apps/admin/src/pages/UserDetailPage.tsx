import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi, type AdminHand, type AdminUser } from '../api/client';

interface ChipTx {
  id: number;
  amount: number;
  balanceAfter: number;
  type: string;
  referenceId: string;
  createdAt: string;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const [user, setUser] = useState<AdminUser & { adminRemark?: string; deviceId?: string } | null>(
    null,
  );
  const [transactions, setTransactions] = useState<ChipTx[]>([]);
  const [hands, setHands] = useState<AdminHand[]>([]);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    if (!Number.isFinite(userId)) return;
    adminApi
      .getUserDetail(userId)
      .then((data) => {
        setUser(data.user);
        setRemark(data.user.adminRemark ?? '');
        setTransactions(data.transactions);
        setHands(data.recentHands);
      })
      .catch((e) => setError((e as Error).message));
  };

  useEffect(load, [userId]);

  const saveRemark = async () => {
    await adminApi.setUserRemark(userId, remark);
    load();
  };

  if (error) return <p className="error">{error}</p>;
  if (!user) return <p className="muted">加载中...</p>;

  return (
    <div>
      <Link to="/" className="muted">
        ← 用户列表
      </Link>
      <h2>
        {user.nickname} <span className="muted">#{user.id}</span>
      </h2>
      <div className="row">
        <div className="card">
          <p>筹码: {user.chipsBalance}</p>
          <p>等级: Lv.{user.level}</p>
          <p>状态: {user.status}</p>
          <p className="muted">设备: {user.deviceId ?? '-'}</p>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h3>运营备注</h3>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <button className="btn btn-primary" onClick={saveRemark}>
            保存备注
          </button>
        </div>
      </div>

      <h3>筹码流水（最近 50 条）</h3>
      <table className="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>类型</th>
            <th>变动</th>
            <th>余额</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.createdAt).toLocaleString()}</td>
              <td>{t.type}</td>
              <td>{t.amount}</td>
              <td>{t.balanceAfter}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>最近 10 手</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Hand ID</th>
            <th>房间</th>
            <th>底池</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          {hands.map((h) => (
            <tr key={h.handId}>
              <td>
                <Link to={`/hands?hand=${h.handId}`}>{h.handId}</Link>
              </td>
              <td>{h.roomId}</td>
              <td>{h.potSize}</td>
              <td>{new Date(h.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
