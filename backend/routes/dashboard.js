const express = require('express');
const { query } = require('../database');
const { authenticateToken: authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const totalHouses = query('SELECT COUNT(*) as count FROM houses')[0]?.count || 0;
  
  const byStatus = query(`
    SELECT status, COUNT(*) as count 
    FROM houses 
    GROUP BY status
  `);
  
  const byRole = query(`
    SELECT u.role, COUNT(DISTINCT h.id) as count 
    FROM houses h 
    LEFT JOIN users u ON h.created_by = u.id 
    GROUP BY u.role
  `);

  const recentHouses = query(`
    SELECT h.*, u.name as creator_name 
    FROM houses h 
    LEFT JOIN users u ON h.created_by = u.id 
    ORDER BY h.created_at DESC 
    LIMIT 10
  `);

  const evaluations = query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'draft' OR status = 'submitted' THEN 1 ELSE 0 END) as pending
    FROM evaluations
  `)[0];

  const contracts = query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END) as signed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM contracts
  `)[0];

  res.json({
    totalHouses,
    byStatus,
    byRole,
    recentHouses,
    evaluations,
    contracts
  });
});

module.exports = router;
