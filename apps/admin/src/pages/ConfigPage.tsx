import { useEffect, useState } from 'react';
import { adminApi, type SystemConfig } from '../api/client';

function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ display: 'block', width: '100%', marginTop: 4 }}
      />
    </label>
  );
}

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
      <h2>系统配置（v1.1 运营三板斧）</h2>
      {error && <p className="error">{error}</p>}
      {saved && <p style={{ color: '#81c784' }}>已保存</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>私人场</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
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
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Rake 与经济</h3>
        <NumField
          label="官方场 Rake 比例"
          value={config.officialRakeRate}
          step={0.01}
          onChange={(v) => setConfig({ ...config, officialRakeRate: v })}
        />
        <NumField
          label="私人场 Rake 比例"
          value={config.privateRakeRate}
          step={0.01}
          onChange={(v) => setConfig({ ...config, privateRakeRate: v })}
        />
        <NumField
          label="Bot 日亏损预算"
          value={config.botDailyBudget}
          onChange={(v) => setConfig({ ...config, botDailyBudget: v })}
        />
        <NumField
          label="每日充值上限（筹码）"
          value={config.dailyRechargeLimit}
          onChange={(v) => setConfig({ ...config, dailyRechargeLimit: v })}
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>首充活动</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={config.firstRechargeBonusEnabled}
            onChange={(e) => setConfig({ ...config, firstRechargeBonusEnabled: e.target.checked })}
          />
          首充赠送开启
        </label>
        <NumField
          label="首充赠送比例 (%)"
          value={config.firstRechargeBonusPct}
          onChange={(v) => setConfig({ ...config, firstRechargeBonusPct: v })}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <input
            type="checkbox"
            checked={config.newbieProtectionEnabled}
            onChange={(e) => setConfig({ ...config, newbieProtectionEnabled: e.target.checked })}
          />
          新手保护（7 天半 rake）
        </label>
        <NumField
          label="排行榜刷新间隔（分钟）"
          value={config.leaderboardRefreshMinutes}
          onChange={(v) => setConfig({ ...config, leaderboardRefreshMinutes: v })}
        />
      </div>

      <div className="card">
        <h3>公测迁移公告</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={config.betaMigrationActive}
            onChange={(e) => setConfig({ ...config, betaMigrationActive: e.target.checked })}
          />
          要求用户确认迁移公告后才能游戏
        </label>
        <label>
          中文公告
          <textarea
            rows={2}
            style={{ width: '100%', marginTop: 4 }}
            value={config.betaMigrationMessage['zh-CN'] ?? ''}
            onChange={(e) =>
              setConfig({
                ...config,
                betaMigrationMessage: { ...config.betaMigrationMessage, 'zh-CN': e.target.value },
              })
            }
          />
        </label>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={save}>
        保存配置
      </button>
    </div>
  );
}
