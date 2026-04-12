const http = require('http');

const baseURL = 'localhost';
const port = 5000;
const timestamp = Date.now();
const testUserData = {
  username: `lifecycleuser_${timestamp}`,
  password: 'password123',
  email: `lifecycle_${timestamp}@example.com`,
  fullName: 'Lifecycle Tester',
  campus: 'AUS',
  branch: 'IT',
  rollNumber: `LIFECYCLE_${timestamp}`
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
    console.log('--- Lifecycle System Test ---');
    
    // 1. Signup & Login
    console.log('Step 1: Auth');
    await request('/api/auth/signup', 'POST', {}, testUserData);
    const loginData = await request('/api/auth/login', 'POST', {}, {
      username: testUserData.username,
      password: testUserData.password
    });
    const token = loginData.token;
    console.log('Auth successful');

    // 2. Create projects with different statuses and collaboration flags
    console.log('\nStep 2: Creating test projects');
    
    const p1 = await request('/api/projects', 'POST', { 'Authorization': `Bearer ${token}` }, {
      title: 'Idea Project',
      description: 'An initial idea',
      technologies: ['React'],
      status: 'IDEA',
      isCollaborationOpen: false
    });
    console.log('Created IDEA project:', p1._id);

    const p2 = await request('/api/projects', 'POST', { 'Authorization': `Bearer ${token}` }, {
      title: 'Collab Project',
      description: 'Looking for partners',
      technologies: ['Flutter'],
      status: 'COLLAB',
      isCollaborationOpen: true
    });
    console.log('Created COLLAB project:', p2._id);

    const p3 = await request('/api/projects', 'POST', { 'Authorization': `Bearer ${token}` }, {
      title: 'Completed Project',
      description: 'Finished work',
      technologies: ['Node.js'],
      status: 'COMPLETED',
      isCollaborationOpen: false
    });
    console.log('Created COMPLETED project:', p3._id);

    // 3. Test Feed Filtering
    console.log('\nStep 3: Testing Feed Filtering');

    const ideaFeed = await request('/api/projects/feed?status=IDEA', 'GET', {});
    console.log('Feed ?status=IDEA count:', ideaFeed.length);
    if (ideaFeed.some(p => p.status !== 'IDEA')) throw new Error('Filter failed: found non-IDEA project in IDEA feed');

    const collabFeed = await request('/api/projects/feed?collaborationOpen=true', 'GET', {});
    console.log('Feed ?collaborationOpen=true count:', collabFeed.length);
    if (collabFeed.some(p => !p.isCollaborationOpen)) throw new Error('Filter failed: found closed collaboration in open feed');

    const mixedFeed = await request('/api/projects/feed?status=COMPLETED&collaborationOpen=false', 'GET', {});
    console.log('Feed ?status=COMPLETED&collaborationOpen=false count:', mixedFeed.length);
    if (mixedFeed.some(p => p.status !== 'COMPLETED' || p.isCollaborationOpen)) throw new Error('Filter failed: combined filters results mismatch');

    console.log('\n--- ALL TESTS PASSED ---');
  } catch (e) {
    console.error('\nTest failed:', e.message);
    process.exit(1);
  }
})();
