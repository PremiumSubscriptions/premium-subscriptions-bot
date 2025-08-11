const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');

// Bot Configuration 
const BOT_TOKEN = process.env.BOT_TOKEN;
const BKASH_USERNAME = process.env.BKASH_USERNAME;
const BKASH_PASSWORD = process.env.BKASH_PASSWORD;
const BKASH_APP_KEY = process.env.BKASH_APP_KEY;
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET;
const ADMIN_ID = process.env.ADMIN_ID;
const BKASH_NUMBER = process.env.BKASH_NUMBER || '01902912653';
const NAGAD_NUMBER = process.env.NAGAD_NUMBER || '01902912653';
const CHANNEL_ID = process.env.CHANNEL_ID || -1002855286349;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Mehedi_X71';
const DATABASE_URL = process.env.DATABASE_URL;

// PostgreSQL Connection
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Admin management
const adminUsers = new Set([ADMIN_ID]);
const PORT = process.env.PORT || 10000;

// bKash API URLs
const BKASH_BASE_URL = 'https://tokenized.pay.bka.sh/v1.2.0-beta';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

// Storage
const users = new Map();
const pendingPayments = new Map();

// Database initialization
async function initializeDatabase() {
    try {
        // Create tables if they don't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS menus (
                id SERIAL PRIMARY KEY,
                menu_id VARCHAR(100) UNIQUE NOT NULL,
                name TEXT NOT NULL,
                type VARCHAR(20) DEFAULT 'menu',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS submenus (
                id SERIAL PRIMARY KEY,
                submenu_id VARCHAR(100) NOT NULL,
                menu_id VARCHAR(100) NOT NULL,
                name TEXT NOT NULL,
                type VARCHAR(20) DEFAULT 'submenu',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (menu_id) REFERENCES menus(menu_id) ON DELETE CASCADE,
                UNIQUE(submenu_id, menu_id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id SERIAL PRIMARY KEY,
                course_id VARCHAR(100) NOT NULL,
                menu_id VARCHAR(100) NOT NULL,
                submenu_id VARCHAR(100) NOT NULL,
                name TEXT NOT NULL,
                type VARCHAR(20) DEFAULT 'course',
                price INTEGER NOT NULL,
                group_link TEXT,
                payment_link TEXT,
                image_link TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(course_id, menu_id, submenu_id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) UNIQUE NOT NULL,
                username VARCHAR(100),
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                pending_course VARCHAR(100),
                pending_payment_method VARCHAR(20),
                current_menu VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_purchases (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                course_id VARCHAR(100) NOT NULL,
                menu_id VARCHAR(100) NOT NULL,
                submenu_id VARCHAR(100) NOT NULL,
                purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                transaction_id VARCHAR(100),
                payment_method VARCHAR(20),
                amount INTEGER,
                UNIQUE(user_id, course_id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(100) UNIQUE NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                course_id VARCHAR(100) NOT NULL,
                amount INTEGER NOT NULL,
                payment_method VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                admin_id VARCHAR(50) UNIQUE NOT NULL,
                username VARCHAR(100),
                is_primary BOOLEAN DEFAULT FALSE,
                added_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert primary admin if not exists
        await pool.query(`
            INSERT INTO admins (admin_id, is_primary) 
            VALUES ($1, TRUE) 
            ON CONFLICT (admin_id) DO NOTHING
        `, [ADMIN_ID]);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Database helper functions
async function getMenus() {
    try {
        const result = await pool.query('SELECT * FROM menus ORDER BY created_at');
        return result.rows;
    } catch (error) {
        console.error('Error getting menus:', error);
        return [];
    }
}

async function getSubmenus(menuId) {
    try {
        const result = await pool.query('SELECT * FROM submenus WHERE menu_id = $1 ORDER BY created_at', [menuId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting submenus:', error);
        return [];
    }
}

async function getCourses(menuId, submenuId) {
    try {
        const result = await pool.query(
            'SELECT * FROM courses WHERE menu_id = $1 AND submenu_id = $2 ORDER BY created_at',
            [menuId, submenuId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error getting courses:', error);
        return [];
    }
}

async function findCourseById(courseId) {
    try {
        const result = await pool.query('SELECT * FROM courses WHERE course_id = $1', [courseId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error finding course:', error);
        return null;
    }
}

async function getUserPurchases(userId) {
    try {
        const result = await pool.query('SELECT course_id FROM user_purchases WHERE user_id = $1', [userId]);
        return new Set(result.rows.map(row => row.course_id));
    } catch (error) {
        console.error('Error getting user purchases:', error);
        return new Set();
    }
}

async function isTransactionUsed(transactionId) {
    try {
        const result = await pool.query('SELECT id FROM transactions WHERE transaction_id = $1', [transactionId]);
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking transaction:', error);
        return false;
    }
}

async function addTransaction(transactionId, userId, courseId, amount, paymentMethod) {
    try {
        await pool.query(
            'INSERT INTO transactions (transaction_id, user_id, course_id, amount, payment_method) VALUES ($1, $2, $3, $4, $5)',
            [transactionId, userId, courseId, amount, paymentMethod]
        );
    } catch (error) {
        console.error('Error adding transaction:', error);
    }
}

async function removeTransaction(transactionId) {
    try {
        await pool.query('DELETE FROM transactions WHERE transaction_id = $1', [transactionId]);
        return true;
    } catch (error) {
        console.error('Error removing transaction:', error);
        return false;
    }
}

async function addUserPurchase(userId, courseId, menuId, submenuId, transactionId, paymentMethod, amount) {
    try {
        await pool.query(
            `INSERT INTO user_purchases (user_id, course_id, menu_id, submenu_id, transaction_id, payment_method, amount) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             ON CONFLICT (user_id, course_id) DO NOTHING`,
            [userId, courseId, menuId, submenuId, transactionId, paymentMethod, amount]
        );
    } catch (error) {
        console.error('Error adding user purchase:', error);
    }
}

async function getUserData(userId) {
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            // Create new user
            await pool.query(
                'INSERT INTO users (user_id) VALUES ($1)',
                [userId]
            );
            result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        }
        
        const userData = result.rows[0];
        userData.purchases = await getUserPurchases(userId);
        return userData;
    } catch (error) {
        console.error('Error getting user data:', error);
        return {
            user_id: userId,
            purchases: new Set(),
            pending_course: null,
            pending_payment_method: null,
            current_menu: null
        };
    }
}

async function updateUserData(userId, updates) {
    try {
        const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
        const values = [userId, ...Object.values(updates)];
        
        await pool.query(
            `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
            values
        );
    } catch (error) {
        console.error('Error updating user data:', error);
    }
}

// Helper functions
async function isAdmin(userId) {
    try {
        const result = await pool.query('SELECT id FROM admins WHERE admin_id = $1', [userId.toString()]);
        return result.rows.length > 0;
    } catch (error) {
        return adminUsers.has(userId.toString()); // fallback
    }
}

function isPrimaryAdmin(userId) {
    return userId.toString() === ADMIN_ID;
}

// bKash Token Management
let bkashToken = null;
let tokenExpiry = null;

async function getBkashToken() {
    if (bkashToken && tokenExpiry && Date.now() < tokenExpiry) {
        return bkashToken;
    }
    
    try {
        const response = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/token/grant`, {
            app_key: BKASH_APP_KEY,
            app_secret: BKASH_APP_SECRET
        }, {
            headers: {
                'Content-Type': 'application/json',
                'username': BKASH_USERNAME,
                'password': BKASH_PASSWORD
            }
        });
        
        bkashToken = response.data.id_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
        return bkashToken;
    } catch (error) {
        console.error('bKash token error:', error.message);
        throw error;
    }
}

async function verifyPayment(trxId) {
    try {
        const token = await getBkashToken();
        const response = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/general/searchTransaction`, {
            trxID: trxId
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token,
                'X-APP-Key': BKASH_APP_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error('Payment verification error:', error.message);
        return null;
    }
}

async function logTransaction(trxId, userId, amount, courseName, paymentMethod) {
    const message = `💰 **New Payment**\n\n` +
                   `👤 User: \`${userId}\`\n` +
                   `📚 Course: ${courseName}\n` +
                   `💵 Amount: ${amount} TK\n` +
                   `💳 Method: ${paymentMethod}\n` +
                   `🆔 TRX ID: \`${trxId}\`\n` +
                   `⏰ Time: ${new Date().toLocaleString()}`;

    await bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'Markdown' });
}

// Keyboard functions
async function getMainMenuKeyboard() {
    const menus = await getMenus();
    const keyboard = [];
    
    menus.forEach(menu => {
        keyboard.push([{ text: menu.name, callback_data: `menu_${menu.menu_id}` }]);
    });
    
    keyboard.push([
        { text: '🔥 Support 🔥', url: 'https://t.me/yoursupport' },
        { text: '🔥 Our Channel ❤️', url: 'https://t.me/yourchannel' }
    ]);
    
    return { reply_markup: { inline_keyboard: keyboard } };
}

async function getMenuKeyboard(menuId) {
    const submenus = await getSubmenus(menuId);
    const keyboard = [];
    
    submenus.forEach(submenu => {
        keyboard.push([{
            text: submenu.name,
            callback_data: `submenu_${menuId}_${submenu.submenu_id}`
        }]);
    });
    
    keyboard.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
    
    return { reply_markup: { inline_keyboard: keyboard } };
}

async function getSubmenuKeyboard(menuId, submenuId, userId) {
    const courses = await getCourses(menuId, submenuId);
    const userData = await getUserData(userId);
    const keyboard = [];
    
    for (const course of courses) {
        const status = userData.purchases.has(course.course_id) ? '✅ Purchased' : '❌ Not Purchased';
        keyboard.push([{
            text: `${course.name}\n${status}\nPrice: ${course.price} TK`,
            callback_data: `course_${course.course_id}`
        }]);
    }
    
    keyboard.push([
        { text: '⬅️ Back', callback_data: `menu_${menuId}` },
        { text: '🏠 Main Menu', callback_data: 'main_menu' }
    ]);
    
    return { reply_markup: { inline_keyboard: keyboard } };
}

async function getCourseKeyboard(courseId, userId, isPending = false) {
    const userData = await getUserData(userId);
    const course = await findCourseById(courseId);
    if (!course) return await getMainMenuKeyboard();
    
    const keyboard = [];
    
    if (userData.purchases.has(courseId)) {
        keyboard.push([{ text: '🎯 Join Course Group', url: course.group_link }]);
    } else if (isPending) {
        keyboard.push([
            { text: '💳 Pay Now', callback_data: `payment_method_${courseId}` },
            { text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }
        ]);
    } else {
        keyboard.push([{ text: '💳 Buy Now', callback_data: `buy_${courseId}` }]);
    }
    
    keyboard.push([
        { text: '⬅️ Back', callback_data: `submenu_${course.menu_id}_${course.submenu_id}` },
        { text: '🏠 Main Menu', callback_data: 'main_menu' }
    ]);
    
    return { reply_markup: { inline_keyboard: keyboard } };
}

// Bot Commands
bot.onText(/\/start/, async (msg) => {
    const mainKeyboard = await getMainMenuKeyboard();
    
    const welcomeText = `🎓 Welcome to HSC Courses Bot! 🎓

আমাদের premium courses গুলো দেখুন এবং আপনার পছন্দের course কিনুন।

💎 High Quality Content
📚 Expert Teachers  
🎯 Guaranteed Results
💯 24/7 Support`;

    bot.sendMessage(msg.chat.id, welcomeText, mainKeyboard);
});

// Admin Commands
bot.onText(/\/admin/, async (msg) => {
    if (!(await isAdmin(msg.from.id))) {
        return bot.sendMessage(msg.chat.id, '❌ You are not authorized!');
    }
    
    const isPrimary = isPrimaryAdmin(msg.from.id);
    
    const adminText = `🔧 Admin Panel ${isPrimary ? '(Primary Admin)' : '(Sub Admin)'}

📚 **Course Management:**
/addmenu - Add new main menu
/addsubmenu - Add submenu to main menu
/addcourse - Add course to submenu
/editcourse - Edit course details
/deletecourse - Delete course
/deletesubmenu - Delete submenu
/deletemenu - Delete main menu
/listall - Show all structure
/setimage - Set course image (reply to image)
/setdesc - Set course description (reply to text)

💰 **Payment Management:**
/updatebkash - Update bKash number
/updatenagad - Update Nagad number
/setpaymentlink - Set payment link for course

🔧 **Transaction Management:**
/checktrx - Check transaction status
/addtrx - Add transaction to used list
/removetrx - Remove transaction from used list

📊 **Analytics:**
/stats - View statistics
/users - View user count
/revenue - View revenue details` + 
(isPrimary ? `

👨‍💼 **Admin Management:**
/addadmin - Add new admin
/removeadmin - Remove admin
/listadmins - List all admins

🔧 **Examples:**
\`/addmenu hsc28 🔥HSC 2028 All Courses🔥\`
\`/addsubmenu hsc27 acs_chemistry ⚗️ ACS Chemistry All Course\`
\`/addcourse hsc27 acs_chemistry chemistry_basics ⚗️ Chemistry Basics|200|https://t.me/+chem|Basic chemistry course\`
\`/editcourse chemistry_basics price 250\`` : ``);

    bot.sendMessage(msg.chat.id, adminText, {parse_mode: 'Markdown'});
});

// Add Menu
bot.onText(/\/addmenu (.+)/, async (msg, match) => {
    if (!(await isAdmin(msg.from.id))) return;
    
    const params = match[1].trim();
    const parts = params.split(' ');
    
    if (parts.length < 2) {
        return bot.sendMessage(msg.chat.id, '❌ Format: /addmenu menuId menuName\n\nExample:\n/addmenu hsc28 🔥HSC 2028 All Courses🔥');
    }
    
    const menuId = parts[0];
    const menuName = parts.slice(1).join(' ');
    
    try {
        await pool.query(
            'INSERT INTO menus (menu_id, name) VALUES ($1, $2)',
            [menuId, menuName]
        );
        
        bot.sendMessage(msg.chat.id, `✅ Menu "${menuName}" created successfully!\n\n📚 Menu ID: ${menuId}`);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            bot.sendMessage(msg.chat.id, `❌ Menu "${menuId}" already exists!`);
        } else {
            console.error('Error adding menu:', error);
            bot.sendMessage(msg.chat.id, '❌ Error creating menu!');
        }
    }
});

// Add Submenu
bot.onText(/\/addsubmenu (.+)/, async (msg, match) => {
    if (!(await isAdmin(msg.from.id))) return;
    
    const params = match[1].trim();
    const parts = params.split(' ');
    
    if (parts.length < 3) {
        return bot.sendMessage(msg.chat.id, '❌ Format: /addsubmenu menuId submenuId submenuName\n\nExample:\n/addsubmenu hsc27 acs_chemistry ACS Chemistry All Course');
    }
    
    const menuId = parts[0];
    const submenuId = parts[1];
    const submenuName = parts.slice(2).join(' ');
    
    try {
        // Check if menu exists
        const menuResult = await pool.query('SELECT name FROM menus WHERE menu_id = $1', [menuId]);
        if (menuResult.rows.length === 0) {
            const menus = await getMenus();
            return bot.sendMessage(msg.chat.id, `❌ Menu "${menuId}" not found!\n\nAvailable menus: ${menus.map(m => m.menu_id).join(', ')}`);
        }
        
        await pool.query(
            'INSERT INTO submenus (submenu_id, menu_id, name) VALUES ($1, $2, $3)',
            [submenuId, menuId, submenuName]
        );
        
        bot.sendMessage(msg.chat.id, `✅ Submenu "${submenuName}" added to "${menuResult.rows[0].name}" successfully!\n\n📂 Submenu ID: ${submenuId}`);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            bot.sendMessage(msg.chat.id, `❌ Submenu "${submenuId}" already exists in menu "${menuId}"!`);
        } else {
            console.error('Error adding submenu:', error);
            bot.sendMessage(msg.chat.id, '❌ Error creating submenu!');
        }
    }
});

// Add Course
bot.onText(/\/addcourse (.+)/, async (msg, match) => {
    if (!(await isAdmin(msg.from.id))) return;
    
    const params = match[1].trim();
    const parts = params.split(' ');
    
    if (parts.length < 4) {
        return bot.sendMessage(msg.chat.id, '❌ Format: /addcourse menuId submenuId courseId courseName|price|groupLink|description\n\nExample:\n/addcourse hsc27 acs_chemistry new_course Chemistry Basics|200|https://t.me/+chem|Basic chemistry course');
    }
    
    const menuId = parts[0];
    const submenuId = parts[1];
    const courseId = parts[2];
    const courseInfo = parts.slice(3).join(' ');
    
    const courseData = courseInfo.split('|');
    
    if (courseData.length < 4) {
        return bot.sendMessage(msg.chat.id, '❌ Course data format: courseName|price|groupLink|description\n\nExample:\nChemistry Basics|200|https://t.me/+chem|Basic chemistry course');
    }
    
    const [courseName, price, groupLink, description] = courseData;
    const priceNum = parseInt(price.trim());
    
    if (isNaN(priceNum) || priceNum <= 0) {
        return bot.sendMessage(msg.chat.id, '❌ Invalid price! Must be a positive number.');
    }
    
    try {
        // Check if menu and submenu exist
        const submenuResult = await pool.query(
            'SELECT s.name as submenu_name, m.name as menu_name FROM submenus s JOIN menus m ON s.menu_id = m.menu_id WHERE s.submenu_id = $1 AND s.menu_id = $2',
            [submenuId, menuId]
        );
        
        if (submenuResult.rows.length === 0) {
            return bot.sendMessage(msg.chat.id, `❌ Menu "${menuId}" or submenu "${submenuId}" not found!`);
        }
        
        await pool.query(
            'INSERT INTO courses (course_id, menu_id, submenu_id, name, price, group_link, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [courseId, menuId, submenuId, courseName.trim(), priceNum, groupLink.trim(), description.trim()]
        );
        
        bot.sendMessage(msg.chat.id, `✅ Course "${courseName}" added successfully!\n\n📚 Menu: ${submenuResult.rows[0].menu_name}\n📂 Submenu: ${submenuResult.rows[0].submenu_name}\n📖 Course ID: ${courseId}\n💰 Price: ${priceNum} TK`);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            bot.sendMessage(msg.chat.id, `❌ Course "${courseId}" already exists!`);
        } else {
            console.error('Error adding course:', error);
            bot.sendMessage(msg.chat.id, '❌ Error creating course!');
        }
    }
});

// Transaction management commands
bot.onText(/\/checktrx (.+)/, async (msg, match) => {
    if (!(await isAdmin(msg.from.id))) return;
    
    const trxId = match[1];
    const isUsed = await isTransactionUsed(trxId);

    bot.sendMessage(
        msg.chat.id,
        `ℹ️ **TRX ID Status:** ${isUsed ? "🟢 Already Used" : "🔴 Not Used"}\n\n` +
        `ID: \`${trxId}\``,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/addtrx (.+)/, async (msg, match) => {
    if (!(await isAdmin(msg.from.id))) return;
    
    const trxId = match[1];
    try {
        await pool.query(
            'INSERT INTO transactions (transaction_id, user_id, course_id, amount, payment_method) VALUES ($1, $2, $3, $4, $5)',
            [trxId, 'admin_added', 'manual', 0, 'manual']
        );
        
        bot.sendMessage(
            msg.chat.id,
            `✅ **TRX ID Added to Used List**\n\n` +
            `\`${trxId}\` এখন থেকে ব্যবহার করা যাবে না।`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        if (error.code === '23505') {
            bot.sendMessage(msg.chat.id, `❌ Transaction ID already exists!`);
        } else {
            console.error('Error adding transaction:', error);
            bot.sendMessage(msg.chat.id, '❌ Error adding transaction!');
        }
    }
});

bot.onText(/\/removetrx (.+)/, async (msg, match) => {
    if (!(await isAdmin(msg.from.id))) return;
    
    const trxId = match[1];
    const success = await removeTransaction(trxId);
    
    if (success) {
        bot.sendMessage(
            msg.chat.id,
            `♻️ **TRX ID Removed from Used List**\n\n` +
            `\`${trxId}\` আবার ব্যবহার করা যাবে।`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(msg.chat.id, '❌ Error removing transaction or transaction not found!');
    }
});

// Callback Query Handler
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    
    bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'main_menu') {
        const mainKeyboard = await getMainMenuKeyboard();
        
        const welcomeText = `🎓 HSC Courses Bot - Main Menu 🎓

আপনার পছন্দের course category সিলেক্ট করুন:`;
        
        try {
            bot.editMessageText(welcomeText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...mainKeyboard
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, welcomeText, mainKeyboard);
        }
    }
    else if (data.startsWith('menu_')) {
        const menuId = data.replace('menu_', '');
        const menus = await getMenus();
        const menu = menus.find(m => m.menu_id === menuId);
        
        if (!menu) {
            return bot.sendMessage(msg.chat.id, '❌ Menu not found!');
        }
        
        const menuText = `${menu.name}

📚 Available Categories:`;
        
        try {
            const menuKeyboard = await getMenuKeyboard(menuId);
            bot.editMessageText(menuText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...menuKeyboard
            });
        } catch (error) {
            console.error('Error editing message:', error);
            const menuKeyboard = await getMenuKeyboard(menuId);
            bot.sendMessage(msg.chat.id, menuText, menuKeyboard);
        }
    }
    else if (data.startsWith('submenu_')) {
        const parts = data.replace('submenu_', '').split('_');
        const menuId = parts[0];
        const submenuId = parts.slice(1).join('_');
        
        const submenus = await getSubmenus(menuId);
        const submenu = submenus.find(s => s.submenu_id === submenuId);
        
        if (!submenu) {
            return bot.sendMessage(msg.chat.id, '❌ Submenu not found!');
        }
        
        const submenuText = `${submenu.name}

📚 Available Courses:`;
        
        try {
            const submenuKeyboard = await getSubmenuKeyboard(menuId, submenuId, userId);
            bot.editMessageText(submenuText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...submenuKeyboard
            });
        } catch (error) {
            console.error('Error editing message:', error);
            const submenuKeyboard = await getSubmenuKeyboard(menuId, submenuId, userId);
            bot.sendMessage(msg.chat.id, submenuText, submenuKeyboard);
        }
    }
    else if (data.startsWith('course_')) {
        const courseId = data.replace('course_', '');
        const course = await findCourseById(courseId);
        
        if (!course) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const userData = await getUserData(userId);
        const isPurchased = userData.purchases.has(courseId);
        const isPending = userData.pending_course === courseId;
        
        let courseText = `${course.name}\n\n`;
        courseText += course.description + '\n\n';
        
        if (isPurchased) {
            courseText += `Status: ✅ Purchased\n`;
            courseText += `💰 Price: ${course.price} TK\n\n`;
            courseText += `🎉 You have access to this course!\n`;
            courseText += `Click "Join Course Group" to access materials.`;
        } else if (isPending) {
            courseText += `Status: ⏳ Payment Pending\n`;
            courseText += `💰 Price: ${course.price} TK\n\n`;
            courseText += `💰 Payment Instructions:\n`;
            courseText += `1. Click on "Pay Now" button\n`;
            courseText += `2. Complete payment\n`;
            courseText += `3. Bkash থেকে payment করলে Transaction ID copy করুন, Nagad থেকে payment করলে payment এর screenshot নিন\n`;
            courseText += `4. "Submit Payment Proof" button এ click করুন`;
        } else {
            courseText += `Status: ❌ Not Purchased\n`;
            courseText += `💰 Price: ${course.price} TK`;
        }
        
        // Send with image if available
        if (course.image_link && !isPending && !isPurchased) {
            try {
                const courseKeyboard = await getCourseKeyboard(courseId, userId, isPending);
                await bot.sendPhoto(msg.chat.id, course.image_link, {
                    caption: courseText,
                    reply_markup: courseKeyboard.reply_markup
                });
                // Delete the original message
                try {
                    await bot.deleteMessage(msg.chat.id, msg.message_id);
                } catch (deleteError) {
                    console.log('Could not delete original message:', deleteError.message);
                }
                return;
            } catch (error) {
                console.error('Error sending course image:', error);
            }
        }
        
        try {
            const courseKeyboard = await getCourseKeyboard(courseId, userId, isPending);
            bot.editMessageText(courseText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...courseKeyboard
            });
        } catch (error) {
            console.error('Error editing message:', error);
            const courseKeyboard = await getCourseKeyboard(courseId, userId, isPending);
            bot.sendMessage(msg.chat.id, courseText, courseKeyboard);
        }
    }
    else if (data.startsWith('buy_')) {
        const courseId = data.replace('buy_', '');
        const course = await findCourseById(courseId);
        
        if (!course) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        await updateUserData(userId, { pending_course: courseId });
        
        const paymentText = `💳 Payment for ${course.name}

💰 Amount: ${course.price} TK

💡 Payment Options:
1. bKash or Nagad এ payment করুন
2. Bkash থেকে payment করলে Transaction ID copy করুন, Nagad থেকে payment করলে payment এর screenshot নিন
3. "Submit Payment Proof" button এ click করুন`;

        try {
            const courseKeyboard = await getCourseKeyboard(courseId, userId, true);
            bot.editMessageText(paymentText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...courseKeyboard
            });
        } catch (error) {
            console.error('Error editing message:', error);
            const courseKeyboard = await getCourseKeyboard(courseId, userId, true);
            bot.sendMessage(msg.chat.id, paymentText, courseKeyboard);
        }
    }
    else if (data.startsWith('payment_method_')) {
        const courseId = data.replace('payment_method_', '');
        const course = await findCourseById(courseId);
        
        if (!course) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const paymentText = `💳 Select Payment Method for ${course.name}\n\n💰 Amount: ${course.price} TK`;
        
        const paymentMethodKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'bKash', callback_data: `pay_bkash_${courseId}` }],
                    [{ text: 'Nagad', callback_data: `pay_nagad_${courseId}` }],
                    [{ text: '⬅️ Back', callback_data: `course_${courseId}` }]
                ]
            }
        };
        
        try {
            bot.editMessageText(paymentText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...paymentMethodKeyboard
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, paymentText, paymentMethodKeyboard);
        }
    }
    else if (data.startsWith('pay_bkash_')) {
        const courseId = data.replace('pay_bkash_', '');
        const course = await findCourseById(courseId);
        
        if (!course) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        await updateUserData(userId, { pending_payment_method: 'bKash' });
        
        let paymentText = `💳 bKash Payment for ${course.name}\n\n💰 Amount: ${course.price} TK\n📱 bKash Number: ${BKASH_NUMBER}\n\n`;
        let keyboard;
        
        if (course.payment_link) {
            paymentText += `💡 Payment Instructions:\n✅ Click "Pay with bKash Link" button below\n✅ Complete payment using the link\n✅ Copy the Transaction ID from bKash\n✅ Click "Submit Payment Proof" button\n✅ Enter only the Transaction ID (Example: 9BG4R2G5N8)\n\n🔹 bKash payment auto approve হবে!`;
            
            keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Pay with bKash Link', url: course.payment_link }],
                        [{ text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }],
                        [{ text: '⬅️ Back', callback_data: `payment_method_${courseId}` }]
                    ]
                }
            };
        } else {
            paymentText += `⚠️ Payment link is not added for this course. Please pay manually:\n\n💡 Manual Payment Instructions:\n✅ Make Payment ${course.price} TK to above bKash number\n✅ অবশ্যই Make Payment এ পেমেন্ট করবেন । ❌Send Money করলে হবে না!\n✅ Copy the Transaction ID from bKash\n✅ Click "Submit Payment Proof" button\n✅ Enter only the Transaction ID (Example: 9BG4R2G5N8)\n\n🔹 bKash payment auto approve হবে!`;
            
            keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }],
                        [{ text: '⬅️ Back', callback_data: `payment_method_${courseId}` }]
                    ]
                }
            };
        }
        
        try {
            bot.editMessageText(paymentText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...keyboard
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, paymentText, keyboard);
        }
    }
    else if (data.startsWith('pay_nagad_')) {
        const courseId = data.replace('pay_nagad_', '');
        const course = await findCourseById(courseId);
        
        if (!course) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        await updateUserData(userId, { pending_payment_method: 'Nagad' });
        
        const paymentText = `💳 Nagad Payment for ${course.name}\n\n💰 Amount: ${course.price} TK\n📱 Nagad Number: ${NAGAD_NUMBER}\n\n💡 Payment Instructions:\n✅ Send ${course.price} TK to above Nagad number- নগদ থেকে Send Money করুন\n✅ Take screenshot of payment\n✅ Click "Submit Payment Proof" button\n\n⚠️ Nagad payment manually approve হবে!\nPayment এর screenshot & course name সহ এডমিন কে মেসেজ দাও: https://t.me/${ADMIN_USERNAME}`;
        
        try {
            bot.editMessageText(paymentText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }],
                        [{ text: '💬 Message Admin', url: `https://t.me/${ADMIN_USERNAME}` }],
                        [{ text: '⬅️ Back', callback_data: `payment_method_${courseId}` }]
                    ]
                }
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, paymentText, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }],
                        [{ text: '💬 Message Admin', url: `https://t.me/${ADMIN_USERNAME}` }],
                        [{ text: '⬅️ Back', callback_data: `payment_method_${courseId}` }]
                    ]
                }
            });
        }
    }
    else if (data.startsWith('submit_proof_')) {
        const courseId = data.replace('submit_proof_', '');
        const course = await findCourseById(courseId);
        const userData = await getUserData(userId);
        
        if (!course) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const paymentMethod = userData.pending_payment_method || 'bKash';
        
        const trxText = `📝 Submit Your Payment Proof\n\n💡 Instructions:\n${paymentMethod === 'bKash' ? '✅ Enter your bKash Transaction ID (Example: 9BG4R2G5N8)' : '✅ Send screenshot of your Nagad payment'}\n\n📱 ${course.name} এর জন্য payment verification\n💰 Amount: ${course.price} TK\n💳 Method: ${paymentMethod}`;
        
        bot.sendMessage(msg.chat.id, trxText, {
            reply_markup: {
                inline_keyboard: [[
                    { text: '❌ Cancel', callback_data: `course_${courseId}` }
                ]]
            }
        });
        
        await updateUserData(userId, { 
            waiting_for_proof: JSON.stringify({ courseId, paymentMethod })
        });
    }
    else if (data.startsWith('approve_') || data.startsWith('reject_')) {
        if (!(await isAdmin(callbackQuery.from.id))) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ You are not authorized!', show_alert: true });
        }
        
        const parts = data.split('_');
        const action = parts[0];
        const targetUserId = parts[1];
        const courseId = parts[2];
        
        const userData = await getUserData(targetUserId);
        const course = await findCourseById(courseId);
        
        if (!course) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!', show_alert: true });
        }
        
        if (action === 'approve') {
            await addUserPurchase(targetUserId, courseId, course.menu_id, course.submenu_id, 'manual_approve', 'manual', course.price);
            await updateUserData(targetUserId, { 
                pending_course: null, 
                pending_payment_method: null 
            });
            
            // Notify user
            bot.sendMessage(targetUserId, `✅ **Your payment for ${course.name} has been approved!**\n\n🎯 Join your course group:\n👉 ${course.group_link}`, {
                parse_mode: 'Markdown'
            });
            
            // Update admin
            bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Payment approved!', show_alert: true });
            try {
                bot.editMessageReplyMarkup({
                    inline_keyboard: [[
                        { text: '✅ Approved', callback_data: 'already_approved' }
                    ]]
                }, {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id
                });
            } catch (error) {
                console.log('Could not update admin message markup');
            }
            
        } else if (action === 'reject') {
            // Notify user
            bot.sendMessage(targetUserId, `❌ **Your payment proof for ${course.name} was rejected.**\n\n💡 Please submit valid payment proof or contact support.`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💬 Contact Support', url: 'https://t.me/yoursupport' }]
                    ]
                }
            });
            
            // Update admin
            bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Payment rejected!', show_alert: true });
            try {
                bot.editMessageReplyMarkup({
                    inline_keyboard: [[
                        { text: '❌ Rejected', callback_data: 'already_rejected' }
                    ]]
                }, {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id
                });
            } catch (error) {
                console.log('Could not update admin message markup');
            }
        }
    }
});

// Handle Payment Proof Input
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const userId = msg.from.id;
    const userData = await getUserData(userId);
    
    if (userData.waiting_for_proof) {
        const proofData = JSON.parse(userData.waiting_for_proof);
        const { courseId, paymentMethod } = proofData;
        const course = await findCourseById(courseId);
        
        if (!course) {
            await updateUserData(userId, { waiting_for_proof: null });
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        await updateUserData(userId, { waiting_for_proof: null });
        
        if (msg.photo) {
            // Handle photo proof (mainly for Nagad)
            const photo = msg.photo[msg.photo.length - 1];
            const fileId = photo.file_id;
            
            // Notify admin
            const adminMessage = `🆕 New Payment Proof\n\n` +
                               `👤 User: \`${userId}\`\n` +
                               `📚 Course: ${course.name}\n` +
                               `💰 Amount: ${course.price} TK\n` +
                               `💳 Method: ${paymentMethod}\n\n` +
                               `⚠️ Manual approval required`;
            
            try {
                await bot.sendPhoto(ADMIN_ID, fileId, {
                    caption: adminMessage,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ Approve', callback_data: `approve_${userId}_${courseId}` },
                                { text: '❌ Reject', callback_data: `reject_${userId}_${courseId}` }
                            ]
                        ]
                    }
                });
                
                bot.sendMessage(msg.chat.id, `✅ Payment proof received for ${course.name}!\n\nAdmin will verify your payment shortly.`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💬 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` }]
                        ]
                    }
                });
                
            } catch (error) {
                console.error('Error sending proof to admin:', error);
                bot.sendMessage(msg.chat.id, '⚠️ Error submitting payment proof. Please try again or contact support.');
            }
            
        } else if (msg.text && paymentMethod === 'bKash') {
            // Handle bKash TRX ID
            const trxId = msg.text.trim();
            
            // Check if TRX ID already used
            if (await isTransactionUsed(trxId)) {
                return bot.sendMessage(
                    msg.chat.id, 
                    "❌ **এই Transaction ID আগেই ব্যবহার করা হয়েছে!**\n\n" +
                    "দয়া করে নতুন একটি Transaction ID দিন অথবা সাপোর্টে যোগাযোগ করুন।",
                    { parse_mode: 'Markdown' }
                );
            }
            
            bot.sendMessage(msg.chat.id, '⏳ Verifying payment... Please wait...');
            
            try {
                const paymentData = await verifyPayment(trxId);
                
                if (paymentData && paymentData.transactionStatus === 'Completed' && 
                    parseInt(paymentData.amount) >= course.price) {
                    
                    // Save to database and mark as used
                    await addTransaction(trxId, userId, courseId, course.price, paymentMethod);
                    await logTransaction(trxId, userId, course.price, course.name, paymentMethod);
                    
                    await addUserPurchase(userId, courseId, course.menu_id, course.submenu_id, trxId, paymentMethod, course.price);
                    await updateUserData(userId, { 
                        pending_course: null, 
                        pending_payment_method: null 
                    });
                    
                    const successText = `✅ **পেমেন্ট সফলভাবে ভেরিফাই হয়েছে!**\n\n` +
                                       `📱 ${course.name} Unlocked!\n` +
                                       `💰 Amount: ${course.price} TK\n` +
                                       `🎫 Transaction ID: ${trxId}\n\n` +
                                       `🎯 Join your course group:\n👉 Click the button below`;
                    
                    bot.sendMessage(msg.chat.id, successText, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: `🎯 Join ${course.name} Group`, url: course.group_link }],
                                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                            ]
                        }
                    });
                    
                } else {
                    bot.sendMessage(msg.chat.id, `❌ Payment Verification Failed!\n\n🔍 Possible reasons:\n• Transaction ID not found\n• Payment amount insufficient\n• Payment not completed\n\n💡 Please check your Transaction ID and try again.\n\nTransaction ID entered: ${trxId}`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }],
                                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                            ]
                        }
                    });
                }
                
            } catch (error) {
                console.error('Payment verification error:', error);
                bot.sendMessage(msg.chat.id, `⚠️ Verification Error!\n\nSomething went wrong while verifying your payment. Please contact support.\n\nTransaction ID: ${trxId}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💬 Contact Support', url: 'https://t.me/yoursupport' }],
                            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                        ]
                    }
                });
            }
        } else {
            bot.sendMessage(msg.chat.id, '⚠️ Please send a screenshot of your payment or the transaction ID (for bKash only).');
        }
    }
});

// Express server
app.get('/', (req, res) => {
    res.send('HSC Courses Bot is running with PostgreSQL Database!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize and start bot
initializeDatabase().then(() => {
    console.log('HSC Courses Bot started successfully with PostgreSQL!');
}).catch(error => {
    console.error('Error starting bot:', error);
});