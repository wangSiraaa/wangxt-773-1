import { useState, useEffect } from 'react';
import { houseAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const statusLabels = {
  pending: '待归档',
  archived: '已归档',
  cancelled: '已取消'
};

const compensationTypeLabels = {
  money: '货币补偿',
  house: '产权调换',
  mixed: '混合补偿'
};

export default function ArchiveList() {
  const { user } = useAuth();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    evaluation_consistent: '',
    house_code: '',
    owner_name: ''
  });
  const [selectedRows, setSelectedRows] = useState([]);
  const [batchRemark, setBatchRemark] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [consistencyData, setConsistencyData] = useState([]);

  useEffect(() => {
    loadData();
    if (user.role === 'handler' || user.role === 'legal') {
      loadConsistencyData();
    }
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.evaluation_consistent !== '') params.evaluation_consistent = filters.evaluation_consistent === '1';
      if (filters.house_code) params.house_code = filters.house_code;
      if (filters.owner_name) params.owner_name = filters.owner_name;

      const res = await houseAPI.getArchives(params);
      setArchives(res.data);
    } catch (err) {
      console.error('加载归档列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadConsistencyData = async () => {
    try {
      const res = await houseAPI.getArchivesConsistency({ status: 'signed' });
      setConsistencyData(res.data);
    } catch (err) {
      console.error('加载一致性检查失败:', err);
    }
  };

  const handleArchive = async (houseId) => {
    if (!window.confirm('确认要归档该房屋台账吗？')) return;
    try {
      const remark = prompt('请输入归档备注（可选）：') || '';
      await houseAPI.createArchive(houseId, { remark });
      alert('归档成功！');
      loadData();
      loadConsistencyData();
    } catch (err) {
      alert(err.response?.data?.error || '归档失败');
    }
  };

  const handleBatchArchive = async () => {
    if (selectedRows.length === 0) {
      alert('请选择要归档的房屋');
      return;
    }
    try {
      const res = await houseAPI.batchArchive({
        house_ids: selectedRows,
        remark: batchRemark
      });
      const { success, failed } = res.data.results;
      alert(`批量归档完成：成功 ${success.length} 条，失败 ${failed.length} 条`);
      if (failed.length > 0) {
        console.log('失败详情:', failed);
      }
      setShowBatchModal(false);
      setSelectedRows([]);
      setBatchRemark('');
      loadData();
      loadConsistencyData();
    } catch (err) {
      alert(err.response?.data?.error || '批量归档失败');
    }
  };

  const toggleRow = (houseId) => {
    setSelectedRows(prev => 
      prev.includes(houseId) 
        ? prev.filter(id => id !== houseId)
        : [...prev, houseId]
    );
  };

  const toggleAll = () => {
    const eligibleIds = consistencyData
      .filter(item => item.can_archive)
      .map(item => item.house_id);
    
    if (selectedRows.length === eligibleIds.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(eligibleIds);
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      <h2 className="page-title">台账归档</h2>

      {(user.role === 'handler' || user.role === 'legal') && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>待归档房屋（已签约）</h3>
          
          {consistencyData.length === 0 ? (
            <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>暂无待归档的房屋</div>
          ) : (
            <>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <label>
                    <input 
                      type="checkbox" 
                      checked={selectedRows.length === consistencyData.filter(item => item.can_archive).length && consistencyData.filter(item => item.can_archive).length > 0}
                      onChange={toggleAll}
                      style={{ marginRight: 8 }}
                    />
                    全选可归档项
                  </label>
                  <span style={{ marginLeft: 16, color: '#666' }}>
                    已选择 {selectedRows.length} 项
                  </span>
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowBatchModal(true)}
                  disabled={selectedRows.length === 0}
                >
                  批量归档
                </button>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>房屋编号</th>
                    <th>产权人</th>
                    <th>状态</th>
                    <th>评估一致性</th>
                    <th>可归档</th>
                    <th>阻挡原因</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {consistencyData.map(item => (
                    <tr key={item.house_id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(item.house_id)}
                          onChange={() => toggleRow(item.house_id)}
                          disabled={!item.can_archive}
                        />
                      </td>
                      <td>{item.house_code}</td>
                      <td>{item.owner_name}</td>
                      <td><span className={`status-badge status-${item.status}`}>{item.status === 'signed' ? '已签约' : item.status}</span></td>
                      <td>
                        {item.evaluation_consistent ? (
                          <span style={{ color: '#52c41a' }}>✓ 一致</span>
                        ) : (
                          <span style={{ color: '#faad14' }}>⚠ 不一致</span>
                        )}
                      </td>
                      <td>
                        {item.can_archive ? (
                          <span style={{ color: '#52c41a' }}>是</span>
                        ) : (
                          <span style={{ color: '#ff4d4f' }}>否</span>
                        )}
                      </td>
                      <td style={{ color: '#ff4d4f' }}>{item.archive_block_reason || '-'}</td>
                      <td>
                        {item.can_archive && (
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={() => handleArchive(item.house_id)}
                          >
                            归档
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>筛选条件</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">归档状态</label>
            <select 
              className="form-select" 
              value={filters.status} 
              onChange={e => setFilters({...filters, status: e.target.value})}
            >
              <option value="">全部</option>
              <option value="archived">已归档</option>
              <option value="pending">待归档</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">评估一致性</label>
            <select 
              className="form-select" 
              value={filters.evaluation_consistent} 
              onChange={e => setFilters({...filters, evaluation_consistent: e.target.value})}
            >
              <option value="">全部</option>
              <option value="1">一致</option>
              <option value="0">不一致</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">房屋编号</label>
            <input 
              type="text" 
              className="form-input" 
              value={filters.house_code} 
              onChange={e => setFilters({...filters, house_code: e.target.value})}
              placeholder="输入房屋编号搜索"
            />
          </div>
          <div className="form-group">
            <label className="form-label">产权人</label>
            <input 
              type="text" 
              className="form-input" 
              value={filters.owner_name} 
              onChange={e => setFilters({...filters, owner_name: e.target.value})}
              placeholder="输入产权人搜索"
            />
          </div>
        </div>
        <button className="btn btn-default" onClick={loadData}>查询</button>
        <button className="btn btn-default" style={{ marginLeft: 8 }} onClick={() => {
          setFilters({ status: '', evaluation_consistent: '', house_code: '', owner_name: '' });
        }}>重置</button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 16 }}>归档记录列表</h3>
        {archives.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>暂无归档记录</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>归档编号</th>
                <th>房屋编号</th>
                <th>产权人</th>
                <th>地址</th>
                <th>面积(㎡)</th>
                <th>合同编号</th>
                <th>评估总价(元)</th>
                <th>方案总价(元)</th>
                <th>补偿方式</th>
                <th>评估一致</th>
                <th>归档类型</th>
                <th>状态</th>
                <th>创建人</th>
                <th>归档时间</th>
              </tr>
            </thead>
            <tbody>
              {archives.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.archive_no}</td>
                  <td>{a.house_code}</td>
                  <td>{a.owner_name}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.address}</td>
                  <td>{a.area}</td>
                  <td>{a.contract_no}</td>
                  <td style={{ color: '#1890ff' }}>{a.eval_total_price?.toLocaleString()}</td>
                  <td style={{ color: '#52c41a' }}>{a.scheme_total?.toLocaleString()}</td>
                  <td>{compensationTypeLabels[a.compensation_type]}</td>
                  <td>
                    {a.evaluation_consistent ? (
                      <span style={{ color: '#52c41a' }}>✓</span>
                    ) : (
                      <span style={{ color: '#faad14' }}>⚠</span>
                    )}
                  </td>
                  <td>{a.archive_type === 'batch' ? '批量归档' : '单条归档'}</td>
                  <td><span className={`status-badge status-${a.status === 'archived' ? 'signed' : a.status}`}>
                    {statusLabels[a.status]}
                  </span></td>
                  <td>{a.creator_name}</td>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>批量归档</h3>
            <p style={{ marginBottom: 16 }}>
              已选择 <strong style={{ color: '#1890ff' }}>{selectedRows.length}</strong> 项进行归档
            </p>
            <div className="form-group">
              <label className="form-label">归档备注（可选）</label>
              <textarea 
                className="form-textarea" 
                value={batchRemark}
                onChange={e => setBatchRemark(e.target.value)}
                placeholder="请输入备注信息..."
              />
            </div>
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button className="btn btn-default" onClick={() => setShowBatchModal(false)}>取消</button>
              <button className="btn btn-primary" style={{ marginLeft: 8 }} onClick={handleBatchArchive}>确认归档</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
