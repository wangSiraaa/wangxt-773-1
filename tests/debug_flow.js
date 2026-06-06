const http = require('http');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
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
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  try {
    console.log('1. 登录 handler1...');
    const loginRes = await request('POST', '/auth/login', { username: 'handler1', password: '123456' });
    console.log('登录状态:', loginRes.status);
    const token = loginRes.data.token;
    console.log('Token:', token ? '已获取' : '未获取');

    console.log('\n2. 创建房屋...');
    const houseRes = await request('POST', '/houses', {
      house_code: 'DEBUG-' + Date.now(),
      owner_name: '调试用户',
      id_card: '110101199001011234',
      address: '调试街道1号',
      area: 80,
      phone: '13800138000'
    }, token);
    console.log('创建房屋状态:', houseRes.status);
    console.log('返回:', JSON.stringify(houseRes.data, null, 2));
    const houseId = houseRes.data.id;
    
    if (!houseId) {
      console.log('❌ 创建房屋失败');
      return;
    }
    console.log('房屋ID:', houseId);

    console.log('\n3. 登录 evaluator1...');
    const evalLoginRes = await request('POST', '/auth/login', { username: 'evaluator1', password: '123456' });
    const evalToken = evalLoginRes.data.token;
    console.log('评估人员登录状态:', evalLoginRes.status);
    
    console.log('\n4. 创建评估...');
    const evalRes = await request('POST', '/houses/' + houseId + '/evaluations', {
      base_price: 20000 * 80
    }, evalToken);
    console.log('创建评估状态:', evalRes.status);
    console.log('返回:', JSON.stringify(evalRes.data, null, 2));
    const evalId = evalRes.data.id;
    
    if (!evalId) {
      console.log('❌ 创建评估失败');
      return;
    }
    
    console.log('\n5. 确认评估...');
    const evalConfirmRes = await request('POST', '/houses/evaluations/' + evalId + '/confirm', {}, evalToken);
    console.log('确认评估状态:', evalConfirmRes.status);
    console.log('返回:', JSON.stringify(evalConfirmRes.data, null, 2));

    console.log('\n6. 生成方案...');
    const schemeRes = await request('POST', '/houses/' + houseId + '/schemes', {
      compensation_type: 'money',
      money_amount: 20000 * 80
    }, token);
    console.log('生成方案状态:', schemeRes.status);
    console.log('返回:', JSON.stringify(schemeRes.data, null, 2));
    
  } catch (e) {
    console.error('测试错误:', e);
  }
}

test();
