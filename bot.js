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

// ==============================================================
// 🧠 UNIVERSAL RECURSIVE ENGINE (The "Infinite Tree" Logic)
// ==============================================================

// 1. Get any Node (Folder/Course) dynamically based on Path
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

// 2. Find Full Path by searching uniquely for a Node Key
function findNodePathByKey(targetKey) {
    let resultPath = null;
    function traverse(node, currentPath) {
        if (resultPath) return;
        const children = node.type === 'root' ? node.children : node.children;
        if (!children) return;
        for (const key in children) {
            const newPath = [...currentPath, key];
            if (key === targetKey) {
                resultPath = newPath;
                return;
            }
            if (children[key].children) {
                traverse(children[key], newPath);
            }
        }
    }
    traverse({ type: 'root', children: COURSES_DATA }, []);
    return resultPath;
}

// 3. Global Reverse Search (Auto-Healing Fallback for Render Restarts)
function globalSearchByName(text) {
    let resultPath = null;
    function traverse(node, currentPath) {
        if (resultPath) return;
        const children = node.type === 'root' ? node.children : node.children;
        if (!children) return;
        
        for (const key in children) {
            const child = children[key];
            const newPath = [...currentPath, key];
            
            // Check button name
            const buttonText = child.type === 'course' ? `${child.name} - ${child.price} TK` : child.name;
            if (buttonText === text || child.name === text.split(' - ')[0]) {
                resultPath = newPath;
                return;
            }
            
            if (child.type === 'folder' || child.children) {
                traverse(child, newPath);
            }
        }
    }
    traverse({ type: 'root', children: COURSES_DATA }, []);
    return resultPath;
}

// ==========================================
// 🎛️ DYNAMIC KEYBOARDS
// ==========================================

function getKeyboardForPath(pathArray) {
    const node = getNodeByPath(pathArray);
    const keyboard = [];
    
    if (node && node.children) {
        for (const key in node.children) {
            const child = node.children[key];
            if (child.type === 'course') {
                keyboard.push([`${child.name} - ${child.price} TK`]);
            } else {
                keyboard.push([child.name]);
            }
        }
    }

    if (!pathArray || pathArray.length === 0) {
        keyboard.push(['🔥 Support 🔥', '🔥 Our Channel ❤️']);
    } else {
        keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    }

    return { reply_markup: { keyboard: keyboard, resize_keyboard: true, one_time_keyboard: false } };
}

function getMainMenuKeyboard() {
    return getKeyboardForPath([]);
}

async function getCourseKeyboard(coursePath, userId) {
    const course = getNodeByPath(coursePath);
    if (!course || course.type !== 'course') return getKeyboardForPath([]);
    
    const keyboard = [];
    const userData = await getUserData(userId);
    const courseId = coursePath[coursePath.length - 1]; 
    
    keyboard.push(['💳 Buy Now']);
    
    if (userData.purchases.has(courseId)) {
        keyboard.push(['🎯 Join Course Group']);
    }
    
    keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    return { reply_markup: { keyboard: keyboard, resize_keyboard: true, one_time_keyboard: false } };
}

function getPaymentMethodKeyboard() {
    return { reply_markup: { keyboard: [['bKash'], ['Nagad'], ['⬅️ Back', '🏠 Main Menu']], resize_keyboard: true } };
}

function getBkashPaymentKeyboard(hasPaymentLink = false) {
    const keyboard = [];
    if (hasPaymentLink) keyboard.push(['💳 Use bKash Link']);
    keyboard.push(['📝 Submit Payment Proof']);
    keyboard.push(['⬅️ Back', '🏠 Main Menu']);
    return { reply_markup: { keyboard: keyboard, resize_keyboard: true } };
}

function getNagadPaymentKeyboard() {
    return { reply_markup: { keyboard: [['💬 Contact Admin'], ['⬅️ Back', '🏠 Main Menu']], resize_keyboard: true } };
}

function getCancelKeyboard() {
    return { reply_markup: { keyboard: [['❌ Cancel'], ['🏠 Main Menu']], resize_keyboard: true } };
}

// ==========================================
// 🚀 MAIN BOT LOGIC (MESSAGE HANDLER)
// ==========================================

bot.on('message', async (msg) => {
    try {
        if (msg.text && msg.text.startsWith('/')) return;
        
        const userId = msg.from.id;
        const messageText = msg.text?.trim();
        const userData = await getUserData(userId);
        
        // --- 1. HANDLE PAYMENT PROOFS ---
        if (userData.waiting_for_proof) {
            const proofData = JSON.parse(userData.waiting_for_proof);
            const { courseId, paymentMethod } = proofData;
            const coursePath = findNodePathByKey(courseId);
            const course = getNodeByPath(coursePath);
            
            if (!course) {
                await updateUserData(userId, { waiting_for_proof: null });
                return bot.sendMessage(msg.chat.id, '❌ Course not found!');
            }

            await updateUserData(userId, { waiting_for_proof: null });

            if (msg.photo && paymentMethod === 'Nagad') {
                const photo = msg.photo[msg.photo.length - 1];
                const adminMessage = `🆕 New Payment Proof (Nagad)\n\n👤 User: \`${userId}\`\n📚 Course: ${course.name}\n💰 Amount: ${course.price} TK\n💳 Method: ${paymentMethod}\n\n⚠️ Manual approval required`;

                try {
                    await bot.sendPhoto(ADMIN_ID, photo.file_id, {
                        caption: adminMessage, parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[ { text: '✅ Approve', callback_data: `approve_${userId}_${courseId}` }, { text: '❌ Reject', callback_data: `reject_${userId}_${courseId}` } ]] }
                    });
                    return bot.sendMessage(msg.chat.id, `✅ Payment proof received for ${course.name}!\n\nAdmin will verify your payment shortly.`, { reply_markup: { inline_keyboard: [[ { text: '💬 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` } ]] } });
                } catch (error) {
                    return bot.sendMessage(msg.chat.id, '⚠️ Error submitting payment proof. Please try again or contact support.');
                }
            }
            else if (msg.text && paymentMethod === 'bKash') {
                const trxId = msg.text.trim();
                await bot.sendMessage(msg.chat.id, '⏳ Verifying payment time validity...');

                try {
                    const verificationResult = await verifyPaymentWithDateCheck(trxId);
                    
                    if (!verificationResult.success) {
                        return bot.sendMessage(msg.chat.id, `❌ **${verificationResult.error}**`, {
                            parse_mode: 'Markdown', reply_markup: { inline_keyboard: [ [{ text: '🔄 Try Another TRX ID', callback_data: `retry_trx_${courseId}_bKash` }], [{ text: '💳 Make New Payment', callback_data: `new_payment_${courseId}_bKash` }], [{ text: '💬 Contact Support', url: 'https://t.me/Mehedi_X71' }] ] }
                        });
                    }
                    if (await isTransactionUsed(trxId)) {
                        return bot.sendMessage(msg.chat.id, "❌ **এই Transaction ID আগেই ব্যবহার করা হয়েছে!**\n\nদয়া করে নতুন একটি Transaction ID দিন অথবা সাপোর্টে যোগাযোগ করুন।", { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔄 Try Another TRX ID', callback_data: `retry_trx_${courseId}_bKash` }]] } });
                    }
                    if (verificationResult.data.transactionStatus !== 'Completed' || parseInt(verificationResult.data.amount) < course.price) {
                        return bot.sendMessage(msg.chat.id, `❌ **Payment Verification Failed!**\n\n🔍 Possible reasons:\n• Payment status not completed\n• Insufficient amount\n\nTransaction ID: ${trxId}`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔄 Try Again', callback_data: `retry_trx_${courseId}_bKash` }]] } });
                    }

                    const added = await addTransaction(trxId, userId, courseId, course.price, paymentMethod, verificationResult.paymentDate);
                    if (!added) return bot.sendMessage(msg.chat.id, "❌ **Transaction processing error!**", { parse_mode: 'Markdown' });

                    const menuId = coursePath[0] || 'N/A';
                    const submenuId = coursePath[1] || 'N/A';
                    
                    await logTransaction(trxId, userId, course.price, course.name, paymentMethod, verificationResult.paymentDate);
                    await addUserPurchase(userId, courseId, menuId, submenuId, trxId, paymentMethod, course.price, verificationResult.paymentDate);
                    await updateUserData(userId, { pending_course: null, pending_payment_method: null });

                    const successText = `✅ **পেমেন্ট সফলভাবে ভেরিফাই হয়েছে!**\n\n📱 ${course.name} Unlocked!\n💰 Amount: ${course.price} TK\n🎫 Transaction ID: ${trxId}\n\n🎯 Join your course group:\n👉 Click the button below`;
                    await bot.sendMessage(msg.chat.id, successText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[ { text: `🎯 Join Group`, url: course.groupLink } ]] } });
                    
                    userStates.delete(userId);
                    return bot.sendMessage(msg.chat.id, "🎓 Main Menu", getMainMenuKeyboard());
                } catch (error) {
                    return bot.sendMessage(msg.chat.id, `⚠️ **Verification Error!**\n\nSomething went wrong.`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔄 Try Again', callback_data: `retry_trx_${courseId}_bKash` }]] } });
                }
            } else {
                return bot.sendMessage(msg.chat.id, '❌ Invalid payment proof format!');
            }
        }

        // --- 2. AUTO-HEALING & STATE MANAGEMENT ---
        let userState = userStates.get(userId);
        
        if (!userState && messageText && !['🏠 Main Menu', '⬅️ Back', '❌ Cancel'].includes(messageText)) {
            const recoveredPath = globalSearchByName(messageText);
            if (recoveredPath) {
                const node = getNodeByPath(recoveredPath);
                userState = { path: recoveredPath, state: node.type === 'course' ? 'course_view' : null };
                userStates.set(userId, userState);
            } else {
                userState = { path: [] };
            }
        } else if (!userState) {
            userState = { path: [] };
        }

        // --- 3. STATIC BUTTONS ---
        if (messageText === '🏠 Main Menu') {
            userStates.delete(userId);
            return bot.sendMessage(msg.chat.id, '🎓 Premium Subscription Bot - Main Menu 🎓\n\nআপনার পছন্দের course category সিলেক্ট করুন:', getMainMenuKeyboard());
        }
        if (messageText === '🔥 Support 🔥') return bot.sendMessage(msg.chat.id, '💬 Contact our support team:', { reply_markup: { inline_keyboard: [[ { text: '💬 Support', url: 'https://t.me/Mehedi_X71' } ]] } });
        if (messageText === '🔥 Our Channel ❤️') return bot.sendMessage(msg.chat.id, '📢 Join our channel for updates:', { reply_markup: { inline_keyboard: [[ { text: '📢 Our Channel', url: 'https://t.me/premium_subscriptionss' } ]] } });
        if (messageText === '❌ Cancel') {
            await updateUserData(userId, { pending_course: null, pending_payment_method: null, waiting_for_proof: null });
            userStates.delete(userId);
            return bot.sendMessage(msg.chat.id, '🚫 Operation canceled. Returning to main menu.', getMainMenuKeyboard());
        }

        // --- 4. SMART BACK BUTTON ---
        if (messageText === '⬅️ Back') {
            if (['payment_method', 'bkash_payment', 'nagad_payment'].includes(userState.state)) {
                userState.state = 'course_view';
                userStates.set(userId, userState);
                const course = getNodeByPath(userState.path);
                const courseKb = await getCourseKeyboard(userState.path, userId);
                const cText = `${course.name}\n\n${course.description}\n\n💰 Price: ${course.price} TK`;
                if (course.imageLink) {
                    try { return await bot.sendPhoto(msg.chat.id, course.imageLink, { caption: cText, ...courseKb }); } catch (e) {}
                }
                return bot.sendMessage(msg.chat.id, cText, courseKb);
            }

            if (userState.path && userState.path.length > 0) {
                userState.path.pop(); // Go up one level
                userState.state = null; // Clear states
                userStates.set(userId, userState);
                
                const node = getNodeByPath(userState.path);
                const title = node.type === 'root' ? '🎓 Premium Subscription Bot - Main Menu 🎓\n\nআপনার পছন্দের course category সিলেক্ট করুন:' : `${node.name}\n\n📚 Available Options:`;
                return bot.sendMessage(msg.chat.id, title, getKeyboardForPath(userState.path));
            }
            return bot.sendMessage(msg.chat.id, '🎓 Main Menu', getMainMenuKeyboard());
        }

        // --- 5. ACTIVE COURSE ACTIONS ---
        if (userState.state === 'course_view') {
            const course = getNodeByPath(userState.path);
            const courseId = userState.path[userState.path.length - 1];
            
            if (messageText === '💳 Buy Now') {
                await updateUserData(userId, { pending_course: courseId });
                userState.state = 'payment_method';
                userStates.set(userId, userState);
                return bot.sendMessage(msg.chat.id, `💳 Select Payment Method for ${course.name}\n\n💰 Amount: ${course.price} TK`, getPaymentMethodKeyboard());
            } else if (messageText === '🎯 Join Course Group') {
                const hasCourse = Array.isArray(userData.purchases) ? userData.purchases.includes(courseId) : userData.purchases?.has?.(courseId);
                if (hasCourse) return bot.sendMessage(msg.chat.id, `🎯 Join your course group:`, { reply_markup: { inline_keyboard: [[ { text: `Join Group`, url: course.groupLink } ]] }});
            }
        }

        // --- 6. PAYMENT METHODS ROUTER ---
        if (userState.state === 'payment_method') {
            const coursePath = findNodePathByKey(userData.pending_course);
            const course = getNodeByPath(coursePath);
            
            if (messageText === 'bKash') {
                await updateUserData(userId, { pending_payment_method: 'bKash' });
                userStates.set(userId, { ...userState, state: 'bkash_payment' });
                const bkashInst = `💳 bKash Payment Instructions:\n\n✅ এই নাম্বার ${BKASH_NUMBER} এ Make Payment করবেন!\n❌ Send Money করলে হবে না ।\n✅ Payment করার পর Transaction ID টা copy করেন ।\n✅ Submit Payment Proof এ ক্লিক করেন ।\n✅ শুধুমাত্র Transaction ID লিখুন।\n\n⭐ Bkash Auto Approve ⭐\n💰 Amount: ${course.price} TK`;
                try { return await bot.sendPhoto(msg.chat.id, './bkash.jpg', { caption: bkashInst, ...getBkashPaymentKeyboard(!!course.paymentLink) }); } 
                catch (e) { return await bot.sendMessage(msg.chat.id, bkashInst, getBkashPaymentKeyboard(!!course.paymentLink)); }
            } else if (messageText === 'Nagad') {
                await updateUserData(userId, { pending_payment_method: 'Nagad' });
                userStates.set(userId, { ...userState, state: 'nagad_payment' });
                return bot.sendMessage(msg.chat.id, `💳 Nagad Payment:\n\n✅ নাম্বার ${NAGAD_NUMBER} এ Send Money করেন ।\n✅ Payment এর পর screenshot দিন ।\n💰 Amount: ${course.price} TK`, getNagadPaymentKeyboard());
            }
        }

        // --- 7. FINAL PAYMENT (Link / Submit) ---
        if (userState.state === 'bkash_payment') {
            const coursePath = findNodePathByKey(userData.pending_course);
            const course = getNodeByPath(coursePath);
            if (messageText === '💳 Use bKash Link') {
                if (course && course.paymentLink) {
                    await bot.sendMessage(msg.chat.id, `💳 Pay with bKash:\n\n${course.paymentLink}\n\nAfter payment, send the TRX ID here.`, getCancelKeyboard());
                    return await updateUserData(userId, { waiting_for_proof: JSON.stringify({ courseId: userData.pending_course, paymentMethod: 'bKash' }) });
                }
            } else if (messageText === '📝 Submit Payment Proof') {
                await bot.sendMessage(msg.chat.id, '🔢 Please send the bKash Transaction ID (TRX ID):', getCancelKeyboard());
                return await updateUserData(userId, { waiting_for_proof: JSON.stringify({ courseId: userData.pending_course, paymentMethod: 'bKash' }) });
            }
        }
        
        if (userState.state === 'nagad_payment' && messageText === '📝 Submit Payment Proof') {
            await bot.sendMessage(msg.chat.id, '📸 Please send the Nagad payment screenshot:', getCancelKeyboard());
            return await updateUserData(userId, { waiting_for_proof: JSON.stringify({ courseId: userData.pending_course, paymentMethod: 'Nagad' }) });
        } else if (userState.state === 'nagad_payment' && messageText === '💬 Contact Admin') {
            return bot.sendMessage(msg.chat.id, `Contact admin: @${ADMIN_USERNAME}`, { reply_markup: { inline_keyboard: [[ { text: '💬 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` } ]] } });
        }

        // --- 8. DYNAMIC NAVIGATION ENGINE ---
        if (!userState.state) {
            const currentNode = getNodeByPath(userState.path);
            if (currentNode && currentNode.children) {
                let clickedKey = null;
                let clickedNode = null;
                
                for (const key in currentNode.children) {
                    const child = currentNode.children[key];
                    const btnText = child.type === 'course' ? `${child.name} - ${child.price} TK` : child.name;
                    if (btnText === messageText) {
                        clickedKey = key;
                        clickedNode = child;
                        break;
                    }
                }

                if (clickedNode) {
                    userState.path.push(clickedKey);
                    
                    if (clickedNode.type === 'folder') {
                        userStates.set(userId, userState);
                        return bot.sendMessage(msg.chat.id, `${clickedNode.name}\n\n📚 Available Options:`, getKeyboardForPath(userState.path));
                    } else if (clickedNode.type === 'course') {
                        userState.state = 'course_view';
                        userStates.set(userId, userState);
                        const courseKb = await getCourseKeyboard(userState.path, userId);
                        const cText = `${clickedNode.name}\n\n${clickedNode.description}\n\n💰 Price: ${clickedNode.price} TK`;
                        
                        if (clickedNode.imageLink) {
                            try { return await bot.sendPhoto(msg.chat.id, clickedNode.imageLink, { caption: cText, ...courseKb }); } catch (error) {}
                        }
                        return await bot.sendMessage(msg.chat.id, cText, courseKb);
                    }
                }
            }
        }

        // Garbage warning
        if (messageText && !messageText.startsWith('/')) {
            // Unhandled text
        }
    } catch (error) {
        console.error('Error in message handler:', error.message);
        bot.sendMessage(msg.chat.id, "⚠️ সিস্টেমে একটি সাময়িক সমস্যা হয়েছে। দয়া করে /start লিখে আবার চেষ্টা করুন। Bot আপডেট করার কারনে দয়া করে Manual Bot ব্যাবহার করুন।");
    }
});

// ==========================================
// 📡 CALLBACK QUERIES (Admin Approvals & Retry)
// ==========================================

bot.on('callback_query', async (callbackQuery) => {
    try {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        
        if (data.startsWith('approve_') || data.startsWith('reject_')) {
            if (!(await isAdmin(userId))) return;
            
            const action = data.split('_')[0];
            const targetUserId = data.split('_')[1];
            const courseId = data.split('_')[2];
            
            const coursePath = findNodePathByKey(courseId);
            const course = getNodeByPath(coursePath);
            if (!course) return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!' });
            
            if (action === 'approve') {
                const trxId = `MANUAL-${Date.now()}`;
                const paymentDate = new Date().toISOString().split('T')[0];
                const menuId = coursePath[0] || 'N/A';
                const submenuId = coursePath[1] || 'N/A';
                
                await addTransaction(trxId, targetUserId, courseId, course.price, 'Nagad', paymentDate);
                await addUserPurchase(targetUserId, courseId, menuId, submenuId, trxId, 'Nagad', course.price, paymentDate);
                
                await bot.sendMessage(targetUserId, `✅ **Your payment for ${course.name} has been approved!**\n\n🎯 Join your course group:\n👉 Click the button below`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[ { text: `🎯 Join Group`, url: course.groupLink } ]] } });
                await bot.editMessageText(`✅ Payment approved for user: ${targetUserId}`, { chat_id: chatId, message_id: callbackQuery.message.message_id });
            } else {
                await bot.editMessageText(`❌ Payment rejected for user: ${targetUserId}`, { chat_id: chatId, message_id: callbackQuery.message.message_id });
                await bot.sendMessage(targetUserId, `❌ Your payment proof for ${course.name} was rejected.`, { reply_markup: { inline_keyboard: [[ { text: '💬 Contact Support', url: `https://t.me/${ADMIN_USERNAME}` } ]] } });
            }
            return bot.answerCallbackQuery(callbackQuery.id);
        }

        if (data.startsWith('retry_trx_') || data.startsWith('new_payment_')) {
            const isRetry = data.startsWith('retry_trx_');
            const courseId = data.split('_')[2];
            const paymentMethod = isRetry ? data.split('_')[3] : null;
            
            const coursePath = findNodePathByKey(courseId);
            const course = getNodeByPath(coursePath);
            if (!course) {
                bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!' });
                return bot.sendMessage(chatId, "❌ Course not found!", getMainMenuKeyboard());
            }

            if (isRetry) {
                await updateUserData(userId, { pending_course: courseId, pending_payment_method: paymentMethod, waiting_for_proof: JSON.stringify({ courseId, paymentMethod }) });
                bot.sendMessage(chatId, `🔁 Please send new bKash Transaction ID for ${course.name}:`, getCancelKeyboard());
            } else {
                await updateUserData(userId, { pending_course: courseId, pending_payment_method: null, waiting_for_proof: null });
                userStates.set(userId, { path: coursePath, state: 'payment_method' });
                bot.sendMessage(chatId, `💳 Select payment method for ${course.name}:`, getPaymentMethodKeyboard());
            }
            return bot.answerCallbackQuery(callbackQuery.id);
        }
        
        if (data === 'main_menu') {
            userStates.delete(userId);
            bot.sendMessage(chatId, "🎓 Main Menu", getMainMenuKeyboard());
        }
        bot.answerCallbackQuery(callbackQuery.id);
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
