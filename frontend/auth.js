function getLoggedUser() {
    const s = localStorage.getItem('loggedInUser');
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
}

function requireAuth(redirectTo = 'index.html') {
    const user = getLoggedUser();
    if (!user) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

function ensureAuthUI(elementId) {
    const user = getLoggedUser();
    if (!user) return;
    const el = document.getElementById(elementId);
    if (el) el.textContent = 'مرحباً، ' + (user.name || user.username || '');
}

function saveUserAndRedirect(user) {
    localStorage.setItem('loggedInUser', JSON.stringify(user));
    // يمكنك هنا إضافة منطق لتوجيه المستخدم إلى صفحته المخصصة
    // window.location.href = user.work_page || 'dashboard.html';
    window.location.href = 'dashboard.html'; // For now, always redirect to dashboard
}

function logout() {
    localStorage.removeItem('loggedInUser');
    window.location.href = 'index.html';
}
