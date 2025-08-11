const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Config
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
const BKASH_BASE_URL = 'https://tokenized.pay.bka.sh/v1.2.0-beta';
const PORT = process.env.PORT || 10000;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
const adminUsers = new Set([ADMIN_ID]);
const users = new Map();
const pendingPayments = new Map();
const usedTransactions = new Set();
const courseChannelMap = {};

// File paths
const COURSES_FILE = path.join(__dirname, 'courses.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const TRANSACTIONS_FILE = path.join(__dirname, 'transactions.json');
const COURSE_CHANNEL_MAP_FILE = path.join(__dirname, 'courseChannelMap.json');

// Default courses
const defaultCourses = {
    "hsc27": {
        "name": "🔥HSC 2027 All Courses🔥",
        "type": "menu",
        "submenus": {
            "acs_hm": {
                "name": "🎯 ACS HM All Course",
                "type": "submenu",
                "courses": {
                    "acs_hm_cycle1": {
                        "name": "🧮 ACS HM Cycle 1",
                        "type": "course",
                        "price": 100,
                        "groupLink": "https://t.me/+HSC2027ACSMATH1",
                        "paymentLink": "https://shop.bkash.com/mamun-gazipur-printer019029126/pay/bdt100/ceGy7t",
                        "imageLink": "",
                        "description": "📖 Complete ACS Higher Math Cycle 1 Course\n\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support\n✅ Lifetime Access\n\n🎯 Perfect for HSC 2027 students!"
                    }
                }
            }
        }
    }
};

// Storage functions
async function loadCourses() {
    try {
        const data = await fs.readFile(COURSES_FILE, 'utf8');
        const parsed = JSON.parse(data);
        Object.keys(courses).forEach(key => delete courses[key]);
        Object.assign(courses, parsed);
        return courses;
    } catch (error) {
        await saveCourses(defaultCourses);
        return defaultCourses;
    }
}

async function saveCourses(courses) {
    try {
        await fs.writeFile(COURSES_FILE, JSON.stringify(courses, null, 2));
    } catch (error) {
        console.error('Error saving courses:', error);
    }
}

async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        const usersData = JSON.parse(data);
        const usersMap = new Map();
        Object.entries(usersData).forEach(([userId, userData]) => {
            usersMap.set(userId, { ...userData, purchases: new Set(userData.purchases || []) });
        });
        return usersMap;
    } catch (error) {
        return new Map();
    }
}

async function saveUsers() {
    try {
        const usersData = {};
        users.forEach((userData, userId) => {
            usersData[userId] = { ...userData, purchases: Array.from(userData.purchases || []) };
        });
        await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
    } catch (error) {
        console.error('Error saving users:', error);
    }
}

async function loadTransactions() {
    try {
        const data = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
        return new Set(JSON.parse(data));
    } catch (error) {
        return new Set();
    }
}

async function saveTransactions() {
    try {
        await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify(Array.from(usedTransactions), null, 2));
    } catch (error) {
        console.error('Error saving transactions:', error);
    }
}

async function loadCourseChannelMap() {
    try {
        const data = await fs.readFile(COURSE_CHANNEL_MAP_FILE, 'utf8');
        const mapped = JSON.parse(data);
        Object.assign(courseChannelMap, mapped);
        console.log('Course channel mapping loaded:', Object.keys(courseChannelMap));
    } catch (error) {
        console.log('Course channel mapping file not found, using default');
    }
}

async function saveCourseChannelMap() {
    try {
        await fs.writeFile(COURSE_CHANNEL_MAP_FILE, JSON.stringify(courseChannelMap, null, 2));
    } catch (error) {
        console.error('Error saving course channel map:', error);
    }
}

// Course display functions
async function showCourseFromChannel(chatId, courseId, messageId = null) {
    const channelData = courseChannelMap[courseId];
    if (!channelData || !channelData.messageId) {
        return showRegularCourse(chatId, courseId, messageId);
    }
    
    try {
        await bot.forwardMessage(chatId, channelData.channelId, channelData.messageId);
        const courseData = findCourse(courseId);
        if (courseData) {
            const { course } = courseData;
            const userData = getUserData(chatId);
            const isPurchased = userData.purchases.has(courseId);
            const isPending = userData.pendingCourse === courseId;
            
            let buttonText = '', keyboard;
            if (isPurchased) {
                buttonText = `✅ You have access to ${course.name}!`;
                keyboard = { reply_markup: { inline_keyboard: [[{ text: '🎯 Join Course Group', url: course.groupLink }], [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] } };
            } else if (isPending) {
                buttonText = `⏳ Payment pending for ${course.name}\n💰 Price: ${course.price} TK`;
                keyboard = getCourseKeyboard(courseId, chatId, true);
            } else {
                buttonText = `💰 Price: ${course.price} TK\n\nReady to purchase ${course.name}?`;
                keyboard = { reply_markup: { inline_keyboard: [[{ text: '💳 Buy Now', callback_data: `buy_${courseId}` }], [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] } };
            }
            
            if (messageId) {
                try {
                    await bot.editMessageText(buttonText, { chat_id: chatId, message_id: messageId, ...keyboard });
                } catch (error) {
                    await bot.sendMessage(chatId, buttonText, keyboard);
                }
            } else {
                await bot.sendMessage(chatId, buttonText, keyboard);
            }
        }
    } catch (error) {
        console.error('Error forwarding channel message:', error);
        await bot.sendMessage(chatId, '⚠️ Could not load course from channel. Showing basic info...');
        showRegularCourse(chatId, courseId, messageId);
    }
}

function showRegularCourse(chatId, courseId, messageId = null) {
    const courseData = findCourse(courseId);
    if (!courseData) {
        const errorMsg = '❌ Course not found!';
        if (messageId) {
            try { bot.editMessageText(errorMsg, { chat_id: chatId, message_id: messageId }); } catch (error) { bot.sendMessage(chatId, errorMsg); }
        } else { bot.sendMessage(chatId, errorMsg); }
        return;
    }
    
    const { course } = courseData;
    const userData = getUserData(chatId);
    const isPurchased = userData.purchases.has(courseId);
    const isPending = userData.pendingCourse === courseId;
    
    let courseText = `${course.name}\n\n${course.description}\n\n`;
    if (isPurchased) {
        courseText += `Status: ✅ Purchased\n💰 Price: ${course.price} TK\n\n🎉 You have access to this course!`;
    } else if (isPending) {
        courseText += `Status: ⏳ Payment Pending\n💰 Price: ${course.price} TK`;
    } else {
        courseText += `Status: ❌ Not Purchased\n💰 Price: ${course.price} TK`;
    }
    
    const keyboard = getCourseKeyboard(courseId, chatId, isPending);
    if (messageId) {
        try { bot.editMessageText(courseText, { chat_id: chatId, message_id: messageId, ...keyboard }); } catch (error) { bot.sendMessage(chatId, courseText, keyboard); }
    } else { bot.sendMessage(chatId, courseText, keyboard); }
}

let courses = {};

async function initializeBot() {
    try {
        courses = await loadCourses();
        await loadCourseChannelMap();
        const loadedUsers = await loadUsers();
        loadedUsers.forEach((userData, userId) => users.set(userId, userData));
        const loadedTransactions = await loadTransactions();
        loadedTransactions.forEach(trx => usedTransactions.add(trx));
        console.log('Bot initialized successfully');
    } catch (error) {
        console.error('Error initializing bot:', error);
    }
}

// Helper functions
function isAdmin(userId) { return adminUsers.has(userId.toString()); }
function isPrimaryAdmin(userId) { return userId.toString() === ADMIN_ID; }
function getUserData(userId) {
    if (!users.has(userId)) {
        users.set(userId, { purchases: new Set(), pendingCourse: null, pendingPaymentMethod: null, currentMenu: null });
    }
    return users.get(userId);
}

function findCourse(courseId) {
    for (const [menuId, menu] of Object.entries(courses)) {
        if (menu.submenus) {
            for (const [submenuId, submenu] of Object.entries(menu.submenus)) {
                if (submenu.courses && submenu.courses[courseId]) {
                    return { course: submenu.courses[courseId], menuId, submenuId, courseId };
                }
            }
        }
    }
    return null;
}

function isTransactionUsed(trxId) { return usedTransactions.has(trxId); }

async function logTransaction(trxId, userId, amount, courseName, paymentMethod) {
    usedTransactions.add(trxId);
    await saveTransactions();
    const message = `💰 **New Payment**\n\n👤 User: \`${userId}\`\n📚 Course: ${courseName}\n💵 Amount: ${amount} TK\n💳 Method: ${paymentMethod}\n🆔 TRX ID: \`${trxId}\`\n⏰ Time: ${new Date().toLocaleString()}`;
    await bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'Markdown' });
}

// bKash functions
let bkashToken = null, tokenExpiry = null;

async function getBkashToken() {
    if (bkashToken && tokenExpiry && Date.now() < tokenExpiry) return bkashToken;
    try {
        const response = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/token/grant`, { app_key: BKASH_APP_KEY, app_secret: BKASH_APP_SECRET }, { headers: { 'Content-Type': 'application/json', 'username': BKASH_USERNAME, 'password': BKASH_PASSWORD } });
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
        const response = await axios.post(`${BKASH_BASE_URL}/tokenized/checkout/general/searchTransaction`, { trxID: trxId }, { headers: { 'Content-Type': 'application/json', 'Authorization': token, 'X-APP-Key': BKASH_APP_KEY } });
        return response.data;
    } catch (error) {
        console.error('Payment verification error:', error.message);
        return null;
    }
}

// Keyboard functions
const mainMenuKeyboard = { reply_markup: { inline_keyboard: [] } };

function updateMainMenuKeyboard() {
    const keyboard = [];
    Object.entries(courses).forEach(([menuId, menu]) => {
        keyboard.push([{ text: menu.name, callback_data: `menu_${menuId}` }]);
    });
    keyboard.push([{ text: '🔥 Support 🔥', url: 'https://t.me/yoursupport' }, { text: '🔥 Our Channel ❤️', url: 'https://t.me/yourchannel' }]);
    mainMenuKeyboard.reply_markup.inline_keyboard = keyboard;
}

function getMenuKeyboard(menuId) {
    const menu = courses[menuId];
    if (!menu || !menu.submenus) return mainMenuKeyboard;
    const keyboard = [];
    Object.entries(menu.submenus).forEach(([submenuId, submenu]) => {
        keyboard.push([{ text: submenu.name, callback_data: `submenu_${menuId}_${submenuId}` }]);
    });
    keyboard.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
    return { reply_markup: { inline_keyboard: keyboard } };
}

function getSubmenuKeyboard(menuId, submenuId, userId) {
    const submenu = courses[menuId]?.submenus?.[submenuId];
    if (!submenu || !submenu.courses) return mainMenuKeyboard;
    const userData = getUserData(userId);
    const keyboard = [];
    Object.entries(submenu.courses).forEach(([courseId, course]) => {
        const status = userData.purchases.has(courseId) ? '✅ Purchased' : '❌ Not Purchased';
        keyboard.push([{ text: `${course.name}\n${status}\nPrice: ${course.price} TK`, callback_data: `course_${courseId}` }]);
    });
    keyboard.push([{ text: '⬅️ Back', callback_data: `menu_${menuId}` }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]);
    return { reply_markup: { inline_keyboard: keyboard } };
}

function getCourseKeyboard(courseId, userId, isPending = false) {
    const userData = getUserData(userId);
    const courseData = findCourse(courseId);
    if (!courseData) return mainMenuKeyboard;
    const { course, menuId, submenuId } = courseData;
    const keyboard = [];
    
    if (userData.purchases.has(courseId)) {
        keyboard.push([{ text: '🎯 Join Course Group', url: course.groupLink }]);
    } else if (isPending) {
        keyboard.push([{ text: '💳 Pay Now', callback_data: `payment_method_${courseId}` }, { text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }]);
    } else {
        keyboard.push([{ text: '💳 Buy Now', callback_data: `buy_${courseId}` }]);
    }
    keyboard.push([{ text: '⬅️ Back', callback_data: `submenu_${menuId}_${submenuId}` }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]);
    return { reply_markup: { inline_keyboard: keyboard } };
}

function getPaymentMethodKeyboard(courseId) {
    return { reply_markup: { inline_keyboard: [[{ text: 'bKash', callback_data: `pay_bkash_${courseId}` }], [{ text: 'Nagad', callback_data: `pay_nagad_${courseId}` }], [{ text: '⬅️ Back', callback_data: `course_${courseId}` }]] } };
}

// Bot commands
bot.onText(/\/start/, (msg) => {
    updateMainMenuKeyboard();
    const welcomeText = `🎓 Welcome to HSC Courses Bot! 🎓\n\nআমাদের premium courses গুলো দেখুন এবং আপনার পছন্দের course কিনুন।\n\n💎 High Quality Content\n📚 Expert Teachers\n🎯 Guaranteed Results\n💯 24/7 Support`;
    bot.sendMessage(msg.chat.id, welcomeText, mainMenuKeyboard);
});

// Admin commands
bot.onText(/\/admin/, (msg) => {
    if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ You are not authorized!');
    const isPrimary = isPrimaryAdmin(msg.from.id);
    const adminText = `🔧 Admin Panel ${isPrimary ? '(Primary Admin)' : '(Sub Admin)'}\n\n📚 **Course Management:**\n/addmenu - Add new main menu\n/addsubmenu - Add submenu to main menu\n/addcourse - Add course to submenu\n/editcourse - Edit course details\n/setimage - Set course image\n/setdesc - Set course description\n\n📧 **Channel Message Management:**\n/setmessage - Link course to channel message\n/listmessages - Show all linked messages\n/removemessage - Remove channel message link\n\n📊 **Analytics:**\n/stats - View statistics\n/users - View user count\n/revenue - View revenue details`;
    bot.sendMessage(msg.chat.id, adminText, {parse_mode: 'Markdown'});
});

bot.onText(/\/addmenu (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const params = match[1].trim().split(' ');
    if (params.length < 2) return bot.sendMessage(msg.chat.id, '❌ Format: /addmenu menuId menuName');
    const menuId = params[0], menuName = params.slice(1).join(' ');
    if (courses[menuId]) return bot.sendMessage(msg.chat.id, `❌ Menu "${menuId}" already exists!`);
    courses[menuId] = { name: menuName, type: "menu", submenus: {} };
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Menu "${menuName}" created successfully!`);
});

bot.onText(/\/addsubmenu (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const params = match[1].trim().split(' ');
    if (params.length < 3) return bot.sendMessage(msg.chat.id, '❌ Format: /addsubmenu menuId submenuId submenuName');
    const menuId = params[0], submenuId = params[1], submenuName = params.slice(2).join(' ');
    if (!courses[menuId]) return bot.sendMessage(msg.chat.id, `❌ Menu "${menuId}" not found!`);
    if (!courses[menuId].submenus) courses[menuId].submenus = {};
    if (courses[menuId].submenus[submenuId]) return bot.sendMessage(msg.chat.id, `❌ Submenu "${submenuId}" already exists!`);
    courses[menuId].submenus[submenuId] = { name: submenuName, type: "submenu", courses: {} };
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Submenu "${submenuName}" added successfully!`);
});

bot.onText(/\/addcourse (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const params = match[1].trim().split(' ');
    if (params.length < 4) return bot.sendMessage(msg.chat.id, '❌ Format: /addcourse menuId submenuId courseId courseName|price|groupLink|description');
    const menuId = params[0], submenuId = params[1], courseId = params[2], courseInfo = params.slice(3).join(' ');
    const courseData = courseInfo.split('|');
    if (courseData.length < 4) return bot.sendMessage(msg.chat.id, '❌ Course data format: courseName|price|groupLink|description');
    const [courseName, price, groupLink, description] = courseData;
    if (!courses[menuId]?.submenus?.[submenuId]) return bot.sendMessage(msg.chat.id, `❌ Menu or submenu not found!`);
    const priceNum = parseInt(price.trim());
    if (isNaN(priceNum) || priceNum <= 0) return bot.sendMessage(msg.chat.id, '❌ Invalid price!');
    if (!courses[menuId].submenus[submenuId].courses) courses[menuId].submenus[submenuId].courses = {};
    courses[menuId].submenus[submenuId].courses[courseId] = { name: courseName.trim(), type: "course", price: priceNum, groupLink: groupLink.trim(), paymentLink: "", imageLink: "", description: description.trim() };
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Course "${courseName}" added successfully!`);
});

bot.onText(/\/setmessage (.+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const courseId = match[1].trim(), messageId = parseInt(match[2].trim());
    if (isNaN(messageId)) return bot.sendMessage(msg.chat.id, '❌ Invalid message ID! Must be a number.');
    const courseData = findCourse(courseId);
    if (!courseData) return bot.sendMessage(msg.chat.id, '❌ Course not found!');
    courseChannelMap[courseId] = { channelId: CHANNEL_ID, messageId: messageId };
    await saveCourseChannelMap();
    bot.sendMessage(msg.chat.id, `✅ Channel message set for course "${courseData.course.name}"!\n\n📱 Course ID: ${courseId}\n📧 Message ID: ${messageId}`);
});

bot.onText(/\/listmessages/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    let messageList = '📧 **Course Channel Messages:**\n\n';
    if (Object.keys(courseChannelMap).length === 0) {
        messageList += 'No channel messages configured.';
    } else {
        Object.entries(courseChannelMap).forEach(([courseId, data]) => {
            const courseData = findCourse(courseId);
            const courseName = courseData ? courseData.course.name : 'Unknown Course';
            messageList += `🔹 **${courseName}** (${courseId})\n   📧 Message ID: ${data.messageId || 'Not set'}\n\n`;
        });
    }
    bot.sendMessage(msg.chat.id, messageList, {parse_mode: 'Markdown'});
});

bot.onText(/\/removemessage (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const courseId = match[1].trim();
    if (!courseChannelMap[courseId]) return bot.sendMessage(msg.chat.id, '❌ No channel message found for this course!');
    delete courseChannelMap[courseId];
    await saveCourseChannelMap();
    bot.sendMessage(msg.chat.id, `✅ Channel message removed for course: ${courseId}`);
});

bot.onText(/\/stats/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const totalUsers = users.size;
    let totalPurchases = 0, totalRevenue = 0, totalCourses = 0;
    Object.values(courses).forEach(menu => {
        if (menu.submenus) Object.values(menu.submenus).forEach(submenu => {
            if (submenu.courses) totalCourses += Object.keys(submenu.courses).length;
        });
    });
    users.forEach(userData => {
        totalPurchases += userData.purchases.size;
        userData.purchases.forEach(courseId => {
            const courseData = findCourse(courseId);
            if (courseData) totalRevenue += courseData.course.price;
        });
    });
    const statsText = `📊 Bot Statistics\n\n👥 Total Users: ${totalUsers}\n💰 Total Purchases: ${totalPurchases}\n💵 Total Revenue: ${totalRevenue} TK\n📚 Available Courses: ${totalCourses}`;
    bot.sendMessage(msg.chat.id, statsText);
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message, data = callbackQuery.data, userId = callbackQuery.from.id;
    const userData = getUserData(userId);
    bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'main_menu') {
        updateMainMenuKeyboard();
        const welcomeText = `🎓 HSC Courses Bot - Main Menu 🎓\n\nআপনার পছন্দের course category সিলেক্ট করুন:`;
        try { bot.editMessageText(welcomeText, { chat_id: msg.chat.id, message_id: msg.message_id, ...mainMenuKeyboard }); } catch (error) { bot.sendMessage(msg.chat.id, welcomeText, mainMenuKeyboard); }
    }
    else if (data.startsWith('menu_')) {
        const menuId = data.replace('menu_', ''), menu = courses[menuId];
        if (!menu) return bot.sendMessage(msg.chat.id, '❌ Menu not found!');
        const menuText = `${menu.name}\n\n📚 Available Categories:`;
        try { bot.editMessageText(menuText, { chat_id: msg.chat.id, message_id: msg.message_id, ...getMenuKeyboard(menuId) }); } catch (error) { bot.sendMessage(msg.chat.id, menuText, getMenuKeyboard(menuId)); }
    }
    else if (data.startsWith('submenu_')) {
        const parts = data.replace('submenu_', '').split('_'), menuId = parts[0], submenuId = parts.slice(1).join('_');
        const submenu = courses[menuId]?.submenus?.[submenuId];
        if (!submenu) return bot.sendMessage(msg.chat.id, '❌ Submenu not found!');
        const submenuText = `${submenu.name}\n\n📚 Available Courses:`;
        try { bot.editMessageText(submenuText, { chat_id: msg.chat.id, message_id: msg.message_id, ...getSubmenuKeyboard(menuId, submenuId, userId) }); } catch (error) { bot.sendMessage(msg.chat.id, submenuText, getSubmenuKeyboard(menuId, submenuId, userId)); }
    }
    else if (data.startsWith('course_')) {
        const courseId = data.replace('course_', '');
        await showCourseFromChannel(msg.chat.id, courseId, msg.message_id);
    }
    else if (data.startsWith('buy_')) {
        const courseId = data.replace('buy_', ''), courseData = findCourse(courseId);
        if (!courseData) return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        const { course } = courseData;
        userData.pendingCourse = courseId;
        await saveUsers();
        const paymentText = `💳 Payment for ${course.name}\n\n💰 Amount: ${course.price} TK\n\n💡 Payment Options:\n1. bKash or Nagad এ payment করুন\n2. Transaction ID copy করুন বা screenshot নিন\n3. "Submit Payment Proof" button এ click করুন`;
        try { bot.editMessageText(paymentText, { chat_id: msg.chat.id, message_id: msg.message_id, ...getCourseKeyboard(courseId, userId, true) }); } catch (error) { bot.sendMessage(msg.chat.id, paymentText, getCourseKeyboard(courseId, userId, true)); }
    }
    else if (data.startsWith('payment_method_')) {
        const courseId = data.replace('payment_method_', ''), courseData = findCourse(courseId);
        if (!courseData) return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        const { course } = courseData, paymentText = `💳 Select Payment Method for ${course.name}\n\n💰 Amount: ${course.price} TK`;
        try { bot.editMessageText(paymentText, { chat_id: msg.chat.id, message_id: msg.message_id, ...getPaymentMethodKeyboard(courseId) }); } catch (error) { bot.sendMessage(msg.chat.id, paymentText, getPaymentMethodKeyboard(courseId)); }
    }
    else if (data.startsWith('pay_bkash_')) {
        const courseId = data.replace('pay_bkash_', ''), courseData = findCourse(courseId);
        if (!courseData) return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        const { course } = courseData;
        userData.pendingPaymentMethod = 'bKash';
        await saveUsers();
        let paymentText = `💳 bKash Payment for ${course.name}\n\n💰 Amount: ${course.price} TK\n📱 bKash Number: ${BKASH_NUMBER}\n\n`, keyboard;
        if (course.paymentLink) {
            paymentText += `💡 Payment Instructions:\n✅ Click "Pay with bKash Link" button\n✅ Complete payment\n✅ Copy Transaction ID\n✅ Click "Submit Payment Proof"\n\n🔹 bKash payment auto approve হবে!`;
            keyboard = { reply_markup: { inline_keyboard: [[{ text: '💳 Pay with bKash Link', url: course.paymentLink }], [{ text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }], [{ text: '⬅️ Back', callback_data: `payment_method_${courseId}` }]] } };
        } else {
            paymentText += `💡 Manual Payment Instructions:\n✅ Make Payment ${course.price} TK to above number\n✅ Copy Transaction ID\n✅ Click "Submit Payment Proof"\n\n🔹 bKash payment auto approve হবে!`;
            keyboard = { reply_markup: { inline_keyboard: [[{ text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }], [{ text: '⬅️ Back', callback_data: `payment_method_${courseId}` }]] } };
        }
        try { bot.editMessageText(paymentText, { chat_id: msg.chat.id, message_id: msg.message_id, ...keyboard }); } catch (error) { bot.sendMessage(msg.chat.id, paymentText, keyboard); }
    }
    else if (data.startsWith('pay_nagad_')) {
        const courseId = data.replace('pay_nagad_', ''), courseData = findCourse(courseId);
        if (!courseData) return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        const { course } = courseData;
        userData.pendingPaymentMethod = 'Nagad';
        await saveUsers();
        const paymentText = `💳 Nagad Payment for ${course.name}\n\n💰 Amount: ${course.price} TK\n📱 Nagad Number: ${NAGAD_NUMBER}\n\n💡 Payment Instructions:\n✅ Send ${course.price} TK to above number\n✅ Take screenshot\n✅ Click "Submit Payment Proof"\n\n⚠️ Nagad payment manually approve হবে!`;
        try { bot.editMessageText(paymentText, { chat_id: msg.chat.id, message_id: msg.message_id, reply_markup: { inline_keyboard: [[{ text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }], [{ text: '💬 Message Admin', url: `https://t.me/${ADMIN_USERNAME}` }], [{ text: '⬅️ Back', callback_data: `payment_method_${courseId}` }]] } }); } catch (error) { bot.sendMessage(msg.chat.id, paymentText, { reply_markup: { inline_keyboard: [[{ text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }], [{ text: '💬 Message Admin', url: `https://t.me/${ADMIN_USERNAME}` }], [{ text: '⬅️ Back', callback_data: `payment_method_${courseId}` }]] } }); }
    }
    else if (data.startsWith('submit_proof_')) {
        const courseId = data.replace('submit_proof_', ''), courseData = findCourse(courseId);
        if (!courseData) return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        const { course } = courseData, paymentMethod = userData.pendingPaymentMethod || 'bKash';
        const trxText = `📝 Submit Your Payment Proof\n\n💡 Instructions:\n${paymentMethod === 'bKash' ? '✅ Enter your bKash Transaction ID' : '✅ Send screenshot of your Nagad payment'}\n\n📱 ${course.name} এর জন্য payment verification\n💰 Amount: ${course.price} TK\n💳 Method: ${paymentMethod}`;
        bot.sendMessage(msg.chat.id, trxText, { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: `course_${courseId}` }]] } });
        userData.waitingForProof = { courseId, paymentMethod };
        await saveUsers();
    }
    else if (data.startsWith('approve_') || data.startsWith('reject_')) {
        if (!isAdmin(callbackQuery.from.id)) return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ You are not authorized!', show_alert: true });
        const parts = data.split('_'), action = parts[0], userId = parts[1], courseId = parts[2];
        const userData = getUserData(userId), courseData = findCourse(courseId);
        if (!courseData) return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!', show_alert: true });
        const { course } = courseData;
        if (action === 'approve') {
            userData.purchases.add(courseId);
            userData.pendingCourse = null;
            userData.pendingPaymentMethod = null;
            await saveUsers();
            bot.sendMessage(userId, `✅ **Your payment for ${course.name} has been approved!**\n\n🎯 Join your course group:\n👉 ${course.groupLink}`, { parse_mode: 'Markdown' });
            bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Payment approved!', show_alert: true });
            try { bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: '✅ Approved', callback_data: 'already_approved' }]] }, { chat_id: callbackQuery.message.chat.id, message_id: callbackQuery.message.message_id }); } catch (error) { console.log('Could not update admin message markup'); }
        } else if (action === 'reject') {
            bot.sendMessage(userId, `❌ **Your payment proof for ${course.name} was rejected.**\n\n💡 Please submit valid payment proof or contact support.`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '💬 Contact Support', url: 'https://t.me/yoursupport' }]] } });
            bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Payment rejected!', show_alert: true });
            try { bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'already_rejected' }]] }, { chat_id: callbackQuery.message.chat.id, message_id: callbackQuery.message.message_id }); } catch (error) { console.log('Could not update admin message markup'); }
        }
    }
});

// Handle payment proof input
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    const userId = msg.from.id, userData = getUserData(userId);
    
    if (userData.waitingForProof) {
        const { courseId, paymentMethod } = userData.waitingForProof, courseData = findCourse(courseId);
        if (!courseData) {
            userData.waitingForProof = null;
            await saveUsers();
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        const { course } = courseData;
        userData.waitingForProof = null;
        await saveUsers();
        
        if (msg.photo) {
            const photo = msg.photo[msg.photo.length - 1], fileId = photo.file_id;
            const adminMessage = `🆕 New Payment Proof\n\n👤 User: \`${userId}\`\n📚 Course: ${course.name}\n💰 Amount: ${course.price} TK\n💳 Method: ${paymentMethod}\n\n⚠️ Manual approval required`;
            try {
                await bot.sendPhoto(ADMIN_ID, fileId, { caption: adminMessage, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '✅ Approve', callback_data: `approve_${userId}_${courseId}` }, { text: '❌ Reject', callback_data: `reject_${userId}_${courseId}` }]] } });
                bot.sendMessage(msg.chat.id, `✅ Payment proof received for ${course.name}!\n\nAdmin will verify your payment shortly.`, { reply_markup: { inline_keyboard: [[{ text: '💬 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` }]] } });
            } catch (error) {
                console.error('Error sending proof to admin:', error);
                bot.sendMessage(msg.chat.id, '⚠️ Error submitting payment proof. Please try again or contact support.');
            }
        } else if (msg.text && paymentMethod === 'bKash') {
            const trxId = msg.text.trim();
            if (isTransactionUsed(trxId)) return bot.sendMessage(msg.chat.id, "❌ **এই Transaction ID আগেই ব্যবহার করা হয়েছে!**\n\nদয়া করে নতুন একটি Transaction ID দিন।", { parse_mode: 'Markdown' });
            bot.sendMessage(msg.chat.id, '⏳ Verifying payment... Please wait...');
            try {
                const paymentData = await verifyPayment(trxId);
                if (paymentData && paymentData.transactionStatus === 'Completed' && parseInt(paymentData.amount) >= course.price) {
                    await logTransaction(trxId, userId, course.price, course.name, paymentMethod);
                    userData.purchases.add(courseId);
                    userData.pendingCourse = null;
                    userData.pendingPaymentMethod = null;
                    await saveUsers();
                    const successText = `✅ **পেমেন্ট সফলভাবে ভেরিফাই হয়েছে!**\n\n📱 ${course.name} Unlocked!\n💰 Amount: ${course.price} TK\n🎫 Transaction ID: ${trxId}\n\n🎯 Join your course group:`;
                    bot.sendMessage(msg.chat.id, successText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: `🎯 Join ${course.name} Group`, url: course.groupLink }], [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] } });
                } else {
                    bot.sendMessage(msg.chat.id, `❌ Payment Verification Failed!\n\n🔍 Possible reasons:\n• Transaction ID not found\n• Payment amount insufficient\n• Payment not completed\n\nTransaction ID entered: ${trxId}`, { reply_markup: { inline_keyboard: [[{ text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }], [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] } });
                }
            } catch (error) {
                console.error('Payment verification error:', error);
                bot.sendMessage(msg.chat.id, `⚠️ Verification Error!\n\nSomething went wrong while verifying your payment. Please contact support.\n\nTransaction ID: ${trxId}`, { reply_markup: { inline_keyboard: [[{ text: '💬 Contact Support', url: 'https://t.me/yoursupport' }], [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] } });
            }
        } else {
            bot.sendMessage(msg.chat.id, '⚠️ Please send a screenshot of your payment or the transaction ID (for bKash only).');
        }
    }
});

// Express server
app.get('/', (req, res) => { res.send('HSC Courses Bot is running!'); });
app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });

// Initialize bot
initializeBot().then(() => { console.log('HSC Courses Bot started successfully!'); }).catch(error => { console.error('Error starting bot:', error); });