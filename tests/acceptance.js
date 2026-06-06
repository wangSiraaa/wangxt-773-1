const http = require('http');

const API_HOST = '127.0.0.1';
const API_PORT = 3002;
const API_PREFIX = '/api';
const TEST_HOUSE_CODE = 'TEST-' + Date.now();

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: API_PREFIX + path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login(username, password = '123456') {
  const res = await request('POST', '/auth/login', { username, password });
  if (res.status !== 200) throw new Error(`登录失败: ${username}, status: ${res.status}, data: ${JSON.stringify(res.data)}`);
  return res.data.token;
}

let residentToken, evaluatorToken, handlerToken, legalToken;
let houseId, evaluationId, schemeId, objectionId, contractId;

async function runTests() {
  console.log('='.repeat(60));
  console.log('城市更新居民签约系统 - 验收测试');
  console.log('='.repeat(60));

  console.log('\n📋 前置准备：用户登录');
  residentToken = await login('resident1');
  evaluatorToken = await login('evaluator1');
  handlerToken = await login('handler1');
  legalToken = await login('legal1');
  console.log('✅ 所有角色登录成功');

  console.log('\n' + '='.repeat(60));
  console.log('📌 路径一：正常签约路径（成功）');
  console.log('='.repeat(60));

  console.log('\n1️⃣  居民提交房屋档案');
  const houseRes = await request('POST', '/houses', {
    house_code: TEST_HOUSE_CODE,
    owner_name: '测试居民',
    id_card: '110101199001011234',
    address: '测试街道123号',
    area: 80.5,
    structure_type: '钢混',
    build_year: 2005,
    phone: '13800138000',
    auxiliaries: ['围墙', '水井']
  }, residentToken);
  if (houseRes.status !== 201) throw new Error(`创建房屋失败: ${JSON.stringify(houseRes.data)}`);
  houseId = houseRes.data.id;
  console.log(`✅ 房屋创建成功: ${houseId}, 状态: ${houseRes.data.status}`);

  console.log('\n2️⃣  评估人员创建评估并确认');
  const evalRes = await request('POST', `/houses/${houseId}/evaluations`, {
    base_price: 20000 * 80.5,
    structure_price: 50000,
    decoration_price: 30000,
    auxiliary_price: 10000,
    other_price: 5000,
    remark: '结构良好'
  }, evaluatorToken);
  if (evalRes.status !== 201) throw new Error(`创建评估失败: ${JSON.stringify(evalRes.data)}`);
  evaluationId = evalRes.data.id;
  console.log(`✅ 评估创建成功: ${evaluationId}, 总价: ${evalRes.data.total_price}`);

  const evalConfirmRes = await request('POST', `/houses/evaluations/${evaluationId}/confirm`, {}, evaluatorToken);
  if (evalConfirmRes.status !== 200) throw new Error(`确认评估失败: ${JSON.stringify(evalConfirmRes.data)}`);
  console.log(`✅ 评估确认成功，状态: ${evalConfirmRes.data.status}`);

  console.log('\n3️⃣  街道经办人生成补偿方案并确认');
  const schemeRes = await request('POST', `/houses/${houseId}/schemes`, {
    compensation_type: 'money',
    money_amount: 20000 * 80.5,
    transition_fee: 20000,
    move_fee: 5000,
    reward_amount: 30000,
    other_items: ['按时签约奖励']
  }, handlerToken);
  if (schemeRes.status !== 201) throw new Error(`生成方案失败: ${JSON.stringify(schemeRes.data)}`);
  schemeId = schemeRes.data.id;
  console.log(`✅ 方案生成成功: ${schemeId}, 总金额: ${schemeRes.data.total_amount}`);

  const schemeConfirmRes = await request('POST', `/houses/schemes/${schemeId}/confirm`, {}, handlerToken);
  if (schemeConfirmRes.status !== 200) throw new Error(`确认方案失败: ${JSON.stringify(schemeConfirmRes.data)}`);
  console.log(`✅ 方案确认成功，状态: ${schemeConfirmRes.data.status}`);

  console.log('\n4️⃣  街道经办人发起签约并完成签约');
  const contractRes = await request('POST', `/houses/${houseId}/contracts`, {}, handlerToken);
  if (contractRes.status !== 201) throw new Error(`发起签约失败: ${JSON.stringify(contractRes.data)}`);
  contractId = contractRes.data.id;
  console.log(`✅ 签约发起成功: ${contractId}, 合同编号: ${contractRes.data.contract_no}`);

  const signRes = await request('POST', `/houses/contracts/${contractId}/sign`, {}, handlerToken);
  if (signRes.status !== 200) throw new Error(`签约失败: ${JSON.stringify(signRes.data)}`);
  console.log(`✅ 签约完成，状态: ${signRes.data.status}`);

  const detailRes = await request('GET', `/houses/${houseId}`, null, residentToken);
  console.log(`✅ 最终房屋状态: ${detailRes.data.house.status}`);

  console.log('\n' + '='.repeat(60));
  console.log('📌 路径二：失败路径 - 评估未确认不能生成方案');
  console.log('='.repeat(60));

  const failHouseCode = 'FAIL1-' + Date.now();
  const failHouseRes = await request('POST', '/houses', {
    house_code: failHouseCode,
    owner_name: '失败测试1',
    id_card: '110101199002022345',
    address: '失败街道1号',
    area: 60,
    phone: '13900139000'
  }, residentToken);
  const failHouseId = failHouseRes.data.id;
  console.log(`\n1️⃣  创建房屋: ${failHouseId}`);

  const failEvalRes = await request('POST', `/houses/${failHouseId}/evaluations`, {
    base_price: 20000 * 60
  }, evaluatorToken);
  const failEvalId = failEvalRes.data.id;
  console.log(`2️⃣  创建评估但不确认: ${failEvalId}, 状态: ${failEvalRes.data.status}`);

  const failSchemeRes = await request('POST', `/houses/${failHouseId}/schemes`, {
    compensation_type: 'money',
    money_amount: 20000 * 60
  }, handlerToken);
  if (failSchemeRes.status !== 400) throw new Error(`应该拒绝生成方案，但实际: status=${failSchemeRes.status}`);
  console.log(`✅ 正确拒绝生成方案: ${failSchemeRes.data.error}`);

  console.log('\n' + '='.repeat(60));
  console.log('📌 路径三：失败路径 - 异议处理中不能签约');
  console.log('='.repeat(60));

  const fail2HouseCode = 'FAIL2-' + Date.now();
  const fail2HouseRes = await request('POST', '/houses', {
    house_code: fail2HouseCode,
    owner_name: '失败测试2',
    id_card: '110101199003033456',
    address: '失败街道2号',
    area: 70,
    phone: '13700137000'
  }, residentToken);
  const fail2HouseId = fail2HouseRes.data.id;
  console.log(`\n1️⃣  创建房屋并完成评估和方案`);

  const fail2EvalRes = await request('POST', `/houses/${fail2HouseId}/evaluations`, {
    base_price: 20000 * 70
  }, evaluatorToken);
  await request('POST', `/houses/evaluations/${fail2EvalRes.data.id}/confirm`, {}, evaluatorToken);
  
  const fail2SchemeRes = await request('POST', `/houses/${fail2HouseId}/schemes`, {
    compensation_type: 'money',
    money_amount: 20000 * 70
  }, handlerToken);
  await request('POST', `/houses/schemes/${fail2SchemeRes.data.id}/confirm`, {}, handlerToken);
  console.log(`   ✅ 评估和方案已确认`);

  const objRes = await request('POST', `/houses/${fail2HouseId}/objections`, {
    type: 'evaluation',
    content: '评估价格过低',
    freeze_contract: 1
  }, residentToken);
  console.log(`2️⃣  提交异议: ${objRes.data.id}, 状态: ${objRes.data.status}`);

  const fail2ContractRes = await request('POST', `/houses/${fail2HouseId}/contracts`, {}, handlerToken);
  if (fail2ContractRes.status !== 400) throw new Error(`应该拒绝签约，但实际: status=${fail2ContractRes.status}`);
  console.log(`✅ 正确拒绝签约: ${fail2ContractRes.data.error}`);

  console.log('\n' + '='.repeat(60));
  console.log('📌 完整验收场景：带异议房屋的完整校验流程');
  console.log('='.repeat(60));

  const acceptHouseCode = 'ACCEPT-' + Date.now();
  console.log('\n1️⃣  提交一个带异议的房屋');
  const acceptHouseRes = await request('POST', '/houses', {
    house_code: acceptHouseCode,
    owner_name: '验收测试',
    id_card: '110101199004044567',
    address: '验收街道1号',
    area: 75,
    phone: '13600136000'
  }, residentToken);
  const acceptHouseId = acceptHouseRes.data.id;
  console.log(`   房屋ID: ${acceptHouseId}`);

  const acceptEvalRes = await request('POST', `/houses/${acceptHouseId}/evaluations`, {
    base_price: 18000 * 75,
    structure_price: 40000
  }, evaluatorToken);
  const acceptEvalId = acceptEvalRes.data.id;
  await request('POST', `/houses/evaluations/${acceptEvalId}/confirm`, {}, evaluatorToken);
  console.log(`   ✅ 评估已确认`);

  const acceptObjRes = await request('POST', `/houses/${acceptHouseId}/objections`, {
    type: 'scheme',
    content: '补偿方案不合理',
    freeze_contract: 1
  }, residentToken);
  const acceptObjId = acceptObjRes.data.id;
  console.log(`   ✅ 异议已提交: ${acceptObjId}`);

  console.log('\n2️⃣  尝试生成最终方案并校验接口拒绝');
  const trySchemeRes = await request('POST', `/houses/${acceptHouseId}/schemes`, {
    compensation_type: 'money',
    money_amount: 18000 * 75
  }, handlerToken);
  if (trySchemeRes.status !== 400) throw new Error(`异议处理中应该拒绝生成方案，实际: status=${trySchemeRes.status}`);
  console.log(`   ✅ 接口正确拒绝: ${trySchemeRes.data.error}`);

  console.log('\n3️⃣  关闭异议、重新确认评估');
  const closeObjRes = await request('PUT', `/houses/objections/${acceptObjId}`, {
    status: 'resolved',
    handler_remark: '已调整方案，异议人满意'
  }, legalToken);
  if (closeObjRes.status !== 200) throw new Error(`关闭异议失败: ${JSON.stringify(closeObjRes.data)}`);
  console.log(`   ✅ 异议已关闭，状态: ${closeObjRes.data.status}`);

  const reEvalRes = await request('POST', `/houses/${acceptHouseId}/evaluations`, {
    base_price: 19000 * 75,
    structure_price: 45000
  }, evaluatorToken);
  await request('POST', `/houses/evaluations/${reEvalRes.data.id}/confirm`, {}, evaluatorToken);
  console.log(`   ✅ 评估已重新确认，版本: ${reEvalRes.data.version}`);

  const finalSchemeRes = await request('POST', `/houses/${acceptHouseId}/schemes`, {
    compensation_type: 'money',
    money_amount: 19000 * 75,
    transition_fee: 15000,
    reward_amount: 20000
  }, handlerToken);
  await request('POST', `/houses/schemes/${finalSchemeRes.data.id}/confirm`, {}, handlerToken);
  console.log(`   ✅ 最终方案已确认，总金额: ${finalSchemeRes.data.total_amount}`);

  console.log('\n4️⃣  验证签约进度被更新');
  const finalContractRes = await request('POST', `/houses/${acceptHouseId}/contracts`, {}, handlerToken);
  const finalSignRes = await request('POST', `/houses/contracts/${finalContractRes.data.id}/sign`, {}, handlerToken);
  if (finalSignRes.status !== 200) throw new Error(`签约失败: ${JSON.stringify(finalSignRes.data)}`);
  
  const finalDetailRes = await request('GET', `/houses/${acceptHouseId}`, null, handlerToken);
  const houseStatus = finalDetailRes.data.house.status;
  const contractStatus = finalDetailRes.data.contracts[0]?.status;
  
  if (houseStatus !== 'signed') throw new Error(`房屋状态应该是 signed，实际: ${houseStatus}`);
  if (contractStatus !== 'signed') throw new Error(`合同状态应该是 signed，实际: ${contractStatus}`);
  
  console.log(`   ✅ 房屋状态: ${houseStatus}`);
  console.log(`   ✅ 合同状态: ${contractStatus}`);
  console.log(`   ✅ 签约进度已更新！`);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 所有验收测试通过！');
  console.log('='.repeat(60));
  console.log('\n📊 测试总结：');
  console.log('  ✅ 路径一：正常签约路径 - 通过');
  console.log('  ✅ 路径二：评估未确认不能生成方案 - 通过');
  console.log('  ✅ 路径三：异议处理中不能签约 - 通过');
  console.log('  ✅ 完整验收场景：带异议房屋的完整校验流程 - 通过');
}

runTests().catch(err => {
  console.error('❌ 测试失败:', err.message);
  process.exit(1);
});
