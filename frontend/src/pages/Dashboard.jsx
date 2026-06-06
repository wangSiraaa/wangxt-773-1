import { useState, useEffect } from 'react';
import { dashboardAPI } from '../api';

const statusLabels = {
  draft: '草稿',
  submitted: '已提交',
  evaluating: '评估中',
  evaluated: '评估完成',
  scheme_draft: '方案草拟',
  scheme_confirmed: '方案确认',
  objection: '异议处理中',
  contracting: '签约中',
  signed: '已签约',
  archived: '已归档'
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, actRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getRecentActivity()
      ]);
      setStats(statsRes.data);
      setActivities(actRes.data);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      <h2 className="page-title">进度看板</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">总户数</div>
          <div className="stat-value">{stats.totalHouses}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已签约</div>
          <div className="stat-value" style={{ color: '#52c41a' }}>{stats.totalSigned}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">签约率</div>
          <div className="stat-value" style={{ color: '#1890ff' }}>{stats.signingRate}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">待处理异议</div>
          <div className="stat-value" style={{ color: '#ff4d4f' }}>{stats.pendingObjections}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>签约进度</h3>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${stats.signingRate}%` }}></div>
        </div>
        <div style={{ textAlign: 'center', color: '#666', fontSize: 13 }}>
          已签约 {stats.totalSigned} / {stats.totalHouses} 户
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>各阶段分布</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {Object.entries(stats.statusBreakdown).map(([key, value]) => (
            <div key={key} style={{ 
              padding: 12, 
              background: '#f9f9f9', 
              borderRadius: 6,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>{value}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{statusLabels[key]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>最近动态</h3>
        {activities.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>暂无动态</div>
        ) : (
          activities.map(act => (
            <div key={act.id} className="audit-log">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{act.operator_name}</strong>
                <span className="audit-log-time">{act.created_at}</span>
              </div>
              <div style={{ marginTop: 4 }}>
                {act.house_code && <span style={{ color: '#1890ff' }}>[{act.house_code}]</span>}
                {' '}{act.action}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
