import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { houseAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const statusLabels = {
  draft: '草稿', submitted: '已提交', evaluating: '评估中',
  evaluated: '评估完成', scheme_draft: '方案草拟',
  scheme_confirmed: '方案确认', objection: '异议处理中',
  contracting: '签约中', signed: '已签约', archived: '已归档'
};

const objectionTypeLabels = {
  evaluation: '评估异议', scheme: '方案异议', other: '其他异议'
};

const objectionStatusLabels = {
  pending: '待处理', processing: '处理中', resolved: '已解决', rejected: '已驳回'
};

export default function HouseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [house, setHouse] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [objections, setObjections] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [evalForm, setEvalForm] = useState({
    base_price: '', structure_price: '', decoration_price: '',
    auxiliary_price: '', other_price: '', remark: ''
  });
  const [schemeForm, setSchemeForm] = useState({
    compensation_type: 'money', money_amount: '', house_area: '',
    house_location: '', transition_fee: '', move_fee: '', reward_amount: ''
  });
  const [objForm, setObjForm] = useState({ type: 'scheme', content: '' });

  useEffect(() => {
    loadAllData();
  }, [id]);

  const loadAllData = async () => {
    try {
      const [houseRes, evalRes, schemeRes, objRes, contractRes, logRes] = await Promise.all([
        houseAPI.getById(id),
        houseAPI.getEvaluations(id),
        houseAPI.getSchemes(id),
        houseAPI.getObjections(id),
        houseAPI.getContracts(id),
        houseAPI.getAuditLogs(id)
      ]);
      setHouse(houseRes.data);
      setEvaluations(evalRes.data);
      setSchemes(schemeRes.data);
      setObjections(objRes.data);
      setContracts(contractRes.data);
      setAuditLogs(logRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvaluation = async (e) => {
    e.preventDefault();
    try {
      const data = {
        base_price: parseFloat(evalForm.base_price) || 0,
        structure_price: parseFloat(evalForm.structure_price) || 0,
        decoration_price: parseFloat(evalForm.decoration_price) || 0,
        auxiliary_price: parseFloat(evalForm.auxiliary_price) || 0,
        other_price: parseFloat(evalForm.other_price) || 0,
        remark: evalForm.remark
      };
      await houseAPI.createEvaluation(id, data);
      setEvalForm({ base_price: '', structure_price: '', decoration_price: '', auxiliary_price: '', other_price: '', remark: '' });
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  const handleEvalStatus = async (evalId, status) => {
    try {
      await houseAPI.updateEvaluationStatus(evalId, status);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const handleCreateScheme = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...schemeForm,
        money_amount: parseFloat(schemeForm.money_amount) || 0,
        house_area: parseFloat(schemeForm.house_area) || 0,
        transition_fee: parseFloat(schemeForm.transition_fee) || 0,
        move_fee: parseFloat(schemeForm.move_fee) || 0,
        reward_amount: parseFloat(schemeForm.reward_amount) || 0
      };
      await houseAPI.createScheme(id, data);
      setSchemeForm({
        compensation_type: 'money', money_amount: '', house_area: '',
        house_location: '', transition_fee: '', move_fee: '', reward_amount: ''
      });
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  const handleSchemeStatus = async (schemeId, status) => {
    try {
      await houseAPI.updateSchemeStatus(schemeId, status);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const handleCreateObjection = async (e) => {
    e.preventDefault();
    try {
      await houseAPI.createObjection(id, objForm);
      setObjForm({ type: 'scheme', content: '' });
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  const handleObjectionUpdate = async (objId, data) => {
    try {
      await houseAPI.updateObjection(objId, data);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const handleCreateContract = async (schemeId) => {
    try {
      await houseAPI.createContract(id, { scheme_id: schemeId });
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  const handleContractStatus = async (contractId, status) => {
    try {
      await houseAPI.updateContractStatus(contractId, status);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  if (loading) return <div>加载中...</div>;
  if (!house) return <div>房屋不存在</div>;

  const tabs = [
    { key: 'info', label: '房屋信息' },
    { key: 'evaluation', label: '评估管理' },
    { key: 'scheme', label: '补偿方案' },
    { key: 'objection', label: '异议处理' },
    { key: 'contract', label: '签约归档' },
    { key: 'audit', label: '审计日志' }
  ];

  const hasActiveObjection = objections.some(o => ['pending', 'processing'].includes(o.status) && o.freeze_contract === 1);
  const confirmedEval = evaluations.find(e => e.status === 'confirmed');
  const confirmedScheme = schemes.find(s => s.status === 'confirmed');
  const signedContract = contracts.find(c => c.status === 'signed');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <button className="btn btn-default" onClick={() => navigate('/houses')} style={{ marginRight: 12 }}>← 返回</button>
          <span style={{ fontSize: 20, fontWeight: 600 }}>{house.house_code} - {house.owner_name}</span>
          <span className={`status-badge status-${house.status}`} style={{ marginLeft: 12 }}>{statusLabels[house.status]}</span>
        </div>
        {hasActiveObjection && (
          <span style={{ color: '#ff4d4f', fontWeight: 600 }}>⚠️ 异议处理中，签约冻结</span>
        )}
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map(tab => (
            <div
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {activeTab === 'info' && (
          <div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">房屋编号</label>
                <div style={{ padding: '8px 0' }}>{house.house_code}</div>
              </div>
              <div className="form-group">
                <label className="form-label">产权人</label>
                <div style={{ padding: '8px 0' }}>{house.owner_name}</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">身份证号</label>
                <div style={{ padding: '8px 0' }}>{house.id_card}</div>
              </div>
              <div className="form-group">
                <label className="form-label">联系电话</label>
                <div style={{ padding: '8px 0' }}>{house.phone}</div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">房屋地址</label>
              <div style={{ padding: '8px 0' }}>{house.address}</div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">建筑面积</label>
                <div style={{ padding: '8px 0' }}>{house.area} ㎡</div>
              </div>
              <div className="form-group">
                <label className="form-label">建筑结构</label>
                <div style={{ padding: '8px 0' }}>{house.structure_type || '-'}</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">建成年份</label>
                <div style={{ padding: '8px 0' }}>{house.build_year || '-'}</div>
              </div>
              <div className="form-group">
                <label className="form-label">附属物</label>
                <div style={{ padding: '8px 0' }}>{house.auxiliaries || '-'}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evaluation' && (
          <div>
            {user.role === 'evaluator' && ['submitted', 'evaluating', 'evaluated'].includes(house.status) && (
              <div className="card" style={{ background: '#f9f9f9', marginBottom: 20 }}>
                <h4 style={{ marginBottom: 12 }}>新增评估版本</h4>
                <form onSubmit={handleCreateEvaluation}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">基础单价(元)</label>
                      <input type="number" className="form-input" value={evalForm.base_price} onChange={e => setEvalForm({...evalForm, base_price: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">结构补偿(元)</label>
                      <input type="number" className="form-input" value={evalForm.structure_price} onChange={e => setEvalForm({...evalForm, structure_price: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">装修补偿(元)</label>
                      <input type="number" className="form-input" value={evalForm.decoration_price} onChange={e => setEvalForm({...evalForm, decoration_price: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">附属物补偿(元)</label>
                      <input type="number" className="form-input" value={evalForm.auxiliary_price} onChange={e => setEvalForm({...evalForm, auxiliary_price: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">其他补偿(元)</label>
                    <input type="number" className="form-input" value={evalForm.other_price} onChange={e => setEvalForm({...evalForm, other_price: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">备注</label>
                    <textarea className="form-textarea" value={evalForm.remark} onChange={e => setEvalForm({...evalForm, remark: e.target.value})} />
                  </div>
                  <button type="submit" className="btn btn-primary">创建评估</button>
                </form>
              </div>
            )}

            <h4 style={{ marginBottom: 12 }}>评估版本列表</h4>
            {evaluations.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>暂无评估记录</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>版本</th>
                    <th>总价(元)</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map(e => (
                    <tr key={e.id}>
                      <td>V{e.version}</td>
                      <td style={{ fontWeight: 600, color: '#1890ff' }}>{e.total_price.toLocaleString()}</td>
                      <td><span className={`status-badge status-${e.status === 'confirmed' ? 'signed' : e.status === 'rejected' ? 'objection' : 'evaluating'}`}>
                        {e.status === 'confirmed' ? '已确认' : e.status === 'rejected' ? '已驳回' : e.status === 'submitted' ? '已提交' : '草稿'}
                      </span></td>
                      <td>{new Date(e.created_at).toLocaleString()}</td>
                      <td>
                        {e.status === 'draft' && user.role === 'evaluator' && (
                          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleEvalStatus(e.id, 'submitted')}>提交</button>
                        )}
                        {e.status === 'submitted' && (user.role === 'evaluator' || user.role === 'handler') && (
                          <>
                            <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleEvalStatus(e.id, 'confirmed')}>确认</button>
                            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleEvalStatus(e.id, 'rejected')}>驳回</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'scheme' && (
          <div>
            {user.role === 'handler' && ['evaluated', 'scheme_draft', 'scheme_confirmed'].includes(house.status) && !signedContract && (
              <div className="card" style={{ background: '#f9f9f9', marginBottom: 20 }}>
                <h4 style={{ marginBottom: 12 }}>生成补偿方案</h4>
                {!confirmedEval && (
                  <div style={{ color: '#ff4d4f', marginBottom: 12 }}>⚠️ 请先确认评估版本后再生成方案</div>
                )}
                <form onSubmit={handleCreateScheme}>
                  <div className="form-group">
                    <label className="form-label">补偿方式</label>
                    <select className="form-select" value={schemeForm.compensation_type} onChange={e => setSchemeForm({...schemeForm, compensation_type: e.target.value})}>
                      <option value="money">货币补偿</option>
                      <option value="house">产权调换</option>
                      <option value="mixed">混合补偿</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">货币金额(元)</label>
                      <input type="number" className="form-input" value={schemeForm.money_amount} onChange={e => setSchemeForm({...schemeForm, money_amount: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">安置面积(㎡)</label>
                      <input type="number" className="form-input" value={schemeForm.house_area} onChange={e => setSchemeForm({...schemeForm, house_area: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">安置地点</label>
                    <input className="form-input" value={schemeForm.house_location} onChange={e => setSchemeForm({...schemeForm, house_location: e.target.value})} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">过渡费(元)</label>
                      <input type="number" className="form-input" value={schemeForm.transition_fee} onChange={e => setSchemeForm({...schemeForm, transition_fee: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">搬家费(元)</label>
                      <input type="number" className="form-input" value={schemeForm.move_fee} onChange={e => setSchemeForm({...schemeForm, move_fee: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">奖励金额(元)</label>
                    <input type="number" className="form-input" value={schemeForm.reward_amount} onChange={e => setSchemeForm({...schemeForm, reward_amount: e.target.value})} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={!confirmedEval}>生成方案</button>
                </form>
              </div>
            )}

            <h4 style={{ marginBottom: 12 }}>方案版本列表</h4>
            {schemes.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>暂无方案记录</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>版本</th>
                    <th>补偿方式</th>
                    <th>总金额(元)</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {schemes.map(s => (
                    <tr key={s.id}>
                      <td>V{s.version}</td>
                      <td>{s.compensation_type === 'money' ? '货币补偿' : s.compensation_type === 'house' ? '产权调换' : '混合补偿'}</td>
                      <td style={{ fontWeight: 600, color: '#52c41a' }}>{s.total_amount.toLocaleString()}</td>
                      <td><span className={`status-badge status-${s.status === 'confirmed' ? 'signed' : s.status === 'modified' ? 'objection' : 'evaluating'}`}>
                        {s.status === 'confirmed' ? '已确认' : s.status === 'modified' ? '已修改需重签' : s.status === 'submitted' ? '已提交' : '草稿'}
                      </span></td>
                      <td>
                        {s.status === 'draft' && user.role === 'handler' && (
                          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleSchemeStatus(s.id, 'submitted')}>提交</button>
                        )}
                        {s.status === 'submitted' && (user.role === 'handler' || user.role === 'legal') && (
                          <>
                            <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleSchemeStatus(s.id, 'confirmed')}>确认</button>
                            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleSchemeStatus(s.id, 'rejected')}>驳回</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'objection' && (
          <div>
            {(user.role === 'resident' || user.role === 'legal') && !signedContract && (
              <div className="card" style={{ background: '#f9f9f9', marginBottom: 20 }}>
                <h4 style={{ marginBottom: 12 }}>提交异议</h4>
                <form onSubmit={handleCreateObjection}>
                  <div className="form-group">
                    <label className="form-label">异议类型</label>
                    <select className="form-select" value={objForm.type} onChange={e => setObjForm({...objForm, type: e.target.value})}>
                      <option value="evaluation">评估异议</option>
                      <option value="scheme">方案异议</option>
                      <option value="other">其他异议</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">异议内容</label>
                    <textarea className="form-textarea" value={objForm.content} onChange={e => setObjForm({...objForm, content: e.target.value})} required />
                  </div>
                  <button type="submit" className="btn btn-warning">提交异议</button>
                </form>
              </div>
            )}

            <h4 style={{ marginBottom: 12 }}>异议记录</h4>
            {objections.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>暂无异议记录</div>
            ) : (
              objections.map(o => (
                <div key={o.id} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong>{objectionTypeLabels[o.type]}</strong>
                    <span className={`status-badge status-${o.status === 'resolved' ? 'signed' : o.status === 'rejected' ? 'archived' : 'objection'}`}>
                      {objectionStatusLabels[o.status]}
                    </span>
                  </div>
                  <div style={{ marginBottom: 8 }}>{o.content}</div>
                  {o.handler_remark && <div style={{ color: '#666', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>处理意见：{o.handler_remark}</div>}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                    {new Date(o.created_at).toLocaleString()}
                    {o.freeze_contract === 1 && ' · 冻结签约'}
                  </div>
                  {user.role === 'legal' && ['pending', 'processing'].includes(o.status) && (
                    <div style={{ marginTop: 12 }}>
                      <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleObjectionUpdate(o.id, { status: 'processing' })}>开始处理</button>
                      <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => {
                        const remark = prompt('请输入处理意见：');
                        if (remark) handleObjectionUpdate(o.id, { status: 'resolved', handler_remark: remark, freeze_contract: 0 });
                      }}>解决并解冻</button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => {
                        const remark = prompt('请输入驳回理由：');
                        if (remark) handleObjectionUpdate(o.id, { status: 'rejected', handler_remark: remark, freeze_contract: 0 });
                      }}>驳回</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'contract' && (
          <div>
            {confirmedScheme && !signedContract && (user.role === 'handler' || user.role === 'legal') && (
              <div style={{ marginBottom: 20 }}>
                {hasActiveObjection ? (
                  <div className="card" style={{ background: '#fff1f0', color: '#ff4d4f' }}>
                    ⚠️ 存在未解决的异议，暂时无法签约
                  </div>
                ) : (
                  <button className="btn btn-success" onClick={() => handleCreateContract(confirmedScheme.id)}>
                    + 创建签约合同
                  </button>
                )}
              </div>
            )}

            {signedContract && (
              <div className="card" style={{ background: '#f6ffed', border: '1px solid #b7eb8f', marginBottom: 20 }}>
                <strong style={{ color: '#52c41a' }}>✓ 已完成签约</strong>
                <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                  合同编号：{signedContract.contract_no}
                  <br />签约时间：{new Date(signedContract.sign_date).toLocaleString()}
                </div>
              </div>
            )}

            <h4 style={{ marginBottom: 12 }}>合同列表</h4>
            {contracts.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>暂无合同记录</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>合同编号</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map(c => (
                    <tr key={c.id}>
                      <td>{c.contract_no}</td>
                      <td>{c.type === 'main' ? '主合同' : '补充协议'}</td>
                      <td><span className={`status-badge status-${c.status === 'signed' ? 'signed' : c.status === 'frozen' ? 'objection' : 'evaluating'}`}>
                        {c.status === 'signed' ? '已签约' : c.status === 'frozen' ? '已冻结' : c.status === 'archived' ? '已归档' : '待签约'}
                      </span></td>
                      <td>{new Date(c.created_at).toLocaleString()}</td>
                      <td>
                        {c.status === 'pending' && (user.role === 'handler' || user.role === 'legal') && (
                          <>
                            <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleContractStatus(c.id, 'signed')}>确认签约</button>
                            {user.role === 'legal' && (
                              <button className="btn btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleContractStatus(c.id, 'frozen')}>冻结</button>
                            )}
                          </>
                        )}
                        {c.status === 'signed' && user.role === 'legal' && (
                          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleContractStatus(c.id, 'archived')}>归档</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            {auditLogs.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>暂无审计日志</div>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="audit-log">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{log.operator_name}</strong>
                    <span className="audit-log-time">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className="role-tag">{log.operator_role}</span>
                    {' '}{log.action}
                  </div>
                  {log.new_value && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#52c41a' }}>
                      新值：{log.new_value.substring(0, 100)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
