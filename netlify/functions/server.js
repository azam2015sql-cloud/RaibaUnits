// Netlify Functions - Serverless Backend
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const createConnection = async () => {
    return mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'unitflow_db',
        port: process.env.DB_PORT || 3306
    });
};

// Helper function to execute queries
const withDB = (handler) => {
    return async (req, res) => {
        try {
            req.db = await createConnection();
            await handler(req, res);
        } catch (err) {
            console.error('Database Error:', err);
            res.status(500).json({ error: err.message });
        } finally {
            if (req.db) {
                await req.db.end();
            }
        }
    };
};

// Routes
app.get('/api/stats', withDB(async (req, res) => {
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
    } catch (err) {
        console.error("Stats Error:", err);
        res.status(500).json({ error: err.message });
    }
}));

app.get('/api/stats/comprehensive', withDB(async (req, res) => {
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
    }
}));

// Login endpoint
app.post('/api/login', withDB(async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
        }

        const [users] = await req.db.query(
            'SELECT * FROM employees WHERE username = ?', 
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        const user = users[0];
        
        // محاولة المقارنة المباشرة أولاً (للكلمات غير المشفرة)
        if (user.password === password) {
            // تسجيل الدخول ناجح
            const userResponse = {
                id: user.id,
                username: user.username,
                name: user.name,
                department: user.department,
                work_page: user.work_page
            };
            return res.json({ message: 'تم تسجيل الدخول بنجاح', user: userResponse });
        }
        
        // محاولة المقارنة مع bcrypt (للكلمات المشفرة)
        try {
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (isValidPassword) {
                const userResponse = {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    department: user.department,
                    work_page: user.work_page
                };
                return res.json({ message: 'تم تسجيل الدخول بنجاح', user: userResponse });
            }
        } catch (bcryptError) {
            console.log('Bcrypt comparison failed, password might be plain text');
        }

        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
}));

// Export for Netlify Functions
exports.handler = async (event, context) => {
    // Convert Netlify event to Express request
    const request = {
        method: event.httpMethod,
        url: event.path,
        headers: event.headers,
        body: event.body ? JSON.parse(event.body) : {}
    };

    const response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: ''
    };

    try {
        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
            return response;
        }

        // Route the request
        const result = await app(request, response);
        return result;
    } catch (error) {
        console.error('Handler Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
