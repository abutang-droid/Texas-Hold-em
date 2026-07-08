import { useEffect, useState } from 'react';
import { adminApi, type SystemConfig } from '../api/client';

export default function ConfigPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi
      .getConfig()
      .then(setConfig)
      .catch((e) => setError((e as Error).message));
  }, []);

  const save = async () => {
    if (!config) return;
    setError('');
    setSaved(false);
    try {
      const updated = await adminApi.updateConfig(config);
      setConfig(updated);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!config) return <p className="muted">加载中...</p>;

  return (
    <div>
      <h2>系统配置</h2>
      {error && <p className="error">{error}</p>}
      {saved && <p style={{ color: '#81c784' }}>已保存</p>}
      <div className="card">
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={config.privateRoomEnabled}
            onChange={(e) => setConfig({ ...config, privateRoomEnabled: e.target.checked })}
          />
          私人场功能开启
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="checkbox"
            checked={config.privateRoomGlobalPause}
            onChange={(e) => setConfig({ ...config, privateRoomGlobalPause: e.target.checked })}
          />
          全局暂停开房（应急开关）
        </label>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={save}>
          保存配置
        </button>
      </div>
    </div>
  );
}
