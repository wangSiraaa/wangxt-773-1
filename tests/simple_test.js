const http = require('http');

const HOST = '127.0.0.1';
const PORT = 3002;

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api' + path,
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
          resolve({ status: res.statusCode, data: body, error: e });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTest() {
  try {
    console.log('=== 简单流程测试 ===\n');
    
    console.log('1. 登录各角色账号...');
    const loginRes = await request('POST', '/auth/login', { username: 'evaluator1', password: '123456' });
    const evaluatorToken = loginRes.data.token;
    console.log('   评估人员登录:', loginRes.status);

    const loginRes2 = await request('POST', '/auth/login', { username: 'handler1', password: '123456' });
    const handlerToken = loginRes2.data.token;
    console.log('   街道经办人登录:', loginRes2.status);

    const loginRes3 = await request('POST', '/auth/login', { username: 'resident1', password: '123456' });
    const residentToken = loginRes3.data.token;
    console.log('   居民登录:', loginRes3.status);

    console.log('\n2. 居民创建房屋档案...');
    const houseCode = 'HOUSE-' + Date.now();
    const createHouse = await request('POST', '/houses', {
      house_code: houseCode,
      owner_name: '测试居民',
      id_card: '110101199001011234',
      address: '测试街道123号',
      area: 80.5,
      phone: '13800138000'
    }, residentToken);
    console.log('   创建房屋状态:', createHouse.status);
    const houseId = createHouse.data.id;

    if (!houseId) {
      console.log('❌ 创建房屋失败，终止测试');
      console.log('   错误:', createHouse.data);
      return;
    }
    console.log('   房屋ID:', houseId);

    console.log('\n3. 评估人员提交评估...');
    const createEval = await request('POST', `/houses/${houseId}/evaluations`, {
      base_price: 500000,
      structure_price: 50000,
      decoration_price: 30000,
      auxiliary_price: 20000,
      other_price: 0,
      total_price: 600000,
      remark: '初步评估'
    }, evaluatorToken);
    console.log('   创建评估状态:', createEval.status);
    const evalId = createEval.data.id;

    if (!evalId) {
      console.log('❌ 创建评估失败，终止测试');
      console.log('   错误:', createEval.data);
      return;
    }
    console.log('   评估ID:', evalId);

    console.log('\n4. 确认评估版本...');
    const confirmEval = await request('POST', `/houses/evaluations/${evalId}/confirm`, null, evaluatorToken);
    console.log('   确认评估状态:', confirmEval.status);
    console.log('   返回:', JSON.stringify(confirmEval.data));

    if (confirmEval.status !== 200) {
      console.log('❌ 确认评估失败');
      return;
    }

    console.log('\n5. 街道经办人生成补偿方案...');
    const createScheme = await request('POST', `/houses/${houseId}/schemes`, {
      evaluation_id: evalId,
      compensation_type: 'money',
      money_amount: 600000,
      transition_fee: 12000,
      move_fee: 2000,
      reward_amount: 30000,
      total_amount: 644000,
      remark: '货币补偿方案'
    }, handlerToken);
    console.log('   生成方案状态:', createScheme.status);
    const schemeId = createScheme.data.id;

    if (!schemeId) {
      console.log('❌ 生成方案失败，终止测试');
      console.log('   错误:', createScheme.data);
      return;
    }
    console.log('   方案ID:', schemeId);

    console.log('\n6. 确认补偿方案...');
    const confirmScheme = await request('POST', `/houses/schemes/${schemeId}/confirm`, null, handlerToken);
    console.log('   确认方案状态:', confirmScheme.status);
    console.log('   返回:', JSON.stringify(confirmScheme.data));

    if (confirmScheme.status !== 200) {
      console.log('❌ 确认方案失败');
      return;
    }

    console.log('\n7. 创建签约...');
    const createContract = await request('POST', `/houses/${houseId}/contracts`, {
      scheme_id: schemeId,
      contract_no: 'CONTRACT-' + Date.now(),
      type: 'main'
    }, handlerToken);
    console.log('   创建签约状态:', createContract.status);
    const contractId = createContract.data.id;

    if (!contractId) {
      console.log('❌ 创建签约失败，终止测试');
      console.log('   错误:', createContract.data);
      return;
    }
    console.log('   签约ID:', contractId);

    console.log('\n8. 签约确认...');
    const signContract = await request('POST', `/houses/contracts/${contractId}/sign`, null, handlerToken);
    console.log('   签约状态:', signContract.status);
    console.log('   返回:', JSON.stringify(signContract.data));

    if (signContract.status !== 200) {
      console.log('❌ 签约失败');
      return;
    }

    console.log('\n9. 查询房屋详情和进度...');
    const houseDetail = await request('GET', `/houses/${houseId}`, null, handlerToken);
    console.log('   房屋状态:', houseDetail.data.status);

    console.log('\n10. 查询看板统计...');
    const dashboard = await request('GET', '/dashboard/stats', null, handlerToken);
    console.log('   看板数据:', JSON.stringify(dashboard.data));

    console.log('\n✅ 完整签约流程测试通过！');
    console.log('   房屋建档 → 评估确认 → 方案生成 → 方案确认 → 签约完成');
    
  } catch (err) {
    console.error('❌ 测试出错:', err);
  }
}

runTest();
