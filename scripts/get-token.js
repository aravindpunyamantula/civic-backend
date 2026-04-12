const http = require('http');

const baseURL = process.env.BASE_URL || '';
const port = 5000;
const timestamp = Date.now();
const testUserData = {
  username: `testuser_${timestamp}`,
  password: 'password123',
  email: `test_${timestamp}@example.com`,
  fullName: 'Test User',
  campus: 'AUS',
  branch: 'CSE',
  rollNumber: `ROLL_${timestamp}`
};

function request(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: baseURL,
      port: port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        } else {
          resolve(data ? JSON.parse(data) : {});
        }
      });
    });
    req.on('error', (e) => reject(e));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    await request('/api/auth/signup', 'POST', testUserData);
    const loginData = await request('/api/auth/login', 'POST', {
      username: testUserData.username,
      password: testUserData.password
    });
    console.log(loginData.token);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
