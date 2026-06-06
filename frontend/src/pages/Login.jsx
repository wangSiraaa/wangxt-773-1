import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (user) => {
    setUsername(user);
    setPassword('123456');
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">城市更新居民签约系统</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">用户名</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
            />
          </div>
          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>
          {error && <div style={{ color: '#ff4d4f', marginBottom: 16 }}>{error}</div>}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px' }}
            disabled={loading}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>快速登录（默认密码 123456）：</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { user: 'resident1', label: '居民' },
              { user: 'evaluator1', label: '评估' },
              { user: 'handler1', label: '经办' },
              { user: 'legal1', label: '法务' }
            ].map(item => (
              <button
                key={item.user}
                type="button"
                className="btn btn-default"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => quickLogin(item.user)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
