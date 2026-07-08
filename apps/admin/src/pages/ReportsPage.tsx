import { useEffect, useState } from 'react';
import { adminApi, type ReportTicket } from '../api/client';

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportTicket[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await adminApi.listReports();
      setReports(res.list);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resolve = async (id: number, status: string) => {
    await adminApi.updateReport(id, status);
    await load();
  };

  return (
    <div>
      <h2>举报工单</h2>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>举报人</th>
              <th>被举报人</th>
              <th>房间</th>
              <th>类型</th>
              <th>状态</th>
              <th>时间</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.reporterUserId}</td>
                <td>{r.reportedUserId ?? '—'}</td>
                <td>{r.roomId ?? '—'}</td>
                <td>{r.category}</td>
                <td>{r.status}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>
                  {r.status === 'OPEN' && (
                    <button className="btn btn-primary" onClick={() => resolve(r.id, 'RESOLVED')}>
                      处理
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reports.length === 0 && <p className="muted">暂无举报工单</p>}
      </div>
    </div>
  );
}
