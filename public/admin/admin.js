const API_URL = '/api';
let allUsers = [];

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const userList = document.getElementById('user-list');
const totalUsersCount = document.getElementById('total-users-count');
const blockedUsersCount = document.getElementById('blocked-users-count');
const userSearch = document.getElementById('user-search');
const loadingState = document.getElementById('loading-state');
const logoutBtn = document.getElementById('logout-btn');
const adminName = document.getElementById('admin-name');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const closeModalBtns = document.querySelectorAll('.close-modal');

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        showDashboard();
    }
    
    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    } else {
        console.error('Lucide library not loaded');
    }
});

// Authentication
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorText = document.getElementById('login-error');

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.token) {
            if (!data.user.isAdmin) {
                errorText.textContent = 'Access denied. Administrator privileges required.';
                return;
            }
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user));
            showDashboard();
        } else {
            errorText.textContent = data.message || 'Login failed';
        }
    } catch (err) {
        errorText.textContent = 'Server connection failed';
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.reload();
});

// Dashboard Logic
async function showDashboard() {
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'block';
    
    const user = JSON.parse(localStorage.getItem('adminUser'));
    adminName.textContent = user.fullName;
    
    fetchUsers();
}

async function fetchUsers() {
    loadingState.style.display = 'flex';
    const token = localStorage.getItem('adminToken');

    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (data.success) {
            allUsers = data.data;
            renderUsers(allUsers);
            updateStats(allUsers);
        } else if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('adminToken');
            window.location.reload();
        }
    } catch (err) {
        console.error('Failed to fetch users:', err);
    } finally {
        loadingState.style.display = 'none';
    }
}

function renderUsers(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="user-info">
                    <img src="${user.profileImage || 'https://via.placeholder.com/40'}" class="user-avatar" onerror="this.src='https://via.placeholder.com/40'">
                    <div>
                        <span class="user-name">${user.fullName}</span>
                        <span class="user-username">@${user.username}</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="user-username">${user.email}</div>
                <div class="user-username">Roll: ${user.rollNumber}</div>
            </td>
            <td>
                <div class="campus-branch">${user.campus} / ${user.branch}</div>
            </td>
            <td>
                <span class="status-badge ${user.isBlocked ? 'status-blocked' : 'status-active'}">
                    ${user.isBlocked ? 'Blocked' : 'Active'}
                </span>
            </td>
            <td>
                <div class="actions">
                    <button class="btn btn-secondary btn-small edit-user" data-id="${user._id}">
                        <i data-lucide="edit-2"></i> Edit
                    </button>
                    <button class="btn ${user.isBlocked ? 'btn-success' : 'btn-danger'} btn-small toggle-block" data-id="${user._id}">
                        <i data-lucide="${user.isBlocked ? 'user-check' : 'user-x'}"></i> ${user.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                    <button class="btn btn-danger btn-small delete-user" data-id="${user._id}">
                        <i data-lucide="trash-2"></i> Delete
                    </button>
                </div>
            </td>
        `;
        userList.appendChild(tr);
    });
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Event Delegation for Table Actions
userList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-user');
    const blockBtn = e.target.closest('.toggle-block');
    const deleteBtn = e.target.closest('.delete-user');

    if (editBtn) openEditModal(editBtn.dataset.id);
    if (blockBtn) toggleBlock(blockBtn.dataset.id);
    if (deleteBtn) deleteUser(deleteBtn.dataset.id);
});

function updateStats(users) {
    totalUsersCount.textContent = users.length;
    blockedUsersCount.textContent = users.filter(u => u.isBlocked).length;
}

// Actions
async function toggleBlock(id) {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch(`${API_URL}/admin/users/${id}/block`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            fetchUsers();
        }
    } catch (err) {
        alert('Action failed');
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;
    
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch(`${API_URL}/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            fetchUsers();
        }
    } catch (err) {
        alert('Action failed');
    }
}

// Search Filter
userSearch.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u => 
        u.fullName.toLowerCase().includes(q) || 
        u.username.toLowerCase().includes(q) || 
        u.rollNumber.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
    renderUsers(filtered);
});

// Edit Modal Logic
function openEditModal(id) {
    const user = allUsers.find(u => u._id === id);
    if (!user) return;

    document.getElementById('edit-user-id').value = user._id;
    document.getElementById('edit-fullname').value = user.fullName;
    document.getElementById('edit-username').value = user.username;
    document.getElementById('edit-email').value = user.email;
    document.getElementById('edit-rollno').value = user.rollNumber;

    editModal.style.display = 'flex';
}

closeModalBtns.forEach(btn => {
    btn.onclick = () => editModal.style.display = 'none';
});

editForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const token = localStorage.getItem('adminToken');
    
    const body = {
        fullName: document.getElementById('edit-fullname').value,
        username: document.getElementById('edit-username').value,
        email: document.getElementById('edit-email').value,
        rollNumber: document.getElementById('edit-rollno').value
    };

    try {
        const response = await fetch(`${API_URL}/admin/users/${id}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (data.success) {
            editModal.style.display = 'none';
            fetchUsers();
        }
    } catch (err) {
        alert('Update failed');
    }
};
