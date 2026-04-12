const http = require('http');

const baseURL = 'localhost';
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

function request(path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: baseURL,
      port: port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
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
    console.log('Signing up...');
    await request('/api/auth/signup', 'POST', {}, testUserData);
    console.log('Signup successful');

    console.log('Logging in...');
    const loginData = await request('/api/auth/login', 'POST', {}, {
      username: testUserData.username,
      password: testUserData.password
    });
    const token = loginData.token;
    console.log('Login successful');

    console.log('Creating project...');
    const projectData = {
      title: 'Test Project',
      description: 'A test project with Idea status',
      technologies: ['Node.js', 'Express'],
      status: 'Idea',
      githubLink: 'https://github.com/test/test'
    };

    const project = await request('/api/projects', 'POST', {
      'Authorization': `Bearer ${token}`
    }, projectData);

    console.log('Project created successfully:', project._id);
    console.log('Project Status:', project.status);

    if (project.status === 'Idea') {
      console.log('SUCCESS: Project status is Idea');
    } else {
      console.log('FAILURE: Project status is', project.status);
      process.exit(1);
    }
  } catch (e) {
    console.error('Test failed:', e.message);
    process.exit(1);
  }
})();
