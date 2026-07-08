import { useEffect, useState } from 'react';
import { adminApi, type AdminHand } from '../api/client';

export default function HandsPage() {
  const [roomId, setRoomId] = useState('');
  const [hands, setHands] = useState<AdminHand[]>([]);
  const [selected, setSelected] = useState<AdminHand | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const res = await adminApi.listHands(roomId || undefined);
      setHands(res.list);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (handId: string) => {
    const hand = await adminApi.getHand(handId);
    setSelected(hand);
  };

  return (
    <div>
      <h2>手牌查询</h2>
      <div className="card row">
        <input
          placeholder="按 roomId 筛选（可选）"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={load}>
          刷新
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Hand ID</th>
              <th>Room</th>
              <th>类型</th>
              <th>底池</th>
              <th>Rake</th>
              <th>时间</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {hands.map((h) => (
              <tr key={h.handId}>
                <td>{h.handId}</td>
                <td>{h.roomId}</td>
                <td>{h.roomType}</td>
                <td>{h.potSize}</td>
                <td>{h.rakeAmount}</td>
                <td>{new Date(h.createdAt).toLocaleString()}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => open(h.handId)}>
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="card">
          <h3>{selected.handId}</h3>
          <p className="muted">
            Board: {selected.boardCards ?? '—'} | Pot: {selected.potSize} | Rake: {selected.rakeAmount}
          </p>
          <h4>Winners</h4>
          <pre className="json">{JSON.stringify(selected.winners, null, 2)}</pre>
          <h4>Actions</h4>
          <pre className="json">{JSON.stringify(selected.actions, null, 2)}</pre>
          <h4>Players</h4>
          <pre className="json">{JSON.stringify(selected.playerSnapshot, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
