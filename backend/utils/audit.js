const { v4: uuidv4 } = require('uuid');
const { execute } = require('../database');

function audit(operatorId, operatorRole, action, oldValue, newValue, houseId = null) {
  try {
    const id = uuidv4();
    execute(
      `INSERT INTO audit_logs (id, house_id, action, old_value, new_value, operator_id, operator_role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, houseId, action, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, operatorId, operatorRole]
    );
  } catch (e) {
    console.error('审计日志记录失败:', e);
  }
}

module.exports = { audit };
