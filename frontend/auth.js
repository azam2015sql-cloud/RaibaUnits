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
    
    // التوجيه حسب صفحة العمل المخصصة للموظف
    if (user.work_page) {
        window.location.href = user.work_page;
    } else {
        // إذا لم تكن هناك صفحة عمل محددة، توجه إلى لوحة التحكم
        window.location.href = 'dashboard.html';
    }
}

function logout() {
    localStorage.removeItem('loggedInUser');
    window.location.href = 'index.html';
}

// دالة للتحقق من صلاحيات الوصول للصفحات
function checkPageAccess(allowedDepartments = [], allowedPages = []) {
    const user = getLoggedUser();
    if (!user) {
        window.location.href = 'index.html';
        return false;
    }
    
    // مدير النظام يمكنه الوصول لجميع الصفحات
    if (user.department === 'management') {
        return true;
    }
    
    // التحقق من القسم
    if (allowedDepartments.length > 0 && !allowedDepartments.includes(user.department)) {
        alert('ليس لديك صلاحية للوصول إلى هذه الصفحة');
        window.location.href = user.work_page || 'dashboard.html';
        return false;
    }
    
    // التحقق من الصفحة المحددة
    if (allowedPages.length > 0) {
        const currentPage = window.location.pathname.split('/').pop();
        if (!allowedPages.includes(currentPage)) {
            alert('ليس لديك صلاحية للوصول إلى هذه الصفحة');
            window.location.href = user.work_page || 'dashboard.html';
            return false;
        }
    }
    
    return true;
}

// دالة للحصول على الوحدات حسب القسم
function getUnitsForDepartment(units, department) {
    const user = getLoggedUser();
    if (!user) return [];
    
    // مدير النظام يرى جميع الوحدات
    if (user.department === 'management') {
        return units;
    }
    
    // الموظفون الآخرون يرون فقط وحدات قسمهم
    return units.filter(unit => unit.current_department === department);
}