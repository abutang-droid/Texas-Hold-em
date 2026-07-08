import { useEffect, useState } from 'react';
import { adminApi, type RiskAlert } from '../api/client';

export default function RiskPage() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .listRiskAlerts()
      .then((r) => setAlerts(r.list))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div>
      <h2>风控告警</h2>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>类型</th>
              <th>用户</th>
              <th>房间</th>
              <th>时间</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td>{a.alertType}</td>
                <td>{a.userId ?? '—'}</td>
                <td>{a.roomId ?? '—'}</td>
                <td>{new Date(a.createdAt).toLocaleString()}</td>
                <td>
                  <pre className="json" style={{ margin: 0 }}>
                    {JSON.stringify(a.detail)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {alerts.length === 0 && <p className="muted">暂无风控告警</p>}
      </div>
    </div>
  );
}
