const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, execute } = require('../database');
const { authenticateToken: authenticate } = require('../middleware/auth');
const { audit } = require('../utils/audit');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const user = req.user;
  let houses;
  
  if (user.role === 'resident') {
    houses = query('SELECT * FROM houses WHERE created_by = ? ORDER BY created_at DESC', [user.id]);
  } else {
    houses = query('SELECT * FROM houses ORDER BY created_at DESC');
  }
  
  res.json(houses);
});

router.get('/:id', authenticate, (req, res) => {
  const { id } = req.params;
  
  const house = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  if (!house) {
    return res.status(404).json({ error: '房屋不存在' });
  }

  const evaluations = query('SELECT * FROM evaluations WHERE house_id = ? ORDER BY version DESC', [id]);
  const schemes = query('SELECT * FROM schemes WHERE house_id = ? ORDER BY version DESC', [id]);
  const objections = query('SELECT * FROM objections WHERE house_id = ? ORDER BY created_at DESC', [id]);
  const contracts = query('SELECT * FROM contracts WHERE house_id = ? ORDER BY created_at DESC', [id]);
  const logs = query('SELECT al.*, u.name as operator_name FROM audit_logs al LEFT JOIN users u ON al.operator_id = u.id WHERE al.house_id = ? ORDER BY al.created_at DESC LIMIT 50', [id]);

  res.json({
    house,
    evaluations,
    schemes,
    objections,
    contracts,
    auditLogs: logs
  });
});

router.get('/:id/evaluations', authenticate, (req, res) => {
  const { id } = req.params;
  const evaluations = query('SELECT * FROM evaluations WHERE house_id = ? ORDER BY version DESC', [id]);
  res.json(evaluations);
});

router.get('/:id/schemes', authenticate, (req, res) => {
  const { id } = req.params;
  const schemes = query('SELECT * FROM schemes WHERE house_id = ? ORDER BY version DESC', [id]);
  res.json(schemes);
});

router.get('/:id/objections', authenticate, (req, res) => {
  const { id } = req.params;
  const objections = query('SELECT * FROM objections WHERE house_id = ? ORDER BY created_at DESC', [id]);
  res.json(objections);
});

router.get('/:id/contracts', authenticate, (req, res) => {
  const { id } = req.params;
  const contracts = query('SELECT * FROM contracts WHERE house_id = ? ORDER BY created_at DESC', [id]);
  res.json(contracts);
});

router.get('/:id/audit-logs', authenticate, (req, res) => {
  const { id } = req.params;
  const logs = query('SELECT al.*, u.name as operator_name FROM audit_logs al LEFT JOIN users u ON al.operator_id = u.id WHERE al.house_id = ? ORDER BY al.created_at DESC LIMIT 50', [id]);
  res.json(logs);
});

router.post('/', authenticate, (req, res) => {
  const user = req.user;
  
  if (user.role !== 'resident' && user.role !== 'handler') {
    return res.status(403).json({ error: '无权限创建房屋档案' });
  }

  const {
    house_code, owner_name, id_card, address, area,
    structure_type, build_year, phone, auxiliaries
  } = req.body;

  if (!house_code || !owner_name || !id_card || !address || !area || !phone) {
    return res.status(400).json({ error: '必填字段不能为空' });
  }

  const existing = queryOne('SELECT id FROM houses WHERE house_code = ?', [house_code]);
  if (existing) {
    return res.status(400).json({ error: '房屋编号已存在' });
  }

  const id = uuidv4();
  const auxStr = Array.isArray(auxiliaries) ? auxiliaries.join(', ') : (auxiliaries || '');
  execute(
    `INSERT INTO houses (id, house_code, owner_name, id_card, address, area, structure_type, build_year, phone, auxiliaries, status, created_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
    [id, house_code, owner_name, id_card, address, area, structure_type, build_year, phone, auxStr, user.id]
  );

  audit(user.id, user.role, 'house_create', null, JSON.stringify({ id, house_code }), id);

  const house = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  res.status(201).json(house);
});

router.put('/:id', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  const house = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  if (!house) {
    return res.status(404).json({ error: '房屋不存在' });
  }

  if (house.created_by !== user.id && user.role !== 'handler' && user.role !== 'legal') {
    return res.status(403).json({ error: '无权限修改此房屋' });
  }

  if (house.status === 'signed' || house.status === 'archived') {
    return res.status(400).json({ error: '已签约或归档的房屋不能修改' });
  }

  const {
    owner_name, id_card, address, area,
    structure_type, build_year, phone, auxiliaries, status
  } = req.body;

  const updates = [];
  const params = [];

  if (owner_name !== undefined) { updates.push('owner_name = ?'); params.push(owner_name); }
  if (id_card !== undefined) { updates.push('id_card = ?'); params.push(id_card); }
  if (address !== undefined) { updates.push('address = ?'); params.push(address); }
  if (area !== undefined) { updates.push('area = ?'); params.push(area); }
  if (structure_type !== undefined) { updates.push('structure_type = ?'); params.push(structure_type); }
  if (build_year !== undefined) { updates.push('build_year = ?'); params.push(build_year); }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
  if (auxiliaries !== undefined) { 
    const auxStr = Array.isArray(auxiliaries) ? auxiliaries.join(', ') : auxiliaries;
    updates.push('auxiliaries = ?'); params.push(auxStr); 
  }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  if (updates.length > 1) {
    execute(`UPDATE houses SET ${updates.join(', ')} WHERE id = ?`, params);
    audit(user.id, user.role, 'house_update', null, JSON.stringify(req.body), id);
  }

  const updated = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  res.json(updated);
});

router.patch('/:id/status', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { status } = req.body;

  const house = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  if (!house) {
    return res.status(404).json({ error: '房屋不存在' });
  }

  if (user.role !== 'handler' && user.role !== 'legal') {
    return res.status(403).json({ error: '无权限修改房屋状态' });
  }

  execute('UPDATE houses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
  audit(user.id, user.role, 'house_status_update', house.status, status, id);

  const updated = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  res.json(updated);
});

router.post('/:id/evaluations', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'evaluator') {
    return res.status(403).json({ error: '只有评估人员可以创建评估' });
  }

  const house = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  if (!house) {
    return res.status(404).json({ error: '房屋不存在' });
  }

  const {
    base_price = 0, structure_price = 0, decoration_price = 0,
    auxiliary_price = 0, other_price = 0, remark
  } = req.body;

  const total_price = Number(base_price) + Number(structure_price) + Number(decoration_price) + Number(auxiliary_price) + Number(other_price);

  const lastEval = queryOne('SELECT MAX(version) as max_ver FROM evaluations WHERE house_id = ?', [id]);
  const version = (lastEval?.max_ver || 0) + 1;

  const evalId = uuidv4();
  execute(
    `INSERT INTO evaluations (id, house_id, version, base_price, structure_price, decoration_price, auxiliary_price, other_price, total_price, remark, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
    [evalId, id, version, base_price, structure_price, decoration_price, auxiliary_price, other_price, total_price, remark, user.id]
  );

  execute("UPDATE houses SET status = 'evaluating', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

  audit(user.id, user.role, 'evaluation_create', null, JSON.stringify({ id: evalId, version, total_price }), id);

  const evaluation = queryOne('SELECT * FROM evaluations WHERE id = ?', [evalId]);
  res.status(201).json(evaluation);
});

router.post('/evaluations/:id/confirm', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'evaluator' && user.role !== 'handler') {
    return res.status(403).json({ error: '无权限确认评估' });
  }

  const evaluation = queryOne('SELECT * FROM evaluations WHERE id = ?', [id]);
  if (!evaluation) {
    return res.status(404).json({ error: '评估不存在' });
  }

  if (evaluation.status === 'confirmed') {
    return res.status(400).json({ error: '评估已确认' });
  }

  execute(
    "UPDATE evaluations SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id]
  );

  execute("UPDATE houses SET status = 'evaluated', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [evaluation.house_id]);

  audit(user.id, user.role, 'evaluation_confirm', evaluation.status, 'confirmed', evaluation.house_id);

  const updated = queryOne('SELECT * FROM evaluations WHERE id = ?', [id]);
  res.json(updated);
});

router.patch('/evaluations/:id/status', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { status } = req.body;

  const evaluation = queryOne('SELECT * FROM evaluations WHERE id = ?', [id]);
  if (!evaluation) {
    return res.status(404).json({ error: '评估不存在' });
  }

  const validStatuses = ['submitted', 'confirmed', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }

  if (status === 'confirmed') {
    if (user.role !== 'evaluator' && user.role !== 'handler') {
      return res.status(403).json({ error: '无权限确认评估' });
    }
    execute(
      "UPDATE evaluations SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
    execute("UPDATE houses SET status = 'evaluated', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [evaluation.house_id]);
  } else {
    execute("UPDATE evaluations SET status = ? WHERE id = ?", [status, id]);
  }

  audit(user.id, user.role, 'evaluation_status_update', evaluation.status, status, evaluation.house_id);

  const updated = queryOne('SELECT * FROM evaluations WHERE id = ?', [id]);
  res.json(updated);
});

router.post('/:id/schemes', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'handler') {
    return res.status(403).json({ error: '只有街道经办人可以生成方案' });
  }

  const house = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  if (!house) {
    return res.status(404).json({ error: '房屋不存在' });
  }

  const activeObjection = queryOne(
    "SELECT * FROM objections WHERE house_id = ? AND status IN ('pending', 'processing')",
    [id]
  );
  if (activeObjection) {
    return res.status(400).json({ error: '存在未处理的异议，不能生成方案' });
  }

  const { evaluation_id } = req.body;
  let confirmedEval;
  
  if (evaluation_id) {
    confirmedEval = queryOne(
      "SELECT * FROM evaluations WHERE id = ? AND status = 'confirmed'",
      [evaluation_id]
    );
  } else {
    confirmedEval = queryOne(
      "SELECT * FROM evaluations WHERE house_id = ? AND status = 'confirmed' ORDER BY version DESC LIMIT 1",
      [id]
    );
  }
  
  if (!confirmedEval) {
    return res.status(400).json({ error: '请先确认评估版本' });
  }

  const {
    compensation_type, money_amount = 0, house_area = 0, house_location,
    transition_fee = 0, move_fee = 0, reward_amount = 0, other_items
  } = req.body;

  if (!compensation_type) {
    return res.status(400).json({ error: '补偿类型不能为空' });
  }

  const total_amount = Number(money_amount) + Number(transition_fee) + Number(move_fee) + Number(reward_amount);

  const lastScheme = queryOne('SELECT MAX(version) as max_ver FROM schemes WHERE house_id = ?', [id]);
  const version = (lastScheme?.max_ver || 0) + 1;

  const schemeId = uuidv4();
  execute(
    `INSERT INTO schemes (id, house_id, evaluation_id, version, compensation_type, money_amount, house_area, house_location, transition_fee, move_fee, reward_amount, other_items, total_amount, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
    [schemeId, id, confirmedEval.id, version, compensation_type, money_amount, house_area, house_location, transition_fee, move_fee, reward_amount, JSON.stringify(other_items || []), total_amount, user.id]
  );

  execute("UPDATE houses SET status = 'scheme_draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

  audit(user.id, user.role, 'scheme_create', null, JSON.stringify({ id: schemeId, version, total_amount }), id);

  const scheme = queryOne('SELECT * FROM schemes WHERE id = ?', [schemeId]);
  res.status(201).json(scheme);
});

router.put('/schemes/:id', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'handler') {
    return res.status(403).json({ error: '无权限修改方案' });
  }

  const scheme = queryOne('SELECT * FROM schemes WHERE id = ?', [id]);
  if (!scheme) {
    return res.status(404).json({ error: '方案不存在' });
  }

  const {
    money_amount, house_area, house_location,
    transition_fee, move_fee, reward_amount, other_items
  } = req.body;

  const updates = [];
  const params = [];
  let total_amount = Number(scheme.total_amount);

  if (money_amount !== undefined) { updates.push('money_amount = ?'); params.push(money_amount); total_amount = total_amount - Number(scheme.money_amount) + Number(money_amount); }
  if (house_area !== undefined) { updates.push('house_area = ?'); params.push(house_area); }
  if (house_location !== undefined) { updates.push('house_location = ?'); params.push(house_location); }
  if (transition_fee !== undefined) { updates.push('transition_fee = ?'); params.push(transition_fee); total_amount = total_amount - Number(scheme.transition_fee) + Number(transition_fee); }
  if (move_fee !== undefined) { updates.push('move_fee = ?'); params.push(move_fee); total_amount = total_amount - Number(scheme.move_fee) + Number(move_fee); }
  if (reward_amount !== undefined) { updates.push('reward_amount = ?'); params.push(reward_amount); total_amount = total_amount - Number(scheme.reward_amount) + Number(reward_amount); }
  if (other_items !== undefined) { updates.push('other_items = ?'); params.push(JSON.stringify(other_items)); }

  updates.push('total_amount = ?');
  params.push(total_amount);
  updates.push("status = 'modified'");
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  execute(`UPDATE schemes SET ${updates.join(', ')} WHERE id = ?`, params);

  audit(user.id, user.role, 'scheme_update', null, JSON.stringify(req.body), scheme.house_id);

  const updated = queryOne('SELECT * FROM schemes WHERE id = ?', [id]);
  res.json(updated);
});

router.post('/schemes/:id/confirm', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'handler') {
    return res.status(403).json({ error: '无权限确认方案' });
  }

  const scheme = queryOne('SELECT * FROM schemes WHERE id = ?', [id]);
  if (!scheme) {
    return res.status(404).json({ error: '方案不存在' });
  }

  if (scheme.status === 'confirmed') {
    return res.status(400).json({ error: '方案已确认' });
  }

  const confirmedEval = queryOne(
    "SELECT * FROM evaluations WHERE id = ? AND status = 'confirmed'",
    [scheme.evaluation_id]
  );
  if (!confirmedEval) {
    return res.status(400).json({ error: '关联的评估版本未确认' });
  }

  execute(
    "UPDATE schemes SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id]
  );

  execute("UPDATE houses SET status = 'scheme_confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [scheme.house_id]);

  audit(user.id, user.role, 'scheme_confirm', scheme.status, 'confirmed', scheme.house_id);

  const updated = queryOne('SELECT * FROM schemes WHERE id = ?', [id]);
  res.json(updated);
});

router.patch('/schemes/:id/status', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { status } = req.body;

  const scheme = queryOne('SELECT * FROM schemes WHERE id = ?', [id]);
  if (!scheme) {
    return res.status(404).json({ error: '方案不存在' });
  }

  const validStatuses = ['submitted', 'confirmed', 'rejected', 'modified'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }

  if (status === 'confirmed') {
    if (user.role !== 'handler') {
      return res.status(403).json({ error: '无权限确认方案' });
    }
    const confirmedEval = queryOne(
      "SELECT * FROM evaluations WHERE id = ? AND status = 'confirmed'",
      [scheme.evaluation_id]
    );
    if (!confirmedEval) {
      return res.status(400).json({ error: '关联的评估版本未确认' });
    }
    execute(
      "UPDATE schemes SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
    execute("UPDATE houses SET status = 'scheme_confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [scheme.house_id]);
  } else {
    execute("UPDATE schemes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id]);
  }

  audit(user.id, user.role, 'scheme_status_update', scheme.status, status, scheme.house_id);

  const updated = queryOne('SELECT * FROM schemes WHERE id = ?', [id]);
  res.json(updated);
});

router.post('/:id/objections', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'resident' && user.role !== 'handler') {
    return res.status(403).json({ error: '无权限提交异议' });
  }

  const house = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  if (!house) {
    return res.status(404).json({ error: '房屋不存在' });
  }

  const { type, content, freeze_contract = 1 } = req.body;

  if (!type || !content) {
    return res.status(400).json({ error: '异议类型和内容不能为空' });
  }

  const objId = uuidv4();
  execute(
    `INSERT INTO objections (id, house_id, type, content, freeze_contract, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [objId, id, type, content, freeze_contract ? 1 : 0, user.id]
  );

  execute("UPDATE houses SET status = 'objection', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

  audit(user.id, user.role, 'objection_create', null, JSON.stringify({ id: objId, type }), id);

  const objection = queryOne('SELECT * FROM objections WHERE id = ?', [objId]);
  res.status(201).json(objection);
});

router.put('/objections/:id', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'legal') {
    return res.status(403).json({ error: '只有法务可以处理异议' });
  }

  const objection = queryOne('SELECT * FROM objections WHERE id = ?', [id]);
  if (!objection) {
    return res.status(404).json({ error: '异议不存在' });
  }

  const { status, handler_remark, freeze_contract } = req.body;

  if (!status) {
    return res.status(400).json({ error: '状态不能为空' });
  }

  const updates = [];
  const params = [];
  
  updates.push('status = ?');
  params.push(status);
  
  if (handler_remark !== undefined) {
    updates.push('handler_remark = ?');
    params.push(handler_remark);
  }
  if (freeze_contract !== undefined) {
    updates.push('freeze_contract = ?');
    params.push(freeze_contract ? 1 : 0);
  }
  
  if (status === 'resolved' || status === 'rejected') {
    updates.push('resolved_at = CURRENT_TIMESTAMP');
  }
  
  params.push(id);

  execute(`UPDATE objections SET ${updates.join(', ')} WHERE id = ?`, params);

  if (status === 'resolved' || status === 'rejected') {
    const pending = queryOne(
      "SELECT COUNT(*) as cnt FROM objections WHERE house_id = ? AND status IN ('pending', 'processing')",
      [objection.house_id]
    );
    if (pending.cnt === 0) {
      execute("UPDATE houses SET status = 'scheme_confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [objection.house_id]);
    }
  }

  audit(user.id, user.role, 'objection_update', objection.status, status, objection.house_id);

  const updated = queryOne('SELECT * FROM objections WHERE id = ?', [id]);
  res.json(updated);
});

router.patch('/objections/:id', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'legal') {
    return res.status(403).json({ error: '只有法务可以处理异议' });
  }

  const objection = queryOne('SELECT * FROM objections WHERE id = ?', [id]);
  if (!objection) {
    return res.status(404).json({ error: '异议不存在' });
  }

  const { status, handler_remark, freeze_contract } = req.body;

  const updates = [];
  const params = [];
  
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (handler_remark !== undefined) {
    updates.push('handler_remark = ?');
    params.push(handler_remark);
  }
  if (freeze_contract !== undefined) {
    updates.push('freeze_contract = ?');
    params.push(freeze_contract ? 1 : 0);
  }
  
  if (status && (status === 'resolved' || status === 'rejected')) {
    updates.push('resolved_at = CURRENT_TIMESTAMP');
  }
  
  params.push(id);

  if (updates.length > 0) {
    execute(`UPDATE objections SET ${updates.join(', ')} WHERE id = ?`, params);

    if (status && (status === 'resolved' || status === 'rejected')) {
      const pending = queryOne(
        "SELECT COUNT(*) as cnt FROM objections WHERE house_id = ? AND status IN ('pending', 'processing')",
        [objection.house_id]
      );
      if (pending.cnt === 0) {
        execute("UPDATE houses SET status = 'scheme_confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [objection.house_id]);
      }
    }

    audit(user.id, user.role, 'objection_patch', objection.status, status || objection.status, objection.house_id);
  }

  const updated = queryOne('SELECT * FROM objections WHERE id = ?', [id]);
  res.json(updated);
});

router.post('/:id/contracts', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'handler') {
    return res.status(403).json({ error: '只有街道经办人可以发起签约' });
  }

  const house = queryOne('SELECT * FROM houses WHERE id = ?', [id]);
  if (!house) {
    return res.status(404).json({ error: '房屋不存在' });
  }

  if (house.status === 'signed') {
    return res.status(400).json({ error: '已签约记录只能走补充协议，不能直接覆盖' });
  }

  const activeObjection = queryOne(
    "SELECT * FROM objections WHERE house_id = ? AND status IN ('pending', 'processing') AND freeze_contract = 1",
    [id]
  );
  if (activeObjection) {
    return res.status(400).json({ error: '异议处理中，不能签约' });
  }

  const { scheme_id } = req.body;
  let confirmedScheme;
  
  if (scheme_id) {
    confirmedScheme = queryOne(
      "SELECT * FROM schemes WHERE id = ? AND status = 'confirmed'",
      [scheme_id]
    );
  } else {
    confirmedScheme = queryOne(
      "SELECT * FROM schemes WHERE house_id = ? AND status = 'confirmed' ORDER BY version DESC LIMIT 1",
      [id]
    );
  }
  
  if (!confirmedScheme) {
    return res.status(400).json({ error: '请先确认补偿方案' });
  }

  const contractNo = 'CT-' + Date.now();
  const contractId = uuidv4();
  
  execute(
    `INSERT INTO contracts (id, house_id, scheme_id, contract_no, type, status, created_by)
     VALUES (?, ?, ?, ?, 'main', 'pending', ?)`,
    [contractId, id, confirmedScheme.id, contractNo, user.id]
  );

  execute("UPDATE houses SET status = 'contracting', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

  audit(user.id, user.role, 'contract_create', null, JSON.stringify({ id: contractId, contractNo }), id);

  const contract = queryOne('SELECT * FROM contracts WHERE id = ?', [contractId]);
  res.status(201).json(contract);
});

router.post('/contracts/:id/sign', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  const contract = queryOne('SELECT * FROM contracts WHERE id = ?', [id]);
  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }

  if (contract.status === 'signed') {
    return res.status(400).json({ error: '合同已签约' });
  }

  if (contract.status === 'frozen') {
    return res.status(400).json({ error: '合同已冻结，不能签约' });
  }

  const activeObjection = queryOne(
    "SELECT * FROM objections WHERE house_id = ? AND status IN ('pending', 'processing') AND freeze_contract = 1",
    [contract.house_id]
  );
  if (activeObjection) {
    return res.status(400).json({ error: '异议处理中，不能签约' });
  }

  execute(
    "UPDATE contracts SET status = 'signed', signed_by = ?, sign_date = CURRENT_TIMESTAMP WHERE id = ?",
    [user.id, id]
  );

  execute("UPDATE houses SET status = 'signed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [contract.house_id]);

  audit(user.id, user.role, 'contract_sign', contract.status, 'signed', contract.house_id);

  const updated = queryOne('SELECT * FROM contracts WHERE id = ?', [id]);
  res.json(updated);
});

router.post('/contracts/:id/freeze', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;

  if (user.role !== 'legal') {
    return res.status(403).json({ error: '只有法务可以冻结合同' });
  }

  const contract = queryOne('SELECT * FROM contracts WHERE id = ?', [id]);
  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }

  execute("UPDATE contracts SET status = 'frozen' WHERE id = ?", [id]);

  audit(user.id, user.role, 'contract_freeze', contract.status, 'frozen', contract.house_id);

  const updated = queryOne('SELECT * FROM contracts WHERE id = ?', [id]);
  res.json(updated);
});

router.patch('/contracts/:id/status', authenticate, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { status } = req.body;

  const contract = queryOne('SELECT * FROM contracts WHERE id = ?', [id]);
  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }

  const validStatuses = ['pending', 'signed', 'frozen', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }

  if (status === 'signed') {
    if (contract.status === 'signed') {
      return res.status(400).json({ error: '合同已签约' });
    }
    if (contract.status === 'frozen') {
      return res.status(400).json({ error: '合同已冻结，不能签约' });
    }
    const activeObjection = queryOne(
      "SELECT * FROM objections WHERE house_id = ? AND status IN ('pending', 'processing') AND freeze_contract = 1",
      [contract.house_id]
    );
    if (activeObjection) {
      return res.status(400).json({ error: '异议处理中，不能签约' });
    }
    execute(
      "UPDATE contracts SET status = 'signed', signed_by = ?, sign_date = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id, id]
    );
    execute("UPDATE houses SET status = 'signed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [contract.house_id]);
  } else if (status === 'frozen') {
    if (user.role !== 'legal') {
      return res.status(403).json({ error: '只有法务可以冻结合同' });
    }
    execute("UPDATE contracts SET status = 'frozen' WHERE id = ?", [id]);
  } else {
    execute("UPDATE contracts SET status = ? WHERE id = ?", [status, id]);
  }

  audit(user.id, user.role, 'contract_status_update', contract.status, status, contract.house_id);

  const updated = queryOne('SELECT * FROM contracts WHERE id = ?', [id]);
  res.json(updated);
});

module.exports = router;
