import { useEffect, useState } from 'react';
import { adminApi, type EconomyStats } from '../api/client';

export default function EconomyPage() {
  const [stats, setStats] = useState<EconomyStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .getEconomy()
      .then(setStats)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="muted">加载中...</p>;

  const cards = [
    { label: '注册用户', value: stats.totalUsers },
    { label: '流通筹码', value: stats.totalChipsInCirculation },
    { label: '累计 Rake', value: stats.totalRakeCollected },
    { label: '总手牌数', value: stats.handsPlayed },
    { label: '活跃私人房', value: stats.privateRoomsActive },
    { label: 'Bot 净亏损', value: stats.botNetLoss },
    { label: '今日充值量', value: stats.rechargeVolumeToday },
  ];

  return (
    <div>
      <h2>经济看板</h2>
      <div className="row">
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ minWidth: 160 }}>
            <p className="muted">{c.label}</p>
            <h3 style={{ margin: '8px 0 0', color: '#c9a227' }}>{c.value.toLocaleString()}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
