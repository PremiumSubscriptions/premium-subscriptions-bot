const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');

// Global Error Handling to prevent crashes (Fixes EFATAL & AggregateError)
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    // Bot continues running
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error.message);
    // Bot continues running
});

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

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const adminUsers = new Set([ADMIN_ID]);
const PORT = process.env.PORT || 10000;
const BKASH_BASE_URL = 'https://tokenized.pay.bka.sh/v1.2.0-beta';

// 👇 UPDATED: Robust Polling Configuration
// Short interval and timeout helps recover from cloud network drops quickly
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
        interval: 300,      // Check for messages every 300ms
        autoStart: true,
        params: {
            timeout: 10     // Short timeout to prevent "hanging" connections
        }
    }
});

bot.on('polling_error', (error) => {
  console.error('Polling Error (Handled):', error.message); 
});

const app = express();

// User states for navigation
const userStates = new Map();

// Global variable for dynamic courses
let COURSES_DATA = {}; 

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'PremiumSubscriptions'; // আপনার গিটহাব ইউজারনেম
const REPO_NAME = 'CourseDataDB'; // আপনার রিপোজিটরির নাম

// 🧠 The Dynamic Fetching Engine (Auto-Discover & Auto-Healing)
async function syncCourseData() {
    console.log("🔄 Syncing course data from GitHub...");
    let newData = {};
    let hasError = false;

    try {
        // Step 1: Auto-discover all JSON files in the root of the repo
        const rootUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/`;
        const rootResponse = await axios.get(rootUrl, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        // Filter out only files ending with .json
        const jsonFiles = rootResponse.data.filter(item => item.name.endsWith('.json'));
        
        if (jsonFiles.length === 0) {
            console.warn("⚠️ No JSON files found in the repository!");
            return false;
        }

        console.log(`📁 Found ${jsonFiles.length} JSON files. Starting download...`);

        // Step 2: Download each JSON file
        for (const file of jsonFiles) {
            try {
                // file.name includes the extension (e.g., "hsc28.json"), so we remove it for the key
                const fileKey = file.name.replace('.json', '');
                
                const fileResponse = await axios.get(file.url, {
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                // GitHub API returns Base64 encoded content
                const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
                newData[fileKey] = JSON.parse(content);
                console.log(`✅ Loaded: ${file.name}`);
            } catch (fileError) {
                console.error(`❌ Failed to fetch or parse ${file.name}:`, fileError.message);
                hasError = true;
                break; // Stop updating if any file is corrupted
            }
        }

    } catch (rootError) {
        console.error(`❌ Failed to connect to repository ${REPO_NAME}:`, rootError.message);
        hasError = true;
    }

    // Step 3: Fallback Logic
    if (!hasError && Object.keys(newData).length > 0) {
        COURSES_DATA = newData;
        console.log("🎉 All courses successfully synced & updated in RAM!");
        return true;
    } else {
        console.log("⚠️ Sync failed! Keeping the last known good state in RAM.");
        return false;
    }
}

// Database initialization
async function initializeDatabase() {
    try {
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
                waiting_for_proof TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                payment_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE transactions ADD COLUMN payment_date DATE NOT NULL DEFAULT CURRENT_DATE;
                EXCEPTION
                    WHEN duplicate_column THEN
                        NULL;
                END;
            END $$;
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
                payment_date DATE
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

// Helper functions
function getMenus() {
    return Object.entries(COURSES_DATA).map(([menuId, menu]) => ({
        menu_id: menuId,
        name: menu.name,
        type: menu.type
    }));
}

function getSubmenus(menuId) {
    const menu = COURSES_DATA[menuId];
    if (!menu || !menu.submenus) return [];
    return Object.entries(menu.submenus).map(([submenuId, submenu]) => ({
        submenu_id: submenuId,
        menu_id: menuId,
        name: submenu.name,
        type: submenu.type
    }));
}

// 🆕 New Helper for Categories (For HSC 28)
function getCategories(menuId, submenuId) {
    const submenu = COURSES_DATA[menuId]?.submenus?.[submenuId];
    if (!submenu || !submenu.categories) return [];
    
    return Object.entries(submenu.categories).map(([catId, category]) => ({
        category_id: catId,
        menu_id: menuId,
        submenu_id: submenuId,
        name: category.name,
        type: category.type
    }));
}

// 🔄 Modified to support both Old (courses) and New (categories) structures
function getCourses(menuId, submenuId, categoryId = null) {
    const submenu = COURSES_DATA[menuId]?.submenus?.[submenuId];
    if (!submenu) return [];
    
    let coursesObj = {};
    if (categoryId && submenu.categories && submenu.categories[categoryId]) {
        coursesObj = submenu.categories[categoryId].courses || {};
    } else if (submenu.courses) {
        coursesObj = submenu.courses;
    }

    return Object.entries(coursesObj).map(([courseId, course]) => ({
        course_id: courseId,
        menu_id: menuId,
        submenu_id: submenuId,
        category_id: categoryId,
        name: course.name,
        type: course.type,
        price: course.price,
        group_link: course.groupLink,
        payment_link: course.paymentLink,
        image_link: course.imageLink,
        description: course.description
    }));
}

// 🔄 Modified to search everywhere safely
function findCourseById(courseId) {
    for (const [menuId, menu] of Object.entries(COURSES_DATA)) {
        if (menu.submenus) {
            for (const [submenuId, submenu] of Object.entries(menu.submenus)) {
                
                // Check in old structure (Direct Courses)
                if (submenu.courses && submenu.courses[courseId]) {
                    const course = submenu.courses[courseId];
                    return { course_id: courseId, menu_id: menuId, submenu_id: submenuId, category_id: null, ...course, group_link: course.groupLink, payment_link: course.paymentLink, image_link: course.imageLink };
                }
                
                // Check in new structure (Categories -> Courses)
                if (submenu.categories) {
                    for (const [catId, category] of Object.entries(submenu.categories)) {
                        if (category.courses && category.courses[courseId]) {
                            const course = category.courses[courseId];
                            return { course_id: courseId, menu_id: menuId, submenu_id: submenuId, category_id: catId, ...course, group_link: course.groupLink, payment_link: course.paymentLink, image_link: course.imageLink };
                        }
                    }
                }
            }
        }
    }
    return null;
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

async function addTransaction(transactionId, userId, courseId, amount, paymentMethod, paymentDate) {
    try {
        if (!transactionId || !userId || !courseId || amount === undefined || !paymentMethod || !paymentDate) {
            console.error('❌ Missing parameters for addTransaction');
            return false;
        }

        const userIdStr = userId.toString();
        const amountInt = parseInt(amount);
        
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const formattedDate = paymentDate instanceof Date ? paymentDate.toISOString().split('T')[0] : paymentDate;
        
        if (!dateRegex.test(formattedDate)) {
            console.error('❌ Invalid date format:', paymentDate);
            return false;
        }

        await pool.query(
            'INSERT INTO transactions (transaction_id, user_id, course_id, amount, payment_method, payment_date) VALUES ($1, $2, $3, $4, $5, $6)',
            [transactionId, userIdStr, courseId, amountInt, paymentMethod, formattedDate]
        );
        
        console.log('✅ Transaction added:', transactionId);
        return true;
    } catch (error) {
        if (error.code === '23505') {
            console.error('❌ Duplicate transaction ID:', transactionId);
        } else {
            console.error('❌ Database error:', error.code, error.message);
        }
        return false;
    }
}

async function addUserPurchase(userId, courseId, menuId, submenuId, transactionId, paymentMethod, amount, paymentDate) {
    try {
        await pool.query(`
            INSERT INTO user_purchases (
                user_id, 
                course_id, 
                menu_id, 
                submenu_id, 
                transaction_id, 
                payment_method, 
                amount, 
                payment_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [userId, courseId, menuId, submenuId, transactionId, paymentMethod, amount, paymentDate]);
    } catch (error) {
        console.error('Error adding user purchase:', error);
    }
}

async function getUserData(userId) {
    try {
        let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO users (user_id) VALUES ($1)', [userId]);
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
            current_menu: null,
            waiting_for_proof: null
        };
    }
}

async function updateUserData(userId, updates) {
    try {
        const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
        const values = [userId, ...Object.values(updates)];
        await pool.query(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, values);
    } catch (error) {
        console.error('Error updating user data:', error);
    }
}

async function isAdmin(userId) {
    try {
        const result = await pool.query('SELECT id FROM admins WHERE admin_id = $1', [userId.toString()]);
        return result.rows.length > 0;
    } catch (error) {
        return adminUsers.has(userId.toString());
    }
}

function isPrimaryAdmin(userId) {
    return userId.toString() === ADMIN_ID;
}

// bKash payment verification
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

async function verifyPaymentWithDateCheck(trxId) {
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

        const paymentData = response.data;
        if (!paymentData || !paymentData.completedTime) {
            return { success: false, error: 'Payment not found or incomplete' };
        }

        const [datePart, timePart] = paymentData.completedTime.split('T');
        const [hours, minutes, seconds] = timePart.split(':');
        const paymentDateTime = new Date(`${datePart}T${hours}:${minutes}:${seconds}+06:00`);
        const validityEndTime = new Date(paymentDateTime.getTime() + 24 * 60 * 60 * 1000);
        const currentTime = new Date();

        if (currentTime > validityEndTime) {
            return {
                success: false,
                error: `Transaction expired! Valid only for 24 hours after payment.\n\nPayment Time: ${paymentDateTime.toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}`,
                paymentDate: datePart,
                paymentTime: paymentDateTime
            };
        }

        return {
            success: true,
            data: paymentData,
            paymentDate: datePart,
            paymentTime: paymentDateTime
        };
    } catch (error) {
        console.error('Payment verification error:', error.message);
        return { success: false, error: 'Verification failed' };
    }
}

async function logTransaction(trxId, userId, amount, courseName, paymentMethod, paymentDate) {
    const message = `💰 **New Payment**\n\n` +
        `👤 User: \`${userId}\`\n` +
        `📚 Course: ${courseName}\n` +
        `💵 Amount: ${amount} TK\n` +
        `💳 Method: ${paymentMethod}\n` +
        `🆔 TRX ID: \`${trxId}\`\n` +
        `📅 Payment Date: ${paymentDate}\n` +
        `⏰ Time: ${new Date().toLocaleString()}`;

    try {
        await bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error sending log message:', error);
    }
}

// Reply Keyboard Functions
function getMainMenuKeyboard() {
    const menus = getMenus();
    const keyboard = [];
    
    menus.forEach(menu => {
        keyboard.push([menu.name]);
    });
    
    keyboard.push(['🔥 Support 🔥', '🔥 Our Channel ❤️']);
    
    return {
        reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
}

function getMenuKeyboard(menuId) {
    const submenus = getSubmenus(menuId);
    const keyboard = [];
    
    submenus.forEach(submenu => {
        keyboard.push([submenu.name]);
    });
    
    keyboard.push(['🏠 Main Menu']);
    
    return {
        reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
}

async function getSubmenuKeyboard(menuId, submenuId, userId) {
    const courses = getCourses(menuId, submenuId);
    const keyboard = [];
    
    for (const course of courses) {
        keyboard.push([`${course.name} - ${course.price} TK`]);
    }
    
    keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    
    return {
        reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
}
// 🆕 For HSC 28 Categories
async function getCategoryKeyboard(menuId, submenuId) {
    const categories = getCategories(menuId, submenuId);
    const keyboard = [];
    categories.forEach(category => {
        keyboard.push([category.name]);
    });
    keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    return {
        reply_markup: { keyboard: keyboard, resize_keyboard: true, one_time_keyboard: false }
    };
}

// 🆕 For Courses inside Categories
async function getCourseListKeyboard(menuId, submenuId, categoryId) {
    const courses = getCourses(menuId, submenuId, categoryId);
    const keyboard = [];
    for (const course of courses) {
        keyboard.push([`${course.name} - ${course.price} TK`]);
    }
    keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    return {
        reply_markup: { keyboard: keyboard, resize_keyboard: true, one_time_keyboard: false }
    };
}
async function getCourseKeyboard(courseId, userId) {
    const course = findCourseById(courseId);
    if (!course) return getMainMenuKeyboard();
    
    const keyboard = [];
    const userData = await getUserData(userId);
    
    keyboard.push(['💳 Buy Now']);
    
    if (userData.purchases.has(courseId)) {
        keyboard.push(['🎯 Join Course Group']);
    }
    
    keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    
    return {
        reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
}
function getPaymentMethodKeyboard() {
    return {
        reply_markup: {
            keyboard: [
                ['bKash'],
                ['Nagad'],
                ['⬅️ Back', '🏠 Main Menu']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
}
function getBkashPaymentKeyboard(hasPaymentLink = false) {
    const keyboard = [];
    
    if (hasPaymentLink) {
        keyboard.push(['💳 Use bKash Link']);
    }
    keyboard.push(['📝 Submit Payment Proof']);
    keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    
    return {
        reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
}
function getNagadPaymentKeyboard() {
    return {
        reply_markup: {
            keyboard: [
                ['💬 Contact Admin'],
                ['⬅️ Back', '🏠 Main Menu']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
}

function getCancelKeyboard() {
    return {
        reply_markup: {
            keyboard: [
                ['❌ Cancel'],
                ['🏠 Main Menu']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
}

function getPaymentConfirmationKeyboard() {
    return {
        reply_markup: {
            keyboard: [
                ['✅ Yes, I Paid'],
                ['❌ Cancel Payment']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
}

function getCallbackData(action, courseId, paymentMethod = '') {
    return `${action}_${courseId}_${paymentMethod}`;
}

// ------------------------------------
// BOT COMMANDS & HANDLERS (UPDATED)
// ------------------------------------

bot.onText(/\/start/, async (msg) => {
    try {
        const userId = msg.from.id;
        userStates.delete(userId);
        
        const mainKeyboard = getMainMenuKeyboard();
        
        const welcomeText = `🎓 Welcome to Premium Subscription Bot! 🎓

আমাদের premium courses গুলো দেখুন এবং আপনার পছন্দের course কিনুন।

💎 High Quality Content
📚 Expert Teachers  
🎯 Guaranteed Results
💯 24/7 Support
🎓Bot Refresh করতে /start command ব্যাবহার করুন !

Course কিনতে সমস্যা হলে <a href="https://t.me/premium_subscriptionss/1194">ভিডিওটি দেখবেন</a>`;
        const options = {
            parse_mode: 'HTML',
            ...mainKeyboard
        };
        
        await bot.sendMessage(msg.chat.id, welcomeText, options);
    } catch (error) {
        console.error('Error in /start:', error.message);
    }
});

bot.onText(/\/admin/, async (msg) => {
    try {
        if (!(await isAdmin(msg.from.id))) {
            return bot.sendMessage(msg.chat.id, '❌ You are not authorized!');
        }
        const isPrimary = isPrimaryAdmin(msg.from.id);
        const adminText = `🔧 Admin Panel ${isPrimary ? '(Primary Admin)' : '(Sub Admin)'}
🔧 **Available Commands:**
/checktrx - Check transaction status
/addtrx - Add transaction to used list
/removetrx - Remove transaction from used list` + 
        (isPrimary ? `

👨‍💼 **Admin Management:**
/addadmin - Add new admin
/removeadmin - Remove admin
/listadmins - List all admins

📝 **Note:** To update courses, edit the COURSES_DATA in bot.js file and redeploy.` : ``);

        await bot.sendMessage(msg.chat.id, adminText, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in /admin:', error.message);
    }
});

bot.onText(/\/checktrx (.+)/, async (msg, match) => {
    try {
        if (!(await isAdmin(msg.from.id))) return;
        
        const trxId = match[1];
        const isUsed = await isTransactionUsed(trxId);
        
        await bot.sendMessage(msg.chat.id, 
            `ℹ️ **TRX ID Status:** ${isUsed ? "🟢 Already Used" : "🔴 Not Used"}\n\n` +
            `ID: \`${trxId}\``, 
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error in /checktrx:', error.message);
    }
});

bot.onText(/\/addtrx (.+)/, async (msg, match) => {
    try {
        if (!(await isAdmin(msg.from.id))) return;
        
        const trxId = match[1];
        try {
            await pool.query(
                'INSERT INTO transactions (transaction_id, user_id, course_id, amount, payment_method, payment_date) VALUES ($1, $2, $3, $4, $5, $6)',
                [trxId, 'admin_added', 'manual', 0, 'manual', new Date().toISOString().split('T')[0]]
            );
            
            await bot.sendMessage(msg.chat.id,
                `✅ **TRX ID Added to Used List**\n\n` +
                `\`${trxId}\` এখন থেকে ব্যবহার করা যাবে না।`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            if (error.code === '23505') {
                await bot.sendMessage(msg.chat.id, `❌ Transaction ID already exists!`);
            } else {
                console.error('Error adding transaction:', error);
                await bot.sendMessage(msg.chat.id, '❌ Error adding transaction!');
            }
        }
    } catch (error) {
        console.error('Error in /addtrx:', error.message);
    }
});

bot.onText(/\/removetrx (.+)/, async (msg, match) => {
    try {
        if (!(await isAdmin(msg.from.id))) return;
        
        const trxId = match[1];
        try {
            const result = await pool.query('DELETE FROM transactions WHERE transaction_id = $1', [trxId]);
            
            if (result.rowCount > 0) {
                await bot.sendMessage(msg.chat.id,
                    `♻️ **TRX ID Removed from Used List**\n\n` +
                    `\`${trxId}\` আবার ব্যবহার করা যাবে।`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await bot.sendMessage(msg.chat.id, '❌ Transaction not found!');
            }
        } catch (error) {
            console.error('Error removing transaction:', error);
            await bot.sendMessage(msg.chat.id, '❌ Error removing transaction!');
        }
    } catch (error) {
        console.error('Error in /removetrx:', error.message);
    }
});

bot.onText(/\/addadmin (.+)/, async (msg, match) => {
    try {
        if (!isPrimaryAdmin(msg.from.id)) {
            return bot.sendMessage(msg.chat.id, '❌ Only primary admin can add new admins!');
        }
        
        const adminId = match[1];
        try {
            await pool.query('INSERT INTO admins (admin_id, added_by) VALUES ($1, $2)', [adminId, msg.from.id]);
            await bot.sendMessage(msg.chat.id, `✅ Admin ${adminId} added successfully!`);
        } catch (error) {
            if (error.code === '23505') {
                await bot.sendMessage(msg.chat.id, `❌ Admin ${adminId} already exists!`);
            } else {
                console.error('Error adding admin:', error);
                await bot.sendMessage(msg.chat.id, '❌ Error adding admin!');
            }
        }
    } catch (error) {
        console.error('Error in /addadmin:', error.message);
    }
});

bot.onText(/\/removeadmin (.+)/, async (msg, match) => {
    try {
        if (!isPrimaryAdmin(msg.from.id)) {
            return bot.sendMessage(msg.chat.id, '❌ Only primary admin can remove admins!');
        }
        
        const adminId = match[1];
        if (adminId === ADMIN_ID) {
            return bot.sendMessage(msg.chat.id, '❌ Cannot remove primary admin!');
        }
        
        try {
            const result = await pool.query('DELETE FROM admins WHERE admin_id = $1 AND is_primary = FALSE', [adminId]);
            
            if (result.rowCount > 0) {
                await bot.sendMessage(msg.chat.id, `✅ Admin ${adminId} removed successfully!`);
            } else {
                await bot.sendMessage(msg.chat.id, '❌ Admin not found or is primary admin!');
            }
        } catch (error) {
            console.error('Error removing admin:', error);
            await bot.sendMessage(msg.chat.id, '❌ Error removing admin!');
        }
    } catch (error) {
        console.error('Error in /removeadmin:', error.message);
    }
});

bot.onText(/\/listadmins/, async (msg) => {
    try {
        if (!isPrimaryAdmin(msg.from.id)) {
            return bot.sendMessage(msg.chat.id, '❌ Only primary admin can view admin list!');
        }
        
        try {
            const result = await pool.query('SELECT admin_id, is_primary FROM admins ORDER BY is_primary DESC, created_at');
            let adminList = '👥 **Admin List:**\n\n';
            
            result.rows.forEach((admin, index) => {
                adminList += `${index + 1}. \`${admin.admin_id}\` ${admin.is_primary ? '(Primary)' : '(Sub Admin)'}\n`;
            });
            
            await bot.sendMessage(msg.chat.id, adminList, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error listing admins:', error);
            await bot.sendMessage(msg.chat.id, '❌ Error fetching admin list!');
        }
    } catch (error) {
        console.error('Error in /listadmins:', error.message);
    }
});
bot.onText(/\/sync/, async (msg) => {
    try {
        if (!(await isAdmin(msg.from.id))) {
            return bot.sendMessage(msg.chat.id, '❌ You are not authorized!');
        }
        
        await bot.sendMessage(msg.chat.id, '🔄 Syncing courses from GitHub Cloud... Please wait.');
        
        const success = await syncCourseData();
        
        if (success) {
            await bot.sendMessage(msg.chat.id, '✅ **Sync Complete!**\n\nAll courses have been updated from GitHub without restarting the bot.', { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(msg.chat.id, '❌ **Sync Failed!**\n\nThere was an error fetching data or parsing JSON. Check console logs.', { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error('Error in /sync:', error.message);
    }
});
bot.on('message', async (msg) => {
    try {
        if (msg.text && msg.text.startsWith('/')) return;
        
        const userId = msg.from.id;
        const messageText = msg.text?.trim();
        const userData = await getUserData(userId);
        
        // 1. Handle Payment Proof Submission (bKash/Nagad) - Keep existing logic untouched!
        if (userData.waiting_for_proof) {
            const proofData = JSON.parse(userData.waiting_for_proof);
            const { courseId, paymentMethod } = proofData;
            const course = findCourseById(courseId);
            
            if (!course) {
                await updateUserData(userId, { waiting_for_proof: null });
                return bot.sendMessage(msg.chat.id, '❌ Course not found!');
            }

            await updateUserData(userId, { waiting_for_proof: null });

            if (msg.photo && paymentMethod === 'Nagad') {
                const photo = msg.photo[msg.photo.length - 1];
                const fileId = photo.file_id;
                
                const adminMessage = `🆕 New Payment Proof (Nagad)\n\n` +
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
                            inline_keyboard: [[
                                { text: '✅ Approve', callback_data: `approve_${userId}_${courseId}` },
                                { text: '❌ Reject', callback_data: `reject_${userId}_${courseId}` }
                            ]]
                        }
                    });

                    return bot.sendMessage(msg.chat.id, 
                        `✅ Payment proof received for ${course.name}!\n\nAdmin will verify your payment shortly.`,
                        { reply_markup: { inline_keyboard: [[ { text: '💬 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` } ]] } }
                    );
                } catch (error) {
                    console.error('Error sending proof to admin:', error);
                    return bot.sendMessage(msg.chat.id, '⚠️ Error submitting payment proof. Please try again or contact support.');
                }
            }
            else if (msg.text && paymentMethod === 'bKash') {
                const trxId = msg.text.trim();
                await bot.sendMessage(msg.chat.id, '⏳ Verifying payment time validity...');

                try {
                    const verificationResult = await verifyPaymentWithDateCheck(trxId);
                    
                    if (!verificationResult.success) {
                        return bot.sendMessage(msg.chat.id, 
                            `❌ **${verificationResult.error}**`,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '🔄 Try Another TRX ID', callback_data: getCallbackData('retry_trx', courseId, 'bKash') }],
                                        [{ text: '💳 Make New Payment', callback_data: getCallbackData('new_payment', courseId) }],
                                        [{ text: '💬 Contact Support', url: 'https://t.me/Mehedi_X71' }]
                                    ]
                                }
                            }
                        );
                    }
                    if (await isTransactionUsed(trxId)) {
                        return bot.sendMessage(msg.chat.id,
                            "❌ **এই Transaction ID আগেই ব্যবহার করা হয়েছে!**\n\nদয়া করে নতুন একটি Transaction ID দিন অথবা সাপোর্টে যোগাযোগ করুন।",
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '🔄 Try Another TRX ID', callback_data: `retry_trx_${courseId}_bKash` }],
                                        [{ text: '💳 Make New Payment', callback_data: `new_payment_${courseId}_bKash` }],
                                        [{ text: '💬 Contact Support', url: 'https://t.me/Mehedi_X71' }]
                                    ]
                                }
                            }
                        );
                    }

                    if (verificationResult.data.transactionStatus !== 'Completed' || parseInt(verificationResult.data.amount) < course.price) {
                        return bot.sendMessage(msg.chat.id,
                            `❌ **Payment Verification Failed!**\n\n` +
                            `🔍 Possible reasons:\n• Payment status not completed\n• Insufficient amount (Paid: ${verificationResult.data.amount} TK, Required: ${course.price} TK)\n\nTransaction ID: ${trxId}`,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '🔄 Try Again', callback_data: `retry_trx_${courseId}_bKash` }],
                                        [{ text: '💳 Make New Payment', callback_data: `new_payment_${courseId}_bKash` }],
                                        [{ text: '💬 Contact Support', url: 'https://t.me/Mehedi_X71' }]
                                    ]
                                }
                            }
                        );
                    }

                    const added = await addTransaction(trxId, userId, courseId, course.price, paymentMethod, verificationResult.paymentDate);
                    if (!added) {
                        return bot.sendMessage(msg.chat.id, "❌ **Transaction processing error!**\n\nPlease contact support immediately.", { parse_mode: 'Markdown' });
                    }

                    await logTransaction(trxId, userId, course.price, course.name, paymentMethod, verificationResult.paymentDate);
                    await addUserPurchase(userId, courseId, course.menu_id, course.submenu_id, trxId, paymentMethod, course.price, verificationResult.paymentDate);
                    await updateUserData(userId, { pending_course: null, pending_payment_method: null });

                    const validityEndTime = new Date(verificationResult.paymentTime.getTime() + 24 * 60 * 60 * 1000);
                    const validityEndStr = validityEndTime.toLocaleString('en-BD', { timeZone: 'Asia/Dhaka', hour12: true, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                    const successText = `✅ **পেমেন্ট সফলভাবে ভেরিফাই হয়েছে!**\n\n📱 ${course.name} Unlocked!\n💰 Amount: ${course.price} TK\n🎫 Transaction ID: ${trxId}\n⏰ Valid Until: ${validityEndStr}\n\n🎯 Join your course group:\n👉 Click the button below`;

                    await bot.sendMessage(msg.chat.id, successText, {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[ { text: `🎯 Join ${course.name} Group`, url: course.group_link } ]] }
                    });
                    
                    userStates.delete(userId);
                    return bot.sendMessage(msg.chat.id, "🎓 Main Menu", getMainMenuKeyboard());

                } catch (error) {
                    console.error('Payment verification error:', error);
                    return bot.sendMessage(msg.chat.id,
                        `⚠️ **Verification Error!**\n\nSomething went wrong. Please contact support.\n\nTransaction ID: ${trxId}`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '💬 Contact Support', url: 'https://t.me/Mehedi_X71' }],
                                    [{ text: '🔄 Try Again', callback_data: `retry_trx_${courseId}_bKash` }],
                                    [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                                ]
                            }
                        }
                    );
                }
            } else {
                return bot.sendMessage(msg.chat.id, '❌ Invalid payment proof format!');
            }
        }

        // 2. 🛡️ Auto-Healing State (Recover state if RAM clears on Render)
        let userState = userStates.get(userId);
        
        if (!userState && messageText && messageText !== '🏠 Main Menu' && messageText !== '⬅️ Back' && messageText !== '❌ Cancel') {
            const possibleCourseName = messageText.split(' - ')[0]; 
            const foundCourse = findCourseById(possibleCourseName); 
            
            if (foundCourse) {
                userState = { state: 'course', menuId: foundCourse.menu_id, submenuId: foundCourse.submenu_id, categoryId: foundCourse.category_id, courseId: foundCourse.course_id };
                userStates.set(userId, userState);
            } else {
                userState = {}; // Let it fall through to generic navigation
            }
        } else if (!userState) {
            userState = {};
        }

        // 3. Static Buttons
        if (messageText === '🏠 Main Menu') {
            userStates.delete(userId);
            return bot.sendMessage(msg.chat.id, '🎓 Premium Subscription Bot - Main Menu 🎓\n\nআপনার পছন্দের course category সিলেক্ট করুন:', getMainMenuKeyboard());
        }
        if (messageText === '🔥 Support 🔥') {
            return bot.sendMessage(msg.chat.id, '💬 Contact our support team:', { reply_markup: { inline_keyboard: [[ { text: '💬 Support', url: 'https://t.me/Mehedi_X71' } ]] } });
        }
        if (messageText === '🔥 Our Channel ❤️') {
            return bot.sendMessage(msg.chat.id, '📢 Join our channel for updates:', { reply_markup: { inline_keyboard: [[ { text: '📢 Our Channel', url: 'https://t.me/premium_subscriptionss' } ]] } });
        }
        if (messageText === '❌ Cancel') {
            await updateUserData(userId, { pending_course: null, pending_payment_method: null, waiting_for_proof: null });
            userStates.delete(userId);
            return bot.sendMessage(msg.chat.id, '🚫 Operation canceled. Returning to main menu.', getMainMenuKeyboard());
        }

        // 4. 🧠 The "Smart" BACK Button
        if (messageText === '⬅️ Back') {
            if (userState.state === 'submenu') {
                userStates.set(userId, { state: 'menu', menuId: userState.menuId });
                const menu = getMenus().find(m => m.menu_id === userState.menuId);
                return bot.sendMessage(msg.chat.id, `${menu.name}\n\n📚 Available Categories:`, getMenuKeyboard(userState.menuId));
                
            } else if (userState.state === 'category') {
                userStates.set(userId, { state: 'submenu', menuId: userState.menuId, submenuId: userState.submenuId });
                const submenu = getSubmenus(userState.menuId).find(s => s.submenu_id === userState.submenuId);
                return bot.sendMessage(msg.chat.id, `${submenu.name}\n\n📚 Available Options:`, await getSubmenuKeyboard(userState.menuId, userState.submenuId, userId));
                
            } else if (userState.state === 'course') {
                if (userState.categoryId) {
                    userStates.set(userId, { state: 'category', menuId: userState.menuId, submenuId: userState.submenuId, categoryId: userState.categoryId });
                    const categories = getCategories(userState.menuId, userState.submenuId);
                    const category = categories.find(c => c.category_id === userState.categoryId);
                    return bot.sendMessage(msg.chat.id, `${category.name}\n\n📚 Available Courses:`, await getCourseListKeyboard(userState.menuId, userState.submenuId, userState.categoryId));
                } else {
                    userStates.set(userId, { state: 'submenu', menuId: userState.menuId, submenuId: userState.submenuId });
                    const submenu = getSubmenus(userState.menuId).find(s => s.submenu_id === userState.submenuId);
                    return bot.sendMessage(msg.chat.id, `${submenu.name}\n\n📚 Available Courses:`, await getSubmenuKeyboard(userState.menuId, userState.submenuId, userId));
                }
                
            } else if (userState.state === 'payment_method' || userState.state === 'bkash_payment' || userState.state === 'nagad_payment') {
                const course = findCourseById(userState.courseId || userData.pending_course);
                if (course) {
                    userStates.set(userId, { state: 'course', menuId: course.menu_id, submenuId: course.submenu_id, categoryId: course.category_id, courseId: course.course_id });
                    const courseKeyboard = await getCourseKeyboard(course.course_id, userId);
                    let courseText = `${course.name}\n\n${course.description}\n\n💰 Price: ${course.price} TK`;
                    
                    if (course.image_link) {
                        try {
                            return await bot.sendPhoto(msg.chat.id, course.image_link, { caption: courseText, ...courseKeyboard });
                        } catch (e) {
                            return await bot.sendMessage(msg.chat.id, courseText, courseKeyboard);
                        }
                    }
                    return bot.sendMessage(msg.chat.id, courseText, courseKeyboard);
                }
            }
            // Default Fallback
            userStates.delete(userId);
            return bot.sendMessage(msg.chat.id, '🎓 Main Menu', getMainMenuKeyboard());
        }

        // 5. 🚀 Forward Navigation Logic

        // 5.1 Menu Selection
        const menus = getMenus();
        const selectedMenu = menus.find(menu => menu.name === messageText);
        if (selectedMenu) {
            userStates.set(userId, { state: 'menu', menuId: selectedMenu.menu_id });
            return bot.sendMessage(msg.chat.id, `${selectedMenu.name}\n\n📚 Select an option:`, getMenuKeyboard(selectedMenu.menu_id));
        }
        
        // 5.2 Submenu Selection
        if (userState.state === 'menu') {
            const submenus = getSubmenus(userState.menuId);
            const selectedSubmenu = submenus.find(submenu => submenu.name === messageText);
            
            if (selectedSubmenu) {
                const categories = getCategories(userState.menuId, selectedSubmenu.submenu_id);
                if (categories.length > 0) {
                    userStates.set(userId, { state: 'submenu', menuId: userState.menuId, submenuId: selectedSubmenu.submenu_id, hasCategories: true });
                    return bot.sendMessage(msg.chat.id, `${selectedSubmenu.name}\n\n📚 Select a Category:`, await getCategoryKeyboard(userState.menuId, selectedSubmenu.submenu_id));
                } else {
                    userStates.set(userId, { state: 'submenu', menuId: userState.menuId, submenuId: selectedSubmenu.submenu_id, hasCategories: false });
                    return bot.sendMessage(msg.chat.id, `${selectedSubmenu.name}\n\n📚 Available Courses:`, await getSubmenuKeyboard(userState.menuId, selectedSubmenu.submenu_id, userId));
                }
            }
        }

        // 5.3 Category Selection (HSC 28)
        if (userState.state === 'submenu' && userState.hasCategories) {
            const categories = getCategories(userState.menuId, userState.submenuId);
            const selectedCategory = categories.find(cat => cat.name === messageText);
            
            if (selectedCategory) {
                userStates.set(userId, { state: 'category', menuId: userState.menuId, submenuId: userState.submenuId, categoryId: selectedCategory.category_id });
                return bot.sendMessage(msg.chat.id, `${selectedCategory.name}\n\n📚 Available Courses:`, await getCourseListKeyboard(userState.menuId, userState.submenuId, selectedCategory.category_id));
            }
        }

        // 5.4 Course Selection
        if (userState.state === 'submenu' || userState.state === 'category') {
            const courses = getCourses(userState.menuId, userState.submenuId, userState.categoryId);
            const selectedCourse = courses.find(course => messageText === `${course.name} - ${course.price} TK`);
            
            if (selectedCourse) {
                userStates.set(userId, { 
                    state: 'course', menuId: userState.menuId, submenuId: userState.submenuId,
                    categoryId: selectedCourse.category_id, courseId: selectedCourse.course_id 
                });
                
                const courseKeyboard = await getCourseKeyboard(selectedCourse.course_id, userId);
                let courseText = `${selectedCourse.name}\n\n${selectedCourse.description}\n\n💰 Price: ${selectedCourse.price} TK`;
                
                if (selectedCourse.image_link) {
                    try {
                        return await bot.sendPhoto(msg.chat.id, selectedCourse.image_link, { caption: courseText, ...courseKeyboard });
                    } catch (error) {
                        return await bot.sendMessage(msg.chat.id, courseText, courseKeyboard);
                    }
                } else {
                    return await bot.sendMessage(msg.chat.id, courseText, courseKeyboard);
                }
            }
        }

        // 5.5 Course Actions (Buy Now / Join)
        if (userState.state === 'course') {
            const course = findCourseById(userState.courseId);
            if (course) {
                if (messageText === '💳 Buy Now') {
                    await updateUserData(userId, { pending_course: userState.courseId });
                    userStates.set(userId, { ...userState, state: 'payment_method' });
                    return bot.sendMessage(msg.chat.id, `💳 Select Payment Method for ${course.name}\n\n💰 Amount: ${course.price} TK`, getPaymentMethodKeyboard(course.course_id));
                } 
                else if (messageText === '🎯 Join Course Group') {
                    const hasCourse = Array.isArray(userData.purchases) ? userData.purchases.includes(userState.courseId) : userData.purchases?.has?.(userState.courseId);
                    if (hasCourse) { 
                        return bot.sendMessage(msg.chat.id, `🎯 Join your course group:`, { reply_markup: { inline_keyboard: [[ { text: `Join ${course.name} Group`, url: course.group_link } ]] }});
                    }
                }
            }
        }

        // 5.6 Payment Method Router
        if (userState.state === 'payment_method') {
            const course = findCourseById(userData.pending_course);
            
            if (messageText === 'bKash') {
                await updateUserData(userId, { pending_payment_method: 'bKash' });
                userStates.set(userId, { ...userState, state: 'bkash_payment' });
                
                const hasPaymentLink = course && course.payment_link;
                const bkashInstruction = `💳 bKash Payment Instructions:\n\n✅ এই নাম্বার ${BKASH_NUMBER} এ Make Payment করবেন!\n❌ Send Money করলে হবে না ।\n✅ Payment করার পর Transaction ID টা copy করেন ।\n✅ Submit Payment Proof এ ক্লিক করেন ।\n✅ শুধুমাত্র Transaction ID লিখুন।\n✅ Example: 9BG4R2G5N8\n\n⭐ Bkash Payment Auto Approve ⭐\n\nAmount: ${course.price} TK`;

                try {
                    return await bot.sendPhoto(msg.chat.id, './bkash.jpg', { caption: bkashInstruction, ...getBkashPaymentKeyboard(hasPaymentLink) });
                } catch (e) {
                    return await bot.sendMessage(msg.chat.id, bkashInstruction, getBkashPaymentKeyboard(hasPaymentLink));
                }
            } 
            else if (messageText === 'Nagad') {
                await updateUserData(userId, { pending_payment_method: 'Nagad' });
                userStates.set(userId, { ...userState, state: 'nagad_payment' });
                
                const nagadInstruction = `💳 Nagad Payment Instructions:\n\n✅ এই নাম্বার ${NAGAD_NUMBER} এ Send Money করেন ।\n✅ Payment করার পর screenshot নিন ।\n✅ এডমিন কে course নাম সহ screenshot পাঠান ।\n\n⭐ Nagad Payment Manually Approve ⭐\n\nAmount: ${course.price} TK`;
                return bot.sendMessage(msg.chat.id, nagadInstruction, getNagadPaymentKeyboard());
            }
        }

        // 5.7 Final Payment Option Selectors (Use Link vs Submit Proof)
        if (userState.state === 'bkash_payment') {
            const course = findCourseById(userData.pending_course);
            if (messageText === '💳 Use bKash Link') {
                if (course && course.payment_link) {
                    await bot.sendMessage(msg.chat.id, `💳 Pay with bKash:\n\n${course.payment_link}\n\nAfter payment, please send the Transaction ID (TRX ID) here.`, getCancelKeyboard());
                    return await updateUserData(userId, { waiting_for_proof: JSON.stringify({ courseId: userData.pending_course, paymentMethod: 'bKash' }) });
                } else {
                    return bot.sendMessage(msg.chat.id, '❌ Payment link not available for this course. Please use "📝 Submit Payment Proof" instead.', getBkashPaymentKeyboard(false));
                }
            } 
            else if (messageText === '📝 Submit Payment Proof') {
                await bot.sendMessage(msg.chat.id, '🔢 Please send the bKash Transaction ID (TRX ID):', getCancelKeyboard());
                return await updateUserData(userId, { waiting_for_proof: JSON.stringify({ courseId: userData.pending_course, paymentMethod: 'bKash' }) });
            }
        }
        
        if (userState.state === 'nagad_payment') {
            if (messageText === '📝 Submit Payment Proof') {
                await bot.sendMessage(msg.chat.id, '📸 Please send the Nagad payment screenshot:', getCancelKeyboard());
                return await updateUserData(userId, { waiting_for_proof: JSON.stringify({ courseId: userData.pending_course, paymentMethod: 'Nagad' }) });
            } 
            else if (messageText === '💬 Contact Admin') {
                return bot.sendMessage(msg.chat.id, `Contact admin for Nagad payment: @${ADMIN_USERNAME}`, { reply_markup: { inline_keyboard: [[ { text: '💬 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` } ]] } });
            }
        }

        // 6. 🗑️ Fallback / Garbage Handler
        if (messageText && !messageText.startsWith('/')) {
            bot.sendMessage(msg.chat.id, "⚠️ দয়া করে নিচের বাটনগুলো থেকে একটি অপশন সিলেক্ট করুন।");
        }

    } catch (error) {
        console.error('Error in message handler:', error.message);
        bot.sendMessage(msg.chat.id, "⚠️ সিস্টেমে একটি সাময়িক সমস্যা হয়েছে। দয়া করে /start লিখে আবার চেষ্টা করুন।");
    }
});
bot.on('callback_query', async (callbackQuery) => {
    try {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        
        // Admin Approval Logic
        if (data.startsWith('approve_')) {
            if (!(await isAdmin(userId))) return;
            
            const parts = data.split('_');
            const targetUserId = parts[1];
            const courseId = parts[2];
            const course = findCourseById(courseId);
            
            if (!course) {
                return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!' });
            }
            
            try {
                const trxId = `MANUAL-${Date.now()}`;
                const paymentDate = new Date().toISOString().split('T')[0];
                
                await addTransaction(trxId, targetUserId, courseId, course.price, 'Nagad', paymentDate);
                await addUserPurchase(
                    targetUserId, 
                    courseId, 
                    course.menu_id, 
                    course.submenu_id, 
                    trxId, 
                    'Nagad', 
                    course.price, 
                    paymentDate
                );
                
                await bot.sendMessage(targetUserId, 
                    `✅ **Your payment for ${course.name} has been approved!**\n\n` +
                    `🎯 Join your course group:\n👉 Click the button below`, 
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: `🎯 Join ${course.name} Group`, url: course.group_link }
                            ]]
                        }
                    }
                );
                
                await bot.editMessageText(`✅ Payment approved for user: ${targetUserId}`, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                });
                
                await bot.answerCallbackQuery(callbackQuery.id, { text: 'Payment approved!' });
            } catch (error) {
                console.error('Error approving payment:', error);
                await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error approving payment!' });
            }
            return;
        }
        else if (data.startsWith('reject_')) {
            if (!(await isAdmin(userId))) return;
            
            const parts = data.split('_');
            const targetUserId = parts[1];
            const courseId = parts[2];
            const course = findCourseById(courseId);
            
            if (!course) {
                return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!' });
            }
            
            await bot.editMessageText(`❌ Payment rejected for user: ${targetUserId}`, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id
            });
            
            await bot.sendMessage(targetUserId, 
                `❌ Your payment proof for ${course.name} was rejected.\n\n` +
                `Please contact support if you think this is a mistake.`, 
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '💬 Contact Support', url: `https://t.me/${ADMIN_USERNAME}` }
                        ]]
                    }
                }
            );
            
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Payment rejected!' });
            return;
        }

        // Handle "Try Another TRX ID"
        if (data.startsWith('retry_trx_')) {
            const parts = data.split('_');
            const courseId = parts[2];
            const paymentMethod = parts[3];
            const course = findCourseById(courseId);
            
            if (!course) {
                await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!' });
                return bot.sendMessage(chatId, "❌ Course not found! Returning to main menu.", getMainMenuKeyboard());
            }

            await updateUserData(userId, { 
                pending_course: courseId,
                pending_payment_method: paymentMethod,
                waiting_for_proof: JSON.stringify({ 
                    courseId, 
                    paymentMethod 
                }) 
            });

            await bot.answerCallbackQuery(callbackQuery.id);
            return bot.sendMessage(chatId, 
                `🔁 Please send new bKash Transaction ID for ${course.name}:`,
                getCancelKeyboard()
            );
        }
        // Handle "Make New Payment"
        if (data.startsWith('new_payment_')) {
            const courseId = data.split('_')[2];
            const course = findCourseById(courseId);
            
            if (!course) {
                await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!' });
                return bot.sendMessage(chatId, "❌ Course not found! Returning to main menu.", getMainMenuKeyboard());
            }

            await updateUserData(userId, { 
                pending_course: courseId,
                pending_payment_method: null,
                waiting_for_proof: null
            });
            
            userStates.set(userId, { 
                state: 'payment_method', 
                courseId: courseId 
            });

            await bot.answerCallbackQuery(callbackQuery.id);
            return bot.sendMessage(chatId, 
                `💳 Select payment method for ${course.name}:`,
                getPaymentMethodKeyboard()
            );
        }
        // Handle "Main Menu"
        else if (data === 'main_menu') {
            userStates.delete(userId);
            await bot.answerCallbackQuery(callbackQuery.id);
            return bot.sendMessage(chatId, "🎓 Main Menu", getMainMenuKeyboard());
        }
        await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
        console.error('Error in callback query:', error.message);
    }
});

// Express server
app.get('/', (req, res) => {
    res.send(`
        <h1>Premium Subscription Bot</h1>
        <p>Bot is running successfully with PostgreSQL Database!</p>
        <p>Database: premium-subscription-bot-db on Render</p>
        <p>Last Updated: ${new Date().toISOString()}</p>
        <hr>
        <h3>Features:</h3>
        <ul>
            <li>✅ Hardcoded courses (auto-updates on deployment)</li>
            <li>✅ Enhanced bKash verification with time checking</li>
            <li>✅ Payment date validation (yesterday, today, tomorrow only)</li>
            <li>✅ Duplicate transaction prevention</li>
            <li>✅ PostgreSQL integration</li>
            <li>✅ Admin panel for transaction management</li>
        </ul>
    `);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize System and Start Bot
async function startSystem() {
    try {
        // 1. First, fetch courses from GitHub
        const isSynced = await syncCourseData();
        if (!isSynced) {
            console.warn("⚠️ Warning: Bot started but course data is empty. Run /sync manually.");
        }
        
        // 2. Then, initialize Database
        await initializeDatabase();
        console.log('✅ PostgreSQL Database Initialized!');
        
        console.log('🚀 Premium Subscription Bot is fully LIVE and Operational!');
        console.log('Features enabled: Dynamic GitHub DB, Path-based Routing, Cache Invalidation.');
    } catch (error) {
        console.error('❌ Error during startup:', error);
    }
}

startSystem();
