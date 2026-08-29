import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi, type AdminUser } from '../api/client';

interface ChipTx {
  id: number;
  amount: number;
  balanceAfter: number;
  type: string;
  referenceId: string;
  createdAt: string;
}

type DetailUser = AdminUser & {
  adminRemark?: string;
  deviceId?: string;
  email?: string | null;
  privateRoomPermission?: boolean;
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const [user, setUser] = useState<DetailUser | null>(null);
  const [transactions, setTransactions] = useState<ChipTx[]>([]);
  const [hands, setHands] = useState<Awaited<ReturnType<typeof adminApi.getUserDetail>>['recentHands']>([]);
  const [remark, setRemark] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    if (!Number.isFinite(userId)) return;
    adminApi
      .getUserDetail(userId)
      .then((data) => {
        setUser(data.user);
        setRemark(data.user.adminRemark ?? '');
        setNickname(data.user.nickname);
        setAvatarUrl(data.user.avatarUrl ?? 'preset:spade');
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

  const saveProfile = async () => {
    await adminApi.updateUserProfile(userId, { nickname, avatarUrl });
    load();
  };

  const togglePrivate = async () => {
    await adminApi.setPrivatePermission(userId, !user?.privateRoomPermission);
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
          <p>邮箱: {user.email ?? '-'}</p>
          <p>头像: {user.avatarUrl ?? '-'}</p>
          <p>私人场权限: {user.privateRoomPermission ? '已开通' : '未开通'}</p>
          <p className="muted">设备: {user.deviceId ?? '-'}</p>
          <button className="btn" onClick={togglePrivate}>
            {user.privateRoomPermission ? '撤销私人场权限' : '授予私人场权限'}
          </button>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h3>资料编辑</h3>
          <label>
            昵称
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            头像 preset URL
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} style={{ width: '100%' }} />
          </label>
          <p className="muted">例: preset:spade / preset:heart</p>
          <button className="btn btn-primary" onClick={saveProfile} style={{ marginTop: 8 }}>
            保存资料
          </button>
          <h3 style={{ marginTop: 16 }}>运营备注</h3>
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
            <th>参考</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>{new Date(tx.createdAt).toLocaleString()}</td>
              <td>{tx.type}</td>
              <td>{tx.amount}</td>
              <td>{tx.balanceAfter}</td>
              <td>{tx.referenceId}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>最近手牌</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Hand</th>
            <th>Room</th>
            <th>Pot</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          {hands.map((h) => (
            <tr key={h.handId}>
              <td>
                <Link to={`/hands/${h.handId}`}>{h.handId}</Link>
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
