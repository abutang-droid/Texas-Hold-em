import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearAdminKey, getAdminKey } from '../api/client';

export function Layout() {
  const navigate = useNavigate();
  if (!getAdminKey()) {
    navigate('/login');
    return null;
  }

  const logout = () => {
    clearAdminKey();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>TH Admin</h1>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/">
          用户管理
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/hands">
          手牌查询
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/config">
          系统配置
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/reports">
          举报工单
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/economy">
          经济看板
        </NavLink>
        <button className="btn btn-secondary" style={{ marginTop: 24, width: '100%' }} onClick={logout}>
          退出
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
