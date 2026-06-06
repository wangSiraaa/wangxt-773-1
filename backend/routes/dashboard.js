const express = require('express');
const { query } = require('../database');
const { authenticateToken: authenticate } = require('../middleware/auth');

const router = express.Router();

function getDashboardStats() {
  const totalHouses = query('SELECT COUNT(*) as count FROM houses')[0]?.count || 0;
  
  const signedHouses = query("SELECT COUNT(*) as count FROM houses WHERE status = 'signed'")[0]?.count || 0;
  
  const signingRate = totalHouses > 0 ? Math.round((signedHouses / totalHouses) * 100) : 0;
  
  const pendingObjections = query("SELECT COUNT(*) as count FROM objections WHERE status IN ('pending', 'processing')")[0]?.count || 0;
  
  const byStatus = query(`
    SELECT status, COUNT(*) as count 
    FROM houses 
    GROUP BY status
  `);
  
  const statusBreakdown = {};
  byStatus.forEach(item => {
    statusBreakdown[item.status] = item.count;
  });
  
  const evaluations = query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'draft' OR status = 'submitted' THEN 1 ELSE 0 END) as pending
    FROM evaluations
  `)[0] || { total: 0, confirmed: 0, pending: 0 };

  const contracts = query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END) as signed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM contracts
  `)[0] || { total: 0, signed: 0, pending: 0 };

  return {
    totalHouses,
    totalSigned: signedHouses,
    signingRate,
    pendingObjections,
    statusBreakdown,
    evaluations,
    contracts
  };
}

function getRecentActivity(limit = 20) {
  const logs = query(`
    SELECT 
      al.id,
      al.house_id,
      al.action,
      al.old_value,
      al.new_value,
      al.operator_id,
      al.operator_role,
      al.created_at,
      u.name as operator_name,
      h.house_code
    FROM audit_logs al 
    LEFT JOIN users u ON al.operator_id = u.id 
    LEFT JOIN houses h ON al.house_id = h.id
    ORDER BY al.created_at DESC 
    LIMIT ?
  `, [limit]);
  
  return logs;
}

router.get('/', authenticate, (req, res) => {
  const stats = getDashboardStats();
  const recentActivity = getRecentActivity(20);
  
  res.json({
    ...stats,
    recentActivity
  });
});

router.get('/stats', authenticate, (req, res) => {
  const stats = getDashboardStats();
  res.json(stats);
});

router.get('/recent-activity', authenticate, (req, res) => {
  const activity = getRecentActivity(20);
  res.json(activity);
});

module.exports = router;
