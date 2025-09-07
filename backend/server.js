// --- server.js (v2.0 - Final) ---
const express = require('express');
const mysql = require('mysql2/promise'); // <-- استخدام النسخة التي تدعم Promises
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- إعدادات الاتصال بقاعدة البيانات (مع Promises) ---
const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Dba@1234', // تأكد من صحة كلمة المرور
    database: 'unitflow_db1'
};

// --- Middleware للتحقق من الاتصال ---
// هذا يضمن أننا لا نحاول استخدام اتصال غير موجود
const withDB = async (req, res, next) => {
    try {
        req.db = await mysql.createConnection(dbConfig);
        await req.db.connect();
        console.log('✅ Database connection successful for a request.');
        next();
    } catch (error) {
        console.error('❌ Database Connection Error:', error);
        res.status(500).json({ message: 'Database connection failed.' });
    }
};

// --- مسارات API ---

// المسار الرئيسي
app.get('/api', (req, res) => {
    res.json({ message: 'Welcome to UnitFlow API v2.0!' });
});

// مسار مؤقت لفحص المستخدمين (للتطوير فقط)
app.get('/api/debug/users', withDB, async (req, res) => {
    try {
        const [users] = await req.db.query("SELECT id, name, username, department, work_page, password FROM employees");
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (req.db) req.db.end();
    }
});

// مسار لإعادة تعيين كلمات المرور (للتطوير فقط)
app.post('/api/debug/reset-passwords', withDB, async (req, res) => {
    try {
        // إعادة تعيين كلمات المرور للمستخدمين المحددين
        const users = [
            { username: 'admin', password: 'admin123', department: 'management', work_page: 'admin.html' },
            { username: 'azam', password: 'azam123', department: 'operations', work_page: 'operations.html' },
            { username: 'sufyan', password: 'suf123', department: 'technical', work_page: 'technical.html' }
        ];
        
        for (const user of users) {
            // التحقق من وجود المستخدم
            const [existing] = await req.db.query("SELECT id FROM employees WHERE username = ?", [user.username]);
            
            if (existing.length > 0) {
                // تحديث المستخدم الموجود
                await req.db.query(
                    "UPDATE employees SET password = ?, department = ?, work_page = ? WHERE username = ?",
                    [user.password, user.department, user.work_page, user.username]
                );
                console.log(`Updated user: ${user.username}`);
            } else {
                // إضافة مستخدم جديد
                await req.db.query(
                    "INSERT INTO employees (name, username, password, department, work_page) VALUES (?, ?, ?, ?, ?)",
                    [user.username, user.username, user.password, user.department, user.work_page]
                );
                console.log(`Created user: ${user.username}`);
            }
        }
        
        res.json({ message: 'تم إعادة تعيين كلمات المرور بنجاح' });
    } catch (err) {
        console.error("Reset passwords error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (req.db) req.db.end();
    }
});

// ## مسار تسجيل الدخول ##
app.post('/api/login', withDB, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const sql = "SELECT * FROM employees WHERE username = ?";
        const [results] = await req.db.query(sql, [username]);

        if (results.length === 0) {
            return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        const user = results[0];
        
        // التحقق من نوع كلمة المرور (مشفرة أم لا)
        let isPasswordMatch = false;
        
        // محاولة المقارنة العادية أولاً (للكلمات غير المشفرة)
        if (user.password === password) {
            isPasswordMatch = true;
            console.log(`Login successful for ${username} with plain text password`);
        } else {
            // محاولة المقارنة مع bcrypt (للكلمات المشفرة)
            try {
                isPasswordMatch = await bcrypt.compare(password, user.password);
                if (isPasswordMatch) {
                    console.log(`Login successful for ${username} with bcrypt password`);
                }
            } catch (bcryptError) {
                console.log(`Bcrypt comparison failed for ${username}:`, bcryptError.message);
            }
        }

        if (isPasswordMatch) {
            const userPayload = { id: user.id, name: user.name, username: user.username, department: user.department, work_page: user.work_page };
            res.status(200).json(userPayload);
        } else {
            console.log(`Login failed for ${username} - password mismatch`);
            res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: 'An internal server error occurred' });
    } finally {
        if (req.db) req.db.end();
    }
});


// --- CRUD: الوحدات (Units) ---
app.get('/api/units', withDB, async (req, res) => {
    try {
        const [units] = await req.db.query("SELECT * FROM units ORDER BY last_movement_time DESC");
        res.json(units);
    } catch (err) { res.status(500).json({ error: err.message }); } finally { if (req.db) req.db.end(); }
});

app.post('/api/units', withDB, async (req, res) => {
    const { id, type } = req.body;
    const newUnit = { id, type, current_department: 'operations', current_section: 'ready_for_loading', last_movement_time: new Date() };
    try {
        await req.db.query("INSERT INTO units SET ?", newUnit);
        res.status(201).json({ message: 'تمت إضافة الوحدة بنجاح' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'رقم الوحدة مستخدم بالفعل.' });
        res.status(500).json({ error: err.message });
    } finally { if (req.db) req.db.end(); }
});

app.put('/api/units/:id', withDB, async (req, res) => {
    const { type } = req.body;
    try {
        await req.db.query("UPDATE units SET type = ? WHERE id = ?", [type, req.params.id]);
        res.json({ message: 'تم تحديث الوحدة بنجاح' });
    } catch (err) { res.status(500).json({ error: err.message }); } finally { if (req.db) req.db.end(); }
});

app.delete('/api/units/:id', withDB, async (req, res) => {
    try {
        await req.db.query("DELETE FROM units WHERE id = ?", [req.params.id]);
        res.json({ message: 'تم حذف الوحدة بنجاح' });
    } catch (err) { res.status(500).json({ error: err.message }); } finally { if (req.db) req.db.end(); }
});

// --- CRUD: الموظفون (Employees) ---
app.get('/api/employees', withDB, async (req, res) => {
    try {
        const [employees] = await req.db.query("SELECT id, name, username, department, work_page FROM employees");
        res.json(employees);
    } catch (err) { res.status(500).json({ error: err.message }); } finally { if (req.db) req.db.end(); }
});

app.post('/api/employees', withDB, async (req, res) => {
    const { name, username, password, department, work_page } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newEmployee = { name, username, password: hashedPassword, department, work_page };
        await req.db.query("INSERT INTO employees SET ?", newEmployee);
        res.status(201).json({ message: 'تمت إضافة الموظف بنجاح' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'اسم المستخدم موجود بالفعل.' });
        res.status(500).json({ error: err.message });
    } finally { if (req.db) req.db.end(); }
});

app.put('/api/employees/:id', withDB, async (req, res) => {
    const { name, username, department, work_page, password } = req.body;
    try {
        let sql, params;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            sql = "UPDATE employees SET name = ?, username = ?, department = ?, work_page = ?, password = ? WHERE id = ?";
            params = [name, username, department, work_page, hashedPassword, req.params.id];
        } else {
            sql = "UPDATE employees SET name = ?, username = ?, department = ?, work_page = ? WHERE id = ?";
            params = [name, username, department, work_page, req.params.id];
        }
        await req.db.query(sql, params);
        res.json({ message: 'تم تحديث الموظف بنجاح' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'اسم المستخدم موجود بالفعل.' });
        res.status(500).json({ error: err.message });
    } finally { if (req.db) req.db.end(); }
});

app.delete('/api/employees/:id', withDB, async (req, res) => {
    // يمنع حذف المدير الرئيسي (ID=1)
    if (req.params.id === '1') {
        return res.status(403).json({ message: 'لا يمكن حذف المدير الرئيسي.' });
    }
    try {
        await req.db.query("DELETE FROM employees WHERE id = ?", [req.params.id]);
        res.json({ message: 'تم حذف الموظف بنجاح' });
    } catch (err) { res.status(500).json({ error: err.message }); } finally { if (req.db) req.db.end(); }
});


// --- الحركات والتقارير (Movements & Reports) ---
app.put('/api/units/:id/move', withDB, async (req, res) => {
    const { targetDepartment, targetSection, employeeId, movementType, notes } = req.body;
    const unitId = req.params.id;

    try {
        // الخطوة 1: الحصول على الحالة القديمة
        const [units] = await req.db.query("SELECT * FROM units WHERE id = ?", [unitId]);
        if (units.length === 0) return res.status(404).json({ message: 'Unit not found' });
        const oldUnit = units[0];

        // الخطوة 2: تحديث الوحدة
        await req.db.query("UPDATE units SET current_department = ?, current_section = ?, last_movement_time = ? WHERE id = ?", [targetDepartment, targetSection, new Date(), unitId]);

        // الخطوة 3: تسجيل الحركة
        const movement = {
            unit_id: unitId, employee_id: employeeId, movement_type: movementType,
            from_department: oldUnit.current_department, to_department: targetDepartment,
            from_section: oldUnit.current_section, to_section: targetSection, notes: notes || ''
        };
        await req.db.query("INSERT INTO movements SET ?", movement);

        res.json({ message: 'تم نقل الوحدة بنجاح' });
    } catch (err) {
        console.error("Movement Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (req.db) req.db.end();
    }
});

app.get('/api/movements', withDB, async (req, res) => {
    try {
        let sql = `
            SELECT m.*, e.name as employee_name 
            FROM movements m 
            JOIN employees e ON m.employee_id = e.id 
            WHERE 1=1`;
        const params = [];

        if (req.query.unitId) { sql += " AND m.unit_id = ?"; params.push(req.query.unitId); }
        if (req.query.employeeId) { sql += " AND m.employee_id = ?"; params.push(req.query.employeeId); }
        if (req.query.dateFrom) { sql += " AND m.timestamp >= ?"; params.push(req.query.dateFrom); }
        if (req.query.dateTo) { sql += " AND m.timestamp <= ?"; params.push(req.query.dateTo + ' 23:59:59'); }
        
        sql += " ORDER BY m.timestamp DESC";
        
        const [movements] = await req.db.query(sql, params);
        res.json(movements);
    } catch (err) { res.status(500).json({ error: err.message }); } finally { if (req.db) req.db.end(); }
});

// --- مسار الإحصائيات (Dashboard Stats) ---
app.get('/api/stats', withDB, async (req, res) => {
    try {
        const [totalUnits] = await req.db.query("SELECT COUNT(*) as count FROM units");
        const [unitsInOps] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_department = 'operations'");
        const [unitsInTech] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_department = 'technical'");
        const [totalEmployees] = await req.db.query("SELECT COUNT(*) as count FROM employees");

        res.json({
            totalUnits: totalUnits[0].count,
            unitsInOps: unitsInOps[0].count,
            unitsInTech: unitsInTech[0].count,
            totalEmployees: totalEmployees[0].count
        });
    } catch (err) { res.status(500).json({ error: err.message }); } finally { if (req.db) req.db.end(); }
});

// --- مسار الإحصائيات الشاملة ---
app.get('/api/stats/comprehensive', withDB, async (req, res) => {
    try {
        // إحصائيات العمليات
        const [readyForLoading] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'ready_for_loading'");
        const [underLoading] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'under_loading'");
        const [inTransitLoaded] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'in_transit_loaded'");
        const [underUnloading] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'under_unloading'");
        const [inTransitEmpty] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'in_transit_empty'");
        const [delivered] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'delivered'");
        
        // إحصائيات القسم الفني
        const [awaitingMaintenance] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'awaiting_maintenance'");
        const [inMaintenance] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'in_maintenance'");
        const [awaitingSpareParts] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'awaiting_spare_parts'");
        const [maintenanceCompleted] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'maintenance_completed'");
        
        // إحصائيات القسم التجاري
        const [awaitingDocuments] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'awaiting_documents'");
        const [documentProcessing] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'document_processing'");
        const [documentCompleted] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'document_completed'");
        
        // إحصائيات قسم الوقود
        const [awaitingRefuel] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'awaiting_refuel'");
        const [refuelInProgress] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'refuel_in_progress'");
        const [refuelCompleted] = await req.db.query("SELECT COUNT(*) as count FROM units WHERE current_section = 'refuel_completed'");
        
        // إحصائيات أنواع الوحدات لكل حالة
        const unitTypeStats = {};
        const sections = [
            'ready_for_loading', 'under_loading', 'in_transit_loaded', 'under_unloading', 
            'in_transit_empty', 'delivered', 'awaiting_maintenance', 'in_maintenance', 
            'awaiting_spare_parts', 'maintenance_completed', 'awaiting_documents', 
            'document_processing', 'document_completed', 'awaiting_refuel', 
            'refuel_in_progress', 'refuel_completed'
        ];
        
        for (const section of sections) {
            const [typeStats] = await req.db.query(`
                SELECT type, COUNT(*) as count 
                FROM units 
                WHERE current_section = ? 
                GROUP BY type
            `, [section]);
            
            unitTypeStats[section] = {};
            typeStats.forEach(stat => {
                unitTypeStats[section][stat.type] = stat.count;
            });
        }

        res.json({
            operations: {
                readyForLoading: readyForLoading[0].count,
                underLoading: underLoading[0].count,
                inTransitLoaded: inTransitLoaded[0].count,
                underUnloading: underUnloading[0].count,
                inTransitEmpty: inTransitEmpty[0].count,
                delivered: delivered[0].count
            },
            technical: {
                awaitingMaintenance: awaitingMaintenance[0].count,
                inMaintenance: inMaintenance[0].count,
                awaitingSpareParts: awaitingSpareParts[0].count,
                maintenanceCompleted: maintenanceCompleted[0].count
            },
            commercial: {
                awaitingDocuments: awaitingDocuments[0].count,
                documentProcessing: documentProcessing[0].count,
                documentCompleted: documentCompleted[0].count
            },
            fuel: {
                awaitingRefuel: awaitingRefuel[0].count,
                refuelInProgress: refuelInProgress[0].count,
                refuelCompleted: refuelCompleted[0].count
            },
            unitTypeStats: unitTypeStats
        });
    } catch (err) { 
        console.error("Comprehensive Stats Error:", err);
        res.status(500).json({ error: err.message }); 
    } finally { 
        if (req.db) req.db.end(); 
    }
});


// --- تشغيل الخادم ---
app.listen(PORT, () => {
    console.log(`🚀 UnitFlow Backend is running on http://localhost:${PORT}`);
});