import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { houseAPI } from '../api';
import { useAuth } from '../context/AuthContext';

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

export default function HouseList() {
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    house_code: '', owner_name: '', id_card: '', address: '',
    area: '', structure_type: '', build_year: '', phone: '', auxiliaries: ''
  });
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadHouses();
  }, []);

  const loadHouses = async () => {
    try {
      const res = await houseAPI.getAll();
      setHouses(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData, area: parseFloat(formData.area), build_year: parseInt(formData.build_year) || null };
      await houseAPI.create(data);
      setShowCreate(false);
      setFormData({ house_code: '', owner_name: '', id_card: '', address: '', area: '', structure_type: '', build_year: '', phone: '', auxiliaries: '' });
      loadHouses();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="page-title" style={{ margin: 0 }}>房屋管理</h2>
        {user.role === 'resident' && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 新建房屋档案</button>
        )}
      </div>

      {showCreate && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>新建房屋档案</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">房屋编号 *</label>
                <input className="form-input" value={formData.house_code} onChange={e => setFormData({...formData, house_code: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">产权人姓名 *</label>
                <input className="form-input" value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">身份证号 *</label>
                <input className="form-input" value={formData.id_card} onChange={e => setFormData({...formData, id_card: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">联系电话 *</label>
                <input className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">房屋地址 *</label>
              <input className="form-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">建筑面积(㎡) *</label>
                <input type="number" step="0.01" className="form-input" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">建筑结构</label>
                <select className="form-select" value={formData.structure_type} onChange={e => setFormData({...formData, structure_type: e.target.value})}>
                  <option value="">请选择</option>
                  <option value="钢混">钢混</option>
                  <option value="砖混">砖混</option>
                  <option value="砖木">砖木</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">建成年份</label>
                <input type="number" className="form-input" value={formData.build_year} onChange={e => setFormData({...formData, build_year: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">附属物说明</label>
                <input className="form-input" value={formData.auxiliaries} onChange={e => setFormData({...formData, auxiliaries: e.target.value})} placeholder="如：围墙、水井等" />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button type="button" className="btn btn-default" onClick={() => setShowCreate(false)} style={{ marginRight: 8 }}>取消</button>
              <button type="submit" className="btn btn-primary">提交</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>房屋编号</th>
              <th>产权人</th>
              <th>地址</th>
              <th>面积(㎡)</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {houses.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', color: '#888', padding: 40 }}>暂无数据</td></tr>
            ) : houses.map(house => (
              <tr key={house.id}>
                <td>{house.house_code}</td>
                <td>{house.owner_name}</td>
                <td>{house.address}</td>
                <td>{house.area}</td>
                <td><span className={`status-badge status-${house.status}`}>{statusLabels[house.status]}</span></td>
                <td>{new Date(house.created_at).toLocaleString()}</td>
                <td>
                  <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => navigate(`/houses/${house.id}`)}>查看详情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
