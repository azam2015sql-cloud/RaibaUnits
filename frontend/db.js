const API_URL = 'http://localhost:3000/api';

/**
 * دالة مساعدة لمعالجة استجابات fetch
 * @param {Response} response - الاستجابة من fetch
 * @returns {Promise<any>} - بيانات JSON
 */
async function handleResponse(response) {
    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
    }

    if (!response.ok) {
        throw new Error(data.message || response.statusText || 'An unknown error occurred');
    }
    
    // إذا كانت الاستجابة 200-299 ولا يوجد محتوى JSON (مثل DELETE)، نعتبرها نجاحاً
    return data !== undefined ? data : true;
}

const db = {
    // --- المصادقة ---
    async login(username, password) {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            return await handleResponse(response);
        } catch (error) {
            console.error('Error during login:', error.message);
            // إرجاع الخطأ بدلاً من null لمعالجته في الواجهة
            throw new Error(error.message);
        }
    },

    // --- الوحدات ---
    async getUnits() {
        try {
            const response = await fetch(`${API_URL}/units`);
            return await handleResponse(response);
        } catch (error) { console.error('Error fetching units:', error.message); return []; }
    },
    
    async addUnit(id, type) {
        try {
            const response = await fetch(`${API_URL}/units`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, type }) });
            return await handleResponse(response);
        } catch (error) { alert(`فشلت إضافة الوحدة: ${error.message}`); return false; }
    },

    async updateUnit(unitId, newType) {
        try {
            const response = await fetch(`${API_URL}/units/${unitId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: newType }) });
            return await handleResponse(response);
        } catch (error) { alert(`فشل تحديث الوحدة: ${error.message}`); return false; }
    },

    async deleteUnit(unitId) {
        try {
            const response = await fetch(`${API_URL}/units/${unitId}`, { method: 'DELETE' });
            return await handleResponse(response);
        } catch (error) { alert(`فشل حذف الوحدة: ${error.message}`); return false; }
    },

    // --- الموظفون ---
    async getEmployees() {
        try {
            const response = await fetch(`${API_URL}/employees`);
            return await handleResponse(response);
        } catch (error) { console.error('Error fetching employees:', error.message); return []; }
    },

    async addEmployee(name, username, password, department, workPage) {
        try {
            const response = await fetch(`${API_URL}/employees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, username, password, department, work_page: workPage }) });
            return await handleResponse(response);
        } catch (error) { alert(`فشلت إضافة الموظف: ${error.message}`); return false; }
    },

    async updateEmployee(id, name, username, department, workPage, password) {
        try {
            const body = { name, username, department, work_page: workPage };
            if (password) body.password = password;
            const response = await fetch(`${API_URL}/employees/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            return await handleResponse(response);
        } catch (error) { alert(`فشل تحديث الموظف: ${error.message}`); return false; }
    },

    async deleteEmployee(id) {
        try {
            const response = await fetch(`${API_URL}/employees/${id}`, { method: 'DELETE' });
            return await handleResponse(response);
        } catch (error) { alert(`فشل حذف الموظف: ${error.message}`); return false; }
    },
    
    // --- الحركات ---
    async moveUnit(unitId, targetDepartment, targetSection, employeeId, movementType, notes = '') {
        try {
            const response = await fetch(`${API_URL}/units/${unitId}/move`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetDepartment, targetSection, employeeId, movementType, notes }) });
            return await handleResponse(response);
        } catch (error) { alert(`فشل نقل الوحدة: ${error.message}`); return false; }
    },

    async getMovements(unitId, employeeId, dateFrom, dateTo) {
        try {
            const params = new URLSearchParams();
            if (unitId) params.append('unitId', unitId);
            if (employeeId) params.append('employeeId', employeeId);
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);
            
            const response = await fetch(`${API_URL}/movements?${params.toString()}`);
            return await handleResponse(response);
        } catch (error) { console.error('Error fetching movements:', error.message); return []; }
    },
    
    // --- الإحصائيات ---
    async getStats() {
        try {
            const response = await fetch(`${API_URL}/stats`);
            return await handleResponse(response);
        } catch (error) { console.error('Error fetching stats:', error.message); return {}; }
    },

    // --- الإحصائيات الشاملة ---
    async getComprehensiveStats() {
        try {
            const response = await fetch(`${API_URL}/stats/comprehensive`);
            return await handleResponse(response);
        } catch (error) { console.error('Error fetching comprehensive stats:', error.message); return {}; }
    }
};