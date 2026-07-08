import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAdminKey } from '../api/client';

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAdminKey(key.trim());
    try {
      const res = await fetch('/api/v1/admin/users?q=', {
        headers: { Authorization: `Bearer ${key.trim()}` },
      });
      if (!res.ok) throw new Error('Invalid admin key');
      navigate('/');
    } catch {
      setError('Admin API Key 无效');
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={onSubmit}>
        <h2>运营后台登录</h2>
        <p className="muted">输入 ADMIN_API_KEY 以访问管理功能</p>
        <input
          type="password"
          placeholder="Admin API Key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          style={{ width: '100%', marginTop: 16 }}
        />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} type="submit">
          登录
        </button>
      </form>
    </div>
  );
}
