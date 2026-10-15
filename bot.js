const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');

// ==========================================
// 🛡️ PART 1: ENV VALIDATION (Early Check)
// ==========================================
const requiredEnv = ['BOT_TOKEN', 'DATABASE_URL', 'ADMIN_ID', 'GITHUB_TOKEN'];
const missingEnv = requiredEnv.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
    console.error(`❌ CRITICAL ERROR: Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

// Global Error Handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
});
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error.message);
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

const bot = new TelegramBot(BOT_TOKEN, { 
    polling: { interval: 300, autoStart: true, params: { timeout: 10 } }
});

bot.on('polling_error', (error) => {
  console.error('Polling Error:', error.message); 
});

const app = express();
const userStates = new Map();

// Global variable for dynamic courses
let COURSES_DATA = {}; 
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'PremiumSubscriptions'; 
const REPO_NAME = 'CourseDataDB'; 

// ==============================================================
// ⚡ PART 2: PARALLEL FETCHING ENGINE (Rocket Speed & Anti-Cache)
// ==============================================================
async function syncCourseData() {
    console.log("🔄 Syncing course data from GitHub in parallel...");
    let newData = {};
    let hasError = false;

    try {
        const rootUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/`;
        const rootResponse = await axios.get(rootUrl, {
            params: { t: Date.now() },
            headers: { 
                'Authorization': `token ${GITHUB_TOKEN}`, 
                'Accept': 'application/vnd.github.v3+json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        const jsonFiles = rootResponse.data.filter(item => item.name.endsWith('.json'));
        if (jsonFiles.length === 0) return false;

        // 🚀 Parallel Downloading using Promise.all
        const filePromises = jsonFiles.map(async (file) => {
            const fileKey = file.name.replace('.json', '');
            const fileResponse = await axios.get(file.url, {
                params: { t: Date.now() },
                headers: { 
                    'Authorization': `token ${GITHUB_TOKEN}`, 
                    'Accept': 'application/vnd.github.v3+json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
            return { key: fileKey, data: JSON.parse(content), filename: file.name };
        });

        const results = await Promise.allSettled(filePromises);

        for (const result of results) {
            if (result.status === 'fulfilled') {
                newData[result.value.key] = result.value.data;
                console.log(`✅ Loaded: ${result.value.filename}`);
            } else {
                console.error(`❌ Failed to fetch file:`, result.reason.message);
                hasError = true;
            }
        }

    } catch (err) {
        console.error(`❌ Failed to connect to repo:`, err.message);
        hasError = true;
    }

    if (!hasError && Object.keys(newData).length > 0) {
        COURSES_DATA = newData;
        console.log("🎉 All courses successfully synced & updated in RAM!");
        return true;
    } else {
        console.log("⚠️ Sync failed! Keeping last known good state.");
        return false;
    }
}

// ==============================================================
// 🗄️ DATABASE INITIALIZATION & HELPERS
// ==============================================================
async function initializeDatabase() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, user_id VARCHAR(50) UNIQUE NOT NULL, username VARCHAR(100), first_name VARCHAR(100), last_name VARCHAR(100), pending_course VARCHAR(100), pending_payment_method VARCHAR(20), current_menu VARCHAR(100), waiting_for_proof TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, transaction_id VARCHAR(100) UNIQUE NOT NULL, user_id VARCHAR(50) NOT NULL, course_id VARCHAR(100) NOT NULL, amount INTEGER NOT NULL, payment_method VARCHAR(20) NOT NULL, payment_date DATE NOT NULL, status VARCHAR(20) DEFAULT 'completed', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`DO $$ BEGIN BEGIN ALTER TABLE transactions ADD COLUMN payment_date DATE NOT NULL DEFAULT CURRENT_DATE; EXCEPTION WHEN duplicate_column THEN NULL; END; END $$;`);
        await pool.query(`CREATE TABLE IF NOT EXISTS user_purchases (id SERIAL PRIMARY KEY, user_id VARCHAR(50) NOT NULL, course_id VARCHAR(100) NOT NULL, menu_id VARCHAR(100) NOT NULL, submenu_id VARCHAR(100) NOT NULL, purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, transaction_id VARCHAR(100), payment_method VARCHAR(20), amount INTEGER, payment_date DATE)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, admin_id VARCHAR(50) UNIQUE NOT NULL, username VARCHAR(100), is_primary BOOLEAN DEFAULT FALSE, added_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`INSERT INTO admins (admin_id, is_primary) VALUES ($1, TRUE) ON CONFLICT (admin_id) DO NOTHING`, [ADMIN_ID]);
    } catch (err) {
        console.error('Database init error:', err);
    }
}

async function getUserPurchases(userId) {
    try {
        const result = await pool.query('SELECT course_id FROM user_purchases WHERE user_id = $1', [userId]);
        return new Set(result.rows.map(row => row.course_id));
    } catch (e) { return new Set(); }
}

async function isTransactionUsed(transactionId) {
    try {
        const result = await pool.query('SELECT id FROM transactions WHERE transaction_id = $1', [transactionId]);
        return result.rows.length > 0;
    } catch (e) { return false; }
}

async function addTransaction(transactionId, userId, courseId, amount, paymentMethod, paymentDate) {
    try {
        const formattedDate = paymentDate instanceof Date ? paymentDate.toISOString().split('T')[0] : paymentDate;
        await pool.query('INSERT INTO transactions (transaction_id, user_id, course_id, amount, payment_method, payment_date) VALUES ($1, $2, $3, $4, $5, $6)', [transactionId, userId.toString(), courseId, parseInt(amount), paymentMethod, formattedDate]);
        return true;
    } catch (e) { return false; }
}

async function addUserPurchase(userId, courseId, menuId, submenuId, transactionId, paymentMethod, amount, paymentDate) {
    try {
        await pool.query(`INSERT INTO user_purchases (user_id, course_id, menu_id, submenu_id, transaction_id, payment_method, amount, payment_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [userId, courseId, menuId, submenuId, transactionId, paymentMethod, amount, paymentDate]);
    } catch (e) {}
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
    } catch (e) { return { user_id: userId, purchases: new Set(), waiting_for_proof: null }; }
}

async function updateUserData(userId, updates) {
    try {
        const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
        await pool.query(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId, ...Object.values(updates)]);
    } catch (e) {}
}

async function isAdmin(userId) {
    try {
        const result = await pool.query('SELECT id FROM admins WHERE admin_id = $1', [userId.toString()]);
        return result.rows.length > 0;
    } catch (e) { return adminUsers.has(userId.toString()); }
}
function isPrimaryAdmin(userId) { return userId.toString() === ADMIN_ID; }

// ==============================================================
// 💳 PAYMENT VERIFICATION HELPERS
// ==============================================================
let bkashToken = null;
let tokenExpiry = null;

async function getBkashToken() {
    if (bkashToken && tokenExpiry && Date.now() < tokenExpiry) return bkashToken;
    try {
        const res = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/token/grant`, { app_key: BKASH_APP_KEY, app_secret: BKASH_APP_SECRET }, { headers: { 'username': BKASH_USERNAME, 'password': BKASH_PASSWORD } });
        bkashToken = res.data.id_token;
        tokenExpiry = Date.now() + (res.data.expires_in * 1000) - 60000;
        return bkashToken;
    } catch (e) { throw e; }
}

async function verifyPaymentWithDateCheck(trxId) {
    try {
        const token = await getBkashToken();
        const res = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/general/searchTransaction`, { trxID: trxId }, { headers: { 'Authorization': token, 'X-APP-Key': BKASH_APP_KEY } });
        const data = res.data;
        if (!data || !data.completedTime) return { success: false, error: 'Payment not found or incomplete' };
        
        const [datePart, timePart] = data.completedTime.split('T');
        const paymentDateTime = new Date(`${datePart}T${timePart.split(':')[0]}:${timePart.split(':')[1]}:${timePart.split(':')[2]}+06:00`);
        if (new Date() > new Date(paymentDateTime.getTime() + 24 * 60 * 60 * 1000)) return { success: false, error: 'Transaction expired! Valid only for 24 hours.' };
        return { success: true, data, paymentDate: datePart, paymentTime: paymentDateTime };
    } catch (e) { return { success: false, error: 'Verification failed' }; }
}

// 🛡️ Added escapeMarkdown here as well for log safety
async function logTransaction(trxId, userId, amount, courseName, paymentMethod, paymentDate) {
    const msg = `💰 **New Payment**\n\n👤 User: \`${userId}\`\n📚 Course: ${escapeMarkdown(courseName)}\n💵 Amount: ${amount} TK\n💳 Method: ${paymentMethod}\n🆔 TRX ID: \`${trxId}\`\n📅 Date: ${paymentDate}`;
    try { await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' }); } catch (e) {}
}

// ==============================================================
// 🌳 UNIVERSAL RECURSIVE ENGINE (Infinite Tree Navigation)
// ==============================================================
function getNodeByPath(pathArray) {
    if (!pathArray || pathArray.length === 0) return { type: 'root', children: COURSES_DATA };
    let current = COURSES_DATA[pathArray[0]];
    for (let i = 1; i < pathArray.length; i++) {
        if (current && current.children && current.children[pathArray[i]]) {
            current = current.children[pathArray[i]];
        } else {
            return null;
        }
    }
    return current;
}

function findNodePathByKey(targetKey) {
    let resultPath = null;
    function traverse(node, currentPath) {
        if (resultPath) return;
        const children = node.children;
        if (!children) return;
        for (const key in children) {
            const newPath = [...currentPath, key];
            if (key === targetKey) { resultPath = newPath; return; }
            if (children[key].children) traverse(children[key], newPath);
        }
    }
    traverse({ type: 'root', children: COURSES_DATA }, []);
    return resultPath;
}

function globalSearchByName(text) {
    let resultPath = null;
    function traverse(node, currentPath) {
        if (resultPath) return;
        const children = node.children;
        if (!children) return;
        for (const key in children) {
            const child = children[key];
            const newPath = [...currentPath, key];
            const btnText = child.type === 'course' ? `${child.name} - ${child.price} TK` : child.name;
            if (btnText === text) { resultPath = newPath; return; }
            if (child.type === 'folder' || child.children) traverse(child, newPath);
        }
    }
    traverse({ type: 'root', children: COURSES_DATA }, []);
    return resultPath;
}

// ==============================================================
// 🎛️ DYNAMIC KEYBOARDS & PART 4: MARKDOWN ESCAPE HELPER
// ==============================================================
function escapeMarkdown(text = '') {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function getKeyboardForPath(pathArray) {
    const node = getNodeByPath(pathArray);
    const keyboard = [];
    if (node && node.children) {
        for (const key in node.children) {
            const child = node.children[key];
            keyboard.push([child.type === 'course' ? `${child.name} - ${child.price} TK` : child.name]);
        }
    }
    if (!pathArray || pathArray.length === 0) {
        keyboard.push(['🔥 Support 🔥', '🔥 Our Channel ❤️']);
    } else {
        keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    }
    return { reply_markup: { keyboard, resize_keyboard: true } };
}

function getMainMenuKeyboard() { return getKeyboardForPath([]); }

async function getCourseKeyboard(coursePath, userId) {
    const course = getNodeByPath(coursePath);
    if (!course || course.type !== 'course') return getKeyboardForPath([]);
    const keyboard = [['💳 Buy Now']];
    const userData = await getUserData(userId);
    const courseId = coursePath[coursePath.length - 1]; 
    if (userData.purchases.has(courseId)) keyboard.push(['🎯 Join Course Group']);
    keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    return { reply_markup: { keyboard, resize_keyboard: true } };
}

function getPaymentMethodKeyboard() { return { reply_markup: { keyboard: [['bKash'], ['Nagad'], ['⬅️ Back', '🏠 Main Menu']], resize_keyboard: true } }; }
function getBkashPaymentKeyboard(hasLink = false) { const kb = []; if (hasLink) kb.push(['💳 Use bKash Link']); kb.push(['📝 Submit Payment Proof'], ['⬅️ Back', '🏠 Main Menu']); return { reply_markup: { keyboard: kb, resize_keyboard: true } }; }
function getNagadPaymentKeyboard() { return { reply_markup: { keyboard: [['💬 Contact Admin'], ['⬅️ Back', '🏠 Main Menu']], resize_keyboard: true } }; }
function getCancelKeyboard() { return { reply_markup: { keyboard: [['❌ Cancel'], ['🏠 Main Menu']], resize_keyboard: true } }; }

// ==============================================================
// 🚀 BOT COMMANDS & MESSAGE HANDLERS
// ==============================================================
bot.onText(/\/start/, async (msg) => {
    userStates.delete(msg.from.id);
    const welcome = `🎓 Welcome to Premium Subscription Bot! 🎓\nআমাদের premium courses গুলো দেখুন এবং আপনার পছন্দের course কিনুন।\n\n💎 High Quality Content\n📚 Expert Teachers\n🎯 Guaranteed Results\n💯 24/7 Support\n🎓Bot Refresh করতে /start command ব্যাবহার করুন!\nCourse কিনতে সমস্যা হলে <a href="https://t.me/premium_subscriptionss/1194">ভিডিওটি দেখবেন</a>`;
    bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'HTML', ...getMainMenuKeyboard() });
});

bot.onText(/\/admin/, async (msg) => {
    if (!(await isAdmin(msg.from.id))) return bot.sendMessage(msg.chat.id, '❌ You are not authorized!');
    const isPrimary = isPrimaryAdmin(msg.from.id);
    const text = `🔧 Admin Panel\n/checktrx - Check transaction status\n/addtrx - Add transaction\n/removetrx - Remove transaction` + (isPrimary ? `\n\n👨‍💼 **Admin Mgt:**\n/addadmin - Add new admin\n/removeadmin - Remove admin\n/listadmins - List all admins\n/sync - Force Sync from GitHub` : ``);
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// ==============================================================
// 🚀 PART 3: RATE-LIMITED BROADCASTING IN /SYNC COMMAND
// ==============================================================
bot.onText(/\/sync/, async (msg) => {
    if (!(await isAdmin(msg.from.id))) return bot.sendMessage(msg.chat.id, '❌ You are not authorized!');
    
    await bot.sendMessage(msg.chat.id, '🔄 Syncing courses from GitHub Cloud in parallel... Please wait.');
    const success = await syncCourseData();
    
    if (success) {
        await bot.sendMessage(msg.chat.id, '✅ **Sync Complete!**\n\nAll courses have been updated from GitHub.', { parse_mode: 'Markdown' });

        let refreshCount = 0;
        const entries = Array.from(userStates.entries());
        
        // 🚀 Helper function with delay to respect Telegram Rate Limits (< 30 msgs/sec)
        const sendWithDelay = (userId, text, replyMarkup, index) => {
            return new Promise((resolve) => {
                setTimeout(async () => {
                    try {
                        await bot.sendMessage(userId, text, { parse_mode: 'Markdown', ...replyMarkup });
                        resolve(true);
                    } catch (e) {
                        resolve(false);
                    }
                }, index * 50); // 50ms delay per user prevents Spam/Rate-limit block
            });
        };

        for (let i = 0; i < entries.length; i++) {
            const [activeUserId, state] = entries[i];
            if (state.path && !['payment_method', 'bkash_payment', 'nagad_payment'].includes(state.state)) {
                const newKeyboard = getKeyboardForPath(state.path);
                const node = getNodeByPath(state.path);
                const titleName = node.type === 'root' ? 'Main Menu' : escapeMarkdown(node.name);
                
                const notificationText = `🔄 **সিস্টেম আপডেট!**\nনতুন কোর্স/ফোল্ডার যুক্ত হয়েছে। আপনার *${titleName}* অটো-রিফ্রেশ করা হলো:`;
                
                const sent = await sendWithDelay(activeUserId, notificationText, newKeyboard, refreshCount);
                if (sent) refreshCount++;
            }
        }

        if (refreshCount > 0) {
            bot.sendMessage(msg.chat.id, `🚀 **Live Push Successful:** ${refreshCount} জন অ্যাক্টিভ ইউজারের স্ক্রিন অটোমেটিক রিফ্রেশ করা হয়েছে!`);
        } else {
            bot.sendMessage(msg.chat.id, "🎓 Main Menu (Refreshed):", getMainMenuKeyboard());
        }

    } else {
        await bot.sendMessage(msg.chat.id, '❌ **Sync Failed!** Check console logs.', { parse_mode: 'Markdown' });
    }
});

// Admin TRx & Admin Management commands
bot.onText(/\/checktrx (.+)/, async (msg, match) => { if (await isAdmin(msg.from.id)) bot.sendMessage(msg.chat.id, `ℹ️ **TRX Status:** ${(await isTransactionUsed(match[1])) ? "🟢 Used" : "🔴 Not Used"}\nID: \`${match[1]}\``, { parse_mode: 'Markdown' }); });
bot.onText(/\/addtrx (.+)/, async (msg, match) => { if (await isAdmin(msg.from.id)) { try { await pool.query('INSERT INTO transactions (transaction_id, user_id, course_id, amount, payment_method, payment_date) VALUES ($1, $2, $3, $4, $5, $6)', [match[1], 'admin_added', 'manual', 0, 'manual', new Date().toISOString().split('T')[0]]); bot.sendMessage(msg.chat.id, `✅ TRX Added`); } catch(e) { bot.sendMessage(msg.chat.id, '❌ Error'); } } });
bot.onText(/\/removetrx (.+)/, async (msg, match) => { if (await isAdmin(msg.from.id)) { try { await pool.query('DELETE FROM transactions WHERE transaction_id = $1', [match[1]]); bot.sendMessage(msg.chat.id, `♻️ TRX Removed`); } catch(e) { bot.sendMessage(msg.chat.id, '❌ Error'); } } });

bot.onText(/\/addadmin (.+)/, async (msg, match) => {
    if (!isPrimaryAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ Only primary admin can add new admins!');
    try {
        await pool.query('INSERT INTO admins (admin_id, added_by) VALUES ($1, $2)', [match[1], msg.from.id]);
        bot.sendMessage(msg.chat.id, `✅ Admin ${match[1]} added successfully!`);
    } catch (e) { bot.sendMessage(msg.chat.id, '❌ Error or Admin already exists!'); }
});

bot.onText(/\/removeadmin (.+)/, async (msg, match) => {
    if (!isPrimaryAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ Only primary admin can remove admins!');
    if (match[1] === ADMIN_ID) return bot.sendMessage(msg.chat.id, '❌ Cannot remove primary admin!');
    try {
        const res = await pool.query('DELETE FROM admins WHERE admin_id = $1 AND is_primary = FALSE', [match[1]]);
        bot.sendMessage(msg.chat.id, res.rowCount > 0 ? `✅ Admin removed!` : `❌ Admin not found!`);
    } catch (e) { bot.sendMessage(msg.chat.id, '❌ Error!'); }
});

bot.onText(/\/listadmins/, async (msg) => {
    if (!isPrimaryAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ Only primary admin can view admin list!');
    try {
        const res = await pool.query('SELECT admin_id, is_primary FROM admins ORDER BY is_primary DESC');
        let txt = '👥 **Admin List:**\n\n';
        res.rows.forEach((a, i) => txt += `${i + 1}. \`${a.admin_id}\` ${a.is_primary ? '(Primary)' : ''}\n`);
        bot.sendMessage(msg.chat.id, txt, { parse_mode: 'Markdown' });
    } catch (e) { bot.sendMessage(msg.chat.id, '❌ Error!'); }
});

bot.on('message', async (msg) => {
    try {
        if (msg.text && msg.text.startsWith('/')) return;
        const userId = msg.from.id;
        const messageText = msg.text?.trim();
        const userData = await getUserData(userId);

        // --- 1. HANDLE PAYMENT PROOFS ---
        if (userData.waiting_for_proof) {
            const proofData = JSON.parse(userData.waiting_for_proof);
            const coursePath = findNodePathByKey(proofData.courseId);
            const course = getNodeByPath(coursePath);
            await updateUserData(userId, { waiting_for_proof: null });

            if (!course) return bot.sendMessage(msg.chat.id, '❌ Course not found!');

            if (msg.photo && proofData.paymentMethod === 'Nagad') {
                const adminMsg = `🆕 New Proof (Nagad)\n👤 User: \`${userId}\`\n📚 ${escapeMarkdown(course.name)}\n💰 ${course.price} TK`;
                try {
                    await bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, { caption: adminMsg, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[ { text: '✅ Approve', callback_data: `approve_${userId}_${proofData.courseId}` }, { text: '❌ Reject', callback_data: `reject_${userId}_${proofData.courseId}` } ]] }});
                    return bot.sendMessage(msg.chat.id, `✅ Payment proof received! Admin will verify.`, { reply_markup: { inline_keyboard: [[ { text: '💬 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` } ]] } });
                } catch(e) { return bot.sendMessage(msg.chat.id, '⚠️ Error sending proof.'); }
            } else if (msg.text && proofData.paymentMethod === 'bKash') {
                const trxId = msg.text.trim();
                await bot.sendMessage(msg.chat.id, '⏳ Verifying payment...');
                try {
                    const vRes = await verifyPaymentWithDateCheck(trxId);
                    if (!vRes.success) return bot.sendMessage(msg.chat.id, `❌ **${vRes.error}**`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔄 Try Another TRX', callback_data: `retry_trx_${proofData.courseId}_bKash` }], [{ text: '💬 Support', url: 'https://t.me/Mehedi_X71' }]] }});
                    if (await isTransactionUsed(trxId)) return bot.sendMessage(msg.chat.id, "❌ **Transaction ID already used!**", { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔄 Try Another TRX', callback_data: `retry_trx_${proofData.courseId}_bKash` }]] }});
                    if (vRes.data.transactionStatus !== 'Completed' || parseInt(vRes.data.amount) < course.price) return bot.sendMessage(msg.chat.id, `❌ **Verification Failed!** Amount/Status issue.`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔄 Try Again', callback_data: `retry_trx_${proofData.courseId}_bKash` }]] }});

                    await addTransaction(trxId, userId, proofData.courseId, course.price, 'bKash', vRes.paymentDate);
                    await logTransaction(trxId, userId, course.price, course.name, 'bKash', vRes.paymentDate);
                    await addUserPurchase(userId, proofData.courseId, coursePath[0]||'N/A', coursePath[1]||'N/A', trxId, 'bKash', course.price, vRes.paymentDate);
                    await updateUserData(userId, { pending_course: null, pending_payment_method: null });

                    userStates.delete(userId);
                    await bot.sendMessage(msg.chat.id, `✅ **পেমেন্ট সফল!**\n\n📱 ${escapeMarkdown(course.name)} Unlocked!\n🎫 TRX ID: ${trxId}\n\n🎯 Click below to join:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[ { text: `🎯 Join Group`, url: course.groupLink } ]] } });
                    return bot.sendMessage(msg.chat.id, "🎓 Main Menu", getMainMenuKeyboard());
                } catch (e) { return bot.sendMessage(msg.chat.id, `⚠️ **Verification Error!**`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔄 Try Again', callback_data: `retry_trx_${proofData.courseId}_bKash` }]] }}); }
            } else return bot.sendMessage(msg.chat.id, '❌ Invalid format!');
        }

        // --- 2. STATE MANAGEMENT & STATIC BUTTONS ---
        let userState = userStates.get(userId);
        if (!userState || !Array.isArray(userState.path)) {
            userState = { path: [] };
            userStates.set(userId, userState);
        }

        if (messageText === '🏠 Main Menu') { userStates.delete(userId); return bot.sendMessage(msg.chat.id, '🎓 Main Menu:', getMainMenuKeyboard()); }
        if (messageText === '🔥 Support 🔥') return bot.sendMessage(msg.chat.id, '💬 Support team:', { reply_markup: { inline_keyboard: [[{text: '💬 Support', url: 'https://t.me/Mehedi_X71'}]] }});
        if (messageText === '🔥 Our Channel ❤️') return bot.sendMessage(msg.chat.id, '📢 Join channel:', { reply_markup: { inline_keyboard: [[{text: '📢 Channel', url: 'https://t.me/premium_subscriptionss'}]] }});
        if (messageText === '❌ Cancel') { await updateUserData(userId, { pending_course: null, pending_payment_method: null }); userStates.delete(userId); return bot.sendMessage(msg.chat.id, '🚫 Canceled.', getMainMenuKeyboard()); }

        // --- 3. SMART BACK BUTTON ---
        if (messageText === '⬅️ Back') {
            if (['payment_method', 'bkash_payment', 'nagad_payment'].includes(userState.state)) {
                userState.state = 'course_view'; userStates.set(userId, userState);
                const course = getNodeByPath(userState.path);
                const courseKb = await getCourseKeyboard(userState.path, userId);
                const text = `${course.name}\n\n${course.description}\n\n💰 Price: ${course.price} TK`;
                if (course.imageLink) { try { return await bot.sendPhoto(msg.chat.id, course.imageLink, { caption: text, ...courseKb }); } catch(e){} }
                return bot.sendMessage(msg.chat.id, text, courseKb);
            }
            if (userState.path.length > 0) {
                userState.path.pop(); userState.state = null; userStates.set(userId, userState);
                if (userState.path.length === 0) return bot.sendMessage(msg.chat.id, '🎓 Main Menu:', getMainMenuKeyboard());
                return bot.sendMessage(msg.chat.id, `${getNodeByPath(userState.path).name}\n\n📚 Available Options:`, getKeyboardForPath(userState.path));
            }
            return bot.sendMessage(msg.chat.id, '🎓 Main Menu', getMainMenuKeyboard());
        }

                        // --- 4. COURSE ACTIONS & PAYMENT ROUTER ---
        if (userState.state === 'course_view') {
            const course = getNodeByPath(userState.path);
            if (messageText === '💳 Buy Now') {
                await updateUserData(userId, { pending_course: userState.path[userState.path.length-1] });
                userState.state = 'payment_method'; userStates.set(userId, userState);
                return bot.sendMessage(msg.chat.id, `💳 Select Payment Method\n💰 Amount: ${course.price} TK`, getPaymentMethodKeyboard());
            } else if (messageText === '🎯 Join Course Group') {
                if (userData.purchases.has(userState.path[userState.path.length-1])) return bot.sendMessage(msg.chat.id, `🎯 Join group:`, { reply_markup: { inline_keyboard: [[{text: `Join Group`, url: course.groupLink}]] }});
            }
        }
        
        if (userState.state === 'payment_method') {
            // ✅ Fix: মেমোরি থেকে ডিরেক্ট কোর্স ফেচ করা হলো
            const course = getNodeByPath(userState.path);
            
            // নতুন আপডেটেড পেমেন্ট মেসেজ (Mono ফরম্যাট সহ)
            const manualPaymentInst = `Payment  Systems ✅ Runing \n\n✅ \`01632276126\` (Bkash Make payment)\n(বিঃদ্রঃ এই নাম্বারে send money করলে হবেনা, make payment করবেন)\n\n🚫 \`01634001336\` (Bkash Send Money) আপাতত বন্ধ আছে ১ তারিখ চালু হবে লিমিট শেষ। 🚫\n\n\`01902912653\` (Nagad Send Money)✅\n\`01634001336\` (Nagad Send Money)✅\n\nPayment করে আমাকে পেমেন্ট Screnshort পাঠাও আর কোর্স নাম লিখে পাঠাও।\n\n🎯 @Mehedi_X71\n🎯 @Mehedi_X71\n\n💰 Amount: ${course.price} TK`;

            if (messageText === 'bKash') {
                await updateUserData(userId, { pending_payment_method: 'bKash' });
                userState.state = 'bkash_payment'; userStates.set(userId, userState);
                
                /* --- OLD BKASH AUTO APPROVE INSTRUCTIONS (COMMENTED OUT) ---
                const bkashInst = \`💳 bKash Payment Instructions:\n\n✅ এই নাম্বার ${BKASH_NUMBER} এ Make Payment করবেন!\n❌ Send Money করলে হবে না ।\n✅ Payment করার পর Transaction ID টা copy করেন ।\n✅ Submit Payment Proof এ ক্লিক করেন ।\n✅ শুধুমাত্র Transaction ID লিখুন।\n✅ Example: 9BG4R2G5N8\n\n⭐ Bkash Payment Auto Approve ⭐\n\nAmount: ${course.price} TK\`;
                
                try { 
                    await bot.sendPhoto(msg.chat.id, './bkash.jpg', { caption: bkashInst, ...getBkashPaymentKeyboard(!!course.paymentLink) }); 
                } catch(e) { 
                    await bot.sendMessage(msg.chat.id, bkashInst, getBkashPaymentKeyboard(!!course.paymentLink)); 
                }
                ------------------------------------------------------------ */

                // NEW MANUAL SEND MONEY FLOW FOR BKASH (WITH MARKDOWN)
                try { 
                    await bot.sendPhoto(msg.chat.id, './bkash-send-money.jpg', { caption: manualPaymentInst, parse_mode: 'Markdown', ...getBkashPaymentKeyboard(!!course.paymentLink) }); 
                } catch(e) { 
                    await bot.sendMessage(msg.chat.id, manualPaymentInst, { parse_mode: 'Markdown', ...getBkashPaymentKeyboard(!!course.paymentLink) }); 
                }

            } else if (messageText === 'Nagad') {
                await updateUserData(userId, { pending_payment_method: 'Nagad' });
                userState.state = 'nagad_payment'; userStates.set(userId, userState);
                
                /* --- OLD NAGAD INSTRUCTIONS (COMMENTED OUT) ---
                const nagadInst = \`💳 Nagad Payment Instructions:\n\n✅ এই নাম্বার ${NAGAD_NUMBER} এ Send Money করেন ।\n✅ Payment করার পর screenshot নিন ।\n✅ এডমিন কে course নাম সহ screenshot পাঠান ।\n\n⭐ Nagad Payment Manually Approve ⭐\n\nAmount: ${course.price} TK\`;
                await bot.sendMessage(msg.chat.id, nagadInst, getNagadPaymentKeyboard());
                ------------------------------------------------- */
                
                // NEW MANUAL SEND MONEY FLOW FOR NAGAD (WITH MARKDOWN)
                try { 
                    await bot.sendPhoto(msg.chat.id, './bkash.jpg', { caption: manualPaymentInst, parse_mode: 'Markdown', ...getNagadPaymentKeyboard() }); 
                } catch(e) { 
                    await bot.sendMessage(msg.chat.id, manualPaymentInst, { parse_mode: 'Markdown', ...getNagadPaymentKeyboard() }); 
                }
            }
        }




        // --- 5. DYNAMIC NAVIGATION (Forward & Auto-Healing) ---
        if (!userState.state && messageText && !messageText.startsWith('/')) {
            const currentNode = getNodeByPath(userState.path);
            let found = false;

            if (currentNode && currentNode.children) {
                for (const key in currentNode.children) {
                    const child = currentNode.children[key];
                    const btnText = child.type === 'course' ? `${child.name} - ${child.price} TK` : child.name;
                    if (btnText === messageText) {
                        userState.path.push(key);
                        found = true;
                        if (child.type === 'folder') {
                            userStates.set(userId, userState);
                            return bot.sendMessage(msg.chat.id, `${child.name}\n\n📚 Available Options:`, getKeyboardForPath(userState.path));
                        } else if (child.type === 'course') {
                            userState.state = 'course_view'; userStates.set(userId, userState);
                            const courseKb = await getCourseKeyboard(userState.path, userId);
                            const txt = `${child.name}\n\n${child.description}\n\n💰 Price: ${child.price} TK`;
                            if (child.imageLink) { try { return await bot.sendPhoto(msg.chat.id, child.imageLink, { caption: txt, ...courseKb }); } catch(e){} }
                            return bot.sendMessage(msg.chat.id, txt, courseKb);
                        }
                    }
                }
            }

            if (!found) { // AUTO-HEALING
                const recPath = globalSearchByName(messageText);
                if (recPath) {
                    userState.path = recPath;
                    const node = getNodeByPath(recPath);
                    if (node.type === 'folder') {
                        userState.state = null; userStates.set(userId, userState);
                        return bot.sendMessage(msg.chat.id, `${node.name}\n\n📚 Options:`, getKeyboardForPath(userState.path));
                    } else if (node.type === 'course') {
                        userState.state = 'course_view'; userStates.set(userId, userState);
                        const cKb = await getCourseKeyboard(userState.path, userId);
                        const txt = `${node.name}\n\n${node.description}\n\n💰 Price: ${node.price} TK`;
                        if (node.imageLink) { try { return await bot.sendPhoto(msg.chat.id, node.imageLink, { caption: txt, ...cKb }); } catch(e){} }
                        return bot.sendMessage(msg.chat.id, txt, cKb);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error in msg handler:', error.message);
        bot.sendMessage(msg.chat.id, "⚠️ সিস্টেমে একটি সাময়িক সমস্যা হয়েছে। দয়া করে /start লিখে আবার চেষ্টা করুন।");
    }
});

bot.on('callback_query', async (query) => {
    try {
        const data = query.data; const chatId = query.message.chat.id; const userId = query.from.id;
        
        if (data.startsWith('approve_') || data.startsWith('reject_')) {
            if (!(await isAdmin(userId))) return;
            const [, targetUserId, courseId] = data.split('_');
            const coursePath = findNodePathByKey(courseId);
            const course = getNodeByPath(coursePath);
            if (!course) return bot.answerCallbackQuery(query.id, { text: '❌ Course not found!' });
            
            if (data.startsWith('approve')) {
                const trx = `MANUAL-${Date.now()}`; const dt = new Date().toISOString().split('T')[0];
                await addTransaction(trx, targetUserId, courseId, course.price, 'Nagad', dt);
                await addUserPurchase(targetUserId, courseId, coursePath[0]||'NA', coursePath[1]||'NA', trx, 'Nagad', course.price, dt);
                await bot.sendMessage(targetUserId, `✅ **Payment approved!**\n\n🎯 Join group:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{text: 'Join Group', url: course.groupLink}]]}});
                await bot.editMessageText(`✅ Approved for: ${targetUserId}`, { chat_id: chatId, message_id: query.message.message_id });
            } else {
                await bot.editMessageText(`❌ Rejected for: ${targetUserId}`, { chat_id: chatId, message_id: query.message.message_id });
                await bot.sendMessage(targetUserId, `❌ Payment proof rejected.`, { reply_markup: { inline_keyboard: [[{text: 'Support', url: `https://t.me/${ADMIN_USERNAME}`}]]}});
            }
            return bot.answerCallbackQuery(query.id);
        }

        if (data.startsWith('retry_trx_') || data.startsWith('new_payment_')) {
            const courseId = data.split('_')[2];
            const coursePath = findNodePathByKey(courseId);
            const course = getNodeByPath(coursePath);
            if (!course) return bot.sendMessage(chatId, "❌ Not found", getMainMenuKeyboard());

            if (data.startsWith('retry')) {
                await updateUserData(userId, { pending_course: courseId, waiting_for_proof: JSON.stringify({ courseId, paymentMethod: data.split('_')[3] }) });
                bot.sendMessage(chatId, `🔁 Send TRX ID:`, getCancelKeyboard());
            } else {
                await updateUserData(userId, { pending_course: courseId, waiting_for_proof: null });
                userStates.set(userId, { path: coursePath, state: 'payment_method' });
                bot.sendMessage(chatId, `💳 Select method:`, getPaymentMethodKeyboard());
            }
            return bot.answerCallbackQuery(query.id);
        }
        if (data === 'main_menu') { userStates.delete(userId); bot.sendMessage(chatId, "🎓 Main Menu", getMainMenuKeyboard()); }
        bot.answerCallbackQuery(query.id);
    } catch (e) {}
});

app.get('/', (req, res) => res.send('<h1>Bot Running (Tree Engine & Hyper Sync)</h1>'));
app.listen(PORT, () => console.log(`Server on ${PORT}`));

async function startSystem() {
    try {
        await syncCourseData();
        await initializeDatabase();
        console.log('✅ Bot is LIVE with Parallel Sync & Rate-Limited Broadcasting!');
    } catch (e) { console.error('❌ Startup error:', e); }
}
startSystem();
