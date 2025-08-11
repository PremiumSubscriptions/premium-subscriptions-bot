const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

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
const usedTransactions = new Set();

// JSON file paths
const COURSES_FILE = path.join(__dirname, 'courses.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const TRANSACTIONS_FILE = path.join(__dirname, 'transactions.json');

// Default course structure
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
                    },
                    "acs_hm_cycle2": {
                        "name": "🧮 ACS HM Cycle 2",
                        "type": "course",
                        "price": 100,
                        "groupLink": "https://t.me/+HSC2027ACSMATH2",
                        "paymentLink": "",
                        "imageLink": "",
                        "description": "📖 Complete ACS Higher Math Cycle 2 Course\n\n✅ Advanced Topics Coverage\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support\n✅ Lifetime Access"
                    }
                }
            },
            "acs_physics": {
                "name": "⚛️ ACS Physics All Course",
                "type": "submenu",
                "courses": {
                    "physics_1st": {
                        "name": "⚛️ Physics 1st Paper",
                        "type": "course",
                        "price": 150,
                        "groupLink": "https://t.me/+HSC2027Physics1st",
                        "paymentLink": "",
                        "imageLink": "",
                        "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
                    },
                    "physics_2nd": {
                        "name": "⚛️ Physics 2nd Paper",
                        "type": "course",
                        "price": 150,
                        "groupLink": "https://t.me/+HSC2027Physics2nd",
                        "paymentLink": "",
                        "imageLink": "",
                        "description": "📖 Complete Physics 2nd Paper Course\n\n✅ Electricity & Magnetism\n✅ Modern Physics\n✅ Electronics & Communication\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
                    }
                }
            }
        }
    },
    "hsc26": {
        "name": "🔥HSC 2026 All Courses🔥",
        "type": "menu",
        "submenus": {
            "bondi_pathshala": {
                "name": "📚 Bondi Pathshala",
                "type": "submenu",
                "courses": {
                    "biology_cycle1": {
                        "name": "🧬 Biology Cycle 1",
                        "type": "course",
                        "price": 200,
                        "groupLink": "https://t.me/+HSC2026Biology1",
                        "paymentLink": "",
                        "imageLink": "",
                        "description": "📖 Complete Biology Cycle 1 Course\n\n✅ Cell Biology & Biochemistry\n✅ Plant Biology\n✅ Animal Biology\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support"
                    }
                }
            }
        }
    },
    "admission25": {
        "name": "HSC 2025 সকল Admission কোর্স 🟢",
        "type": "menu",
        "submenus": {
            "university_prep": {
                "name": "🎓 University Preparation",
                "type": "submenu",
                "courses": {
                    "medical_prep": {
                        "name": "🏥 Medical Admission Prep",
                        "type": "course",
                        "price": 300,
                        "groupLink": "https://t.me/+Medical2025",
                        "paymentLink": "",
                        "imageLink": "",
                        "description": "📖 Complete Medical Admission Preparation\n\n✅ MCQ Practice\n✅ Previous Years Questions\n✅ Mock Tests\n✅ Live Classes\n✅ Expert Guidance\n✅ Study Materials"
                    }
                }
            }
        }
    }
};

// Load/Save functions
async function loadCourses() {
    try {
        const data = await fs.readFile(COURSES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log('Creating default courses file...');
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
        // Convert to Map
        const usersMap = new Map();
        Object.entries(usersData).forEach(([userId, userData]) => {
            usersMap.set(userId, {
                ...userData,
                purchases: new Set(userData.purchases || [])
            });
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
            usersData[userId] = {
                ...userData,
                purchases: Array.from(userData.purchases || [])
            };
        });
        await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
    } catch (error) {
        console.error('Error saving users:', error);
    }
}

async function loadTransactions() {
    try {
        const data = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
        const transactions = JSON.parse(data);
        return new Set(transactions);
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

// Initialize data
let courses = {};

async function initializeBot() {
    courses = await loadCourses();
    const loadedUsers = await loadUsers();
    loadedUsers.forEach((userData, userId) => users.set(userId, userData));
    const loadedTransactions = await loadTransactions();
    loadedTransactions.forEach(trx => usedTransactions.add(trx));
}

// Helper functions
function isAdmin(userId) {
    return adminUsers.has(userId.toString());
}

function isPrimaryAdmin(userId) {
    return userId.toString() === ADMIN_ID;
}

function getUserData(userId) {
    if (!users.has(userId)) {
        users.set(userId, {
            purchases: new Set(),
            pendingCourse: null,
            pendingPaymentMethod: null,
            currentMenu: null
        });
    }
    return users.get(userId);
}

// Find course by ID
function findCourse(courseId) {
    for (const [menuId, menu] of Object.entries(courses)) {
        if (menu.submenus) {
            for (const [submenuId, submenu] of Object.entries(menu.submenus)) {
                if (submenu.courses && submenu.courses[courseId]) {
                    return {
                        course: submenu.courses[courseId],
                        menuId,
                        submenuId,
                        courseId
                    };
                }
            }
        }
    }
    return null;
}

// Transaction ID Management
function isTransactionUsed(trxId) {
    return usedTransactions.has(trxId);
}

async function logTransaction(trxId, userId, amount, courseName, paymentMethod) {
    usedTransactions.add(trxId);
    await saveTransactions();
    
    const message = `💰 **New Payment**\n\n` +
                   `👤 User: \`${userId}\`\n` +
                   `📚 Course: ${courseName}\n` +
                   `💵 Amount: ${amount} TK\n` +
                   `💳 Method: ${paymentMethod}\n` +
                   `🆔 TRX ID: \`${trxId}\`\n` +
                   `⏰ Time: ${new Date().toLocaleString()}`;

    await bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'Markdown' });
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

// Keyboard functions
const mainMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🔥HSC 2027 All Courses🔥', callback_data: 'menu_hsc27' }],
            [{ text: 'HSC 2025 সকল Admission কোর্স 🟢', callback_data: 'menu_admission25' }],
            [{ text: '🔥HSC 2026 All Courses🔥', callback_data: 'menu_hsc26' }],
            [
                { text: '🔥 Support 🔥', url: 'https://t.me/yoursupport' },
                { text: '🔥 Our Channel ❤️', url: 'https://t.me/yourchannel' }
            ]
        ]
    }
};

function getMenuKeyboard(menuId) {
    const menu = courses[menuId];
    if (!menu || !menu.submenus) return mainMenuKeyboard;
    
    const keyboard = [];
    
    Object.entries(menu.submenus).forEach(([submenuId, submenu]) => {
        keyboard.push([{
            text: submenu.name,
            callback_data: `submenu_${menuId}_${submenuId}`
        }]);
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
        keyboard.push([{
            text: `${course.name}\n${status}\nPrice: ${course.price} TK`,
            callback_data: `course_${courseId}`
        }]);
    });
    
    keyboard.push([
        { text: '⬅️ Back', callback_data: `menu_${menuId}` },
        { text: '🏠 Main Menu', callback_data: 'main_menu' }
    ]);
    
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
        keyboard.push([
            { text: '💳 Pay Now', callback_data: `payment_method_${courseId}` },
            { text: '📝 Submit Payment Proof', callback_data: `submit_proof_${courseId}` }
        ]);
    } else {
        keyboard.push([{ text: '💳 Buy Now', callback_data: `buy_${courseId}` }]);
    }
    
    keyboard.push([
        { text: '⬅️ Back', callback_data: `submenu_${menuId}_${submenuId}` },
        { text: '🏠 Main Menu', callback_data: 'main_menu' }
    ]);
    
    return { reply_markup: { inline_keyboard: keyboard } };
}

function getPaymentMethodKeyboard(courseId) {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'bKash', callback_data: `pay_bkash_${courseId}` }],
                [{ text: 'Nagad', callback_data: `pay_nagad_${courseId}` }],
                [{ text: '⬅️ Back', callback_data: `course_${courseId}` }]
            ]
        }
    };
}

// Bot Commands
bot.onText(/\/start/, (msg) => {
    const welcomeText = `🎓 Welcome to HSC Courses Bot! 🎓

আমাদের premium courses গুলো দেখুন এবং আপনার পছন্দের course কিনুন।

💎 High Quality Content
📚 Expert Teachers  
🎯 Guaranteed Results
💯 24/7 Support`;

    bot.sendMessage(msg.chat.id, welcomeText, mainMenuKeyboard);
});

// Admin Commands
bot.onText(/\/admin/, (msg) => {
    if (!isAdmin(msg.from.id)) {
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

💰 **Payment Management:**
/updatebkash - Update bKash number
/updatenagad - Update Nagad number
/setpaymentlink - Set payment link for course

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
\`/addcourse hsc27 acs_hm chemistry_basics ⚗️ Chemistry Basics|200|https://t.me/+chem|Basic chemistry course\`
\`/editcourse chemistry_basics price 250\`
\`/setpaymentlink chemistry_basics https://your-link.com\`
\`/setimage chemistry_basics\` (reply to image)` : `

🔧 **Examples:**
\`/addcourse hsc27 acs_hm chemistry_basics ⚗️ Chemistry Basics|200|https://t.me/+chem|Basic chemistry course\`
\`/editcourse chemistry_basics price 250\``);

    bot.sendMessage(msg.chat.id, adminText, {parse_mode: 'Markdown'});
});

// Admin Commands Implementation

// Add Menu
bot.onText(/\/addmenu (.+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const menuId = match[1].trim();
    const menuName = match[2];
    
    if (courses[menuId]) {
        return bot.sendMessage(msg.chat.id, '❌ Menu already exists!');
    }
    
    courses[menuId] = {
        name: menuName,
        type: "menu",
        submenus: {}
    };
    
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Menu "${menuName}" created successfully!\nID: ${menuId}`);
});

// Add Submenu
bot.onText(/\/addsubmenu (.+) (.+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const menuId = match[1].trim();
    const submenuId = match[2].trim();
    const submenuName = match[3];
    
    if (!courses[menuId]) {
        return bot.sendMessage(msg.chat.id, '❌ Menu not found!');
    }
    
    if (!courses[menuId].submenus) {
        courses[menuId].submenus = {};
    }
    
    courses[menuId].submenus[submenuId] = {
        name: submenuName,
        type: "submenu",
        courses: {}
    };
    
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Submenu "${submenuName}" added to "${courses[menuId].name}" successfully!\nID: ${submenuId}`);
});

// Add Course
bot.onText(/\/addcourse (.+) (.+) (.+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const menuId = match[1].trim();
    const submenuId = match[2].trim();
    const courseId = match[3].trim();
    const courseData = match[4].split('|');
    
    if (courseData.length < 4) {
        return bot.sendMessage(msg.chat.id, '❌ Format: /addcourse menuId submenuId courseId courseName|price|groupLink|description');
    }
    
    const [courseName, price, groupLink, description] = courseData;
    
    if (!courses[menuId]?.submenus?.[submenuId]) {
        return bot.sendMessage(msg.chat.id, '❌ Menu or submenu not found!');
    }
    
    courses[menuId].submenus[submenuId].courses[courseId] = {
        name: courseName.trim(),
        type: "course",
        price: parseInt(price.trim()),
        groupLink: groupLink.trim(),
        paymentLink: "",
        imageLink: "",
        description: description.trim()
    };
    
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Course "${courseName}" added successfully!\nID: ${courseId}`);
});

// Edit Course
bot.onText(/\/editcourse (.+) (.+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const courseId = match[1].trim();
    const field = match[2].trim().toLowerCase();
    const value = match[3];
    
    const courseData = findCourse(courseId);
    if (!courseData) {
        return bot.sendMessage(msg.chat.id, '❌ Course not found!');
    }
    
    const { course, menuId, submenuId } = courseData;
    
    switch (field) {
        case 'name':
            course.name = value;
            break;
        case 'price':
            const newPrice = parseInt(value);
            if (isNaN(newPrice) || newPrice <= 0) {
                return bot.sendMessage(msg.chat.id, '❌ Invalid price!');
            }
            course.price = newPrice;
            break;
        case 'grouplink':
            if (!value.startsWith('https://t.me/')) {
                return bot.sendMessage(msg.chat.id, '❌ Invalid Telegram link!');
            }
            course.groupLink = value;
            break;
        case 'description':
            course.description = value;
            break;
        default:
            return bot.sendMessage(msg.chat.id, '❌ Invalid field! Use: name, price, grouplink, description');
    }
    
    courses[menuId].submenus[submenuId].courses[courseId] = course;
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Course "${course.name}" updated successfully!\nField: ${field}\nNew Value: ${value}`);
});

// Set Payment Link
bot.onText(/\/setpaymentlink (.+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const courseId = match[1].trim();
    const paymentLink = match[2].trim();
    
    const courseData = findCourse(courseId);
    if (!courseData) {
        return bot.sendMessage(msg.chat.id, '❌ Course not found!');
    }
    
    const { course, menuId, submenuId } = courseData;
    
    if (!paymentLink.startsWith('https://')) {
        return bot.sendMessage(msg.chat.id, '❌ Invalid payment link! Must start with https://');
    }
    
    course.paymentLink = paymentLink;
    courses[menuId].submenus[submenuId].courses[courseId] = course;
    await saveCourses(courses);
    
    bot.sendMessage(msg.chat.id, `✅ Payment link set for "${course.name}"!\n🔗 Link: ${paymentLink}`);
});

// Set Image
bot.onText(/\/setimage (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const courseId = match[1].trim();
    
    const courseData = findCourse(courseId);
    if (!courseData) {
        return bot.sendMessage(msg.chat.id, '❌ Course not found!');
    }
    
    if (!msg.reply_to_message || !msg.reply_to_message.photo) {
        return bot.sendMessage(msg.chat.id, '❌ Please reply to an image with this command!');
    }
    
    const photo = msg.reply_to_message.photo;
    const fileId = photo[photo.length - 1].file_id;
    
    const { course, menuId, submenuId } = courseData;
    course.imageLink = fileId;
    courses[menuId].submenus[submenuId].courses[courseId] = course;
    await saveCourses(courses);
    
    bot.sendMessage(msg.chat.id, `✅ Image set for "${course.name}" successfully!`);
});

// List All Structure
bot.onText(/\/listall/, async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    let structure = '📚 **Course Structure:**\n\n';
    
    Object.entries(courses).forEach(([menuId, menu]) => {
        structure += `🔸 **${menu.name}** (${menuId})\n`;
        
        if (menu.submenus) {
            Object.entries(menu.submenus).forEach(([submenuId, submenu]) => {
                structure += `   📂 **${submenu.name}** (${submenuId})\n`;
                
                if (submenu.courses) {
                    Object.entries(submenu.courses).forEach(([courseId, course]) => {
                        structure += `      📖 ${course.name} - ${course.price} TK (${courseId})\n`;
                    });
                }
            });
        }
        structure += '\n';
    });
    
    if (structure.length > 4000) {
        // Split into multiple messages
        const parts = structure.match(/[\s\S]{1,4000}/g);
        for (const part of parts) {
            await bot.sendMessage(msg.chat.id, part, {parse_mode: 'Markdown'});
        }
    } else {
        bot.sendMessage(msg.chat.id, structure, {parse_mode: 'Markdown'});
    }
});

// Update bKash number
bot.onText(/\/updatebkash (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const newNumber = match[1].trim();
    
    if (!/^01[3-9]\d{8}$/.test(newNumber)) {
        return bot.sendMessage(msg.chat.id, '❌ Invalid Bangladeshi phone number format! Example: 01712345678');
    }
    
    // Update the global variable (you might want to save this to environment or config file)
    bot.sendMessage(msg.chat.id, `✅ bKash number updated to: ${newNumber}\n⚠️ Note: Restart the bot to apply changes to environment variable.`);
});

// Update Nagad number  
bot.onText(/\/updatenagad (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const newNumber = match[1].trim();
    
    if (!/^01[3-9]\d{8}$/.test(newNumber)) {
        return bot.sendMessage(msg.chat.id, '❌ Invalid Bangladeshi phone number format! Example: 01712345678');
    }
    
    bot.sendMessage(msg.chat.id, `✅ Nagad number updated to: ${newNumber}\n⚠️ Note: Restart the bot to apply changes to environment variable.`);
});

// Add other admin commands (addadmin, removeadmin, etc.) from original code...
bot.onText(/\/addadmin (.+)/, (msg, match) => {
    if (!isPrimaryAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Only Primary Admin can add new admins!');
    }
    
    const newAdminId = match[1].trim();
    
    if (!/^\d+$/.test(newAdminId)) {
        return bot.sendMessage(msg.chat.id, '❌ Invalid User ID! Must be numbers only.');
    }
    
    if (adminUsers.has(newAdminId)) {
        return bot.sendMessage(msg.chat.id, '❌ User is already an admin!');
    }
    
    adminUsers.add(newAdminId);
    bot.sendMessage(msg.chat.id, `✅ New admin added successfully!\n👨‍💼 Admin ID: ${newAdminId}\n📊 Total Admins: ${adminUsers.size}`);
});

// Remove Admin
bot.onText(/\/removeadmin (.+)/, (msg, match) => {
    if (!isPrimaryAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Only Primary Admin can remove admins!');
    }
    
    const adminIdToRemove = match[1].trim();
    
    if (adminIdToRemove === ADMIN_ID) {
        return bot.sendMessage(msg.chat.id, '❌ Cannot remove Primary Admin!');
    }
    
    if (!adminUsers.has(adminIdToRemove)) {
        return bot.sendMessage(msg.chat.id, '❌ User is not an admin!');
    }
    
    adminUsers.delete(adminIdToRemove);
    bot.sendMessage(msg.chat.id, `✅ Admin removed successfully!\n👨‍💼 Removed Admin ID: ${adminIdToRemove}\n📊 Total Admins: ${adminUsers.size}`);
});

// List Admins
bot.onText(/\/listadmins/, (msg) => {
    if (!isPrimaryAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Only Primary Admin can view admin list!');
    }
    
    let adminList = `👨‍💼 **Admin List**\n\n`;
    adminList += `🔹 **Primary Admin:** ${ADMIN_ID}\n\n`;
    
    if (adminUsers.size > 1) {
        adminList += `👥 **Sub Admins:**\n`;
        adminUsers.forEach(adminId => {
            if (adminId !== ADMIN_ID) {
                adminList += `🔸 ${adminId}\n`;
            }
        });
    } else {
        adminList += `👥 **Sub Admins:** None`;
    }
    
    adminList += `\n📊 **Total Admins:** ${adminUsers.size}`;
    
    bot.sendMessage(msg.chat.id, adminList, {parse_mode: 'Markdown'});
});

// Delete Course
bot.onText(/\/deletecourse (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const courseId = match[1].trim();
    
    const courseData = findCourse(courseId);
    if (!courseData) {
        return bot.sendMessage(msg.chat.id, '❌ Course not found!');
    }
    
    const { course, menuId, submenuId } = courseData;
    delete courses[menuId].submenus[submenuId].courses[courseId];
    
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Course "${course.name}" deleted successfully!`);
});

// Delete Submenu
bot.onText(/\/deletesubmenu (.+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const menuId = match[1].trim();
    const submenuId = match[2].trim();
    
    if (!courses[menuId]?.submenus?.[submenuId]) {
        return bot.sendMessage(msg.chat.id, '❌ Menu or submenu not found!');
    }
    
    const submenuName = courses[menuId].submenus[submenuId].name;
    delete courses[menuId].submenus[submenuId];
    
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Submenu "${submenuName}" deleted successfully!`);
});

// Delete Menu
bot.onText(/\/deletemenu (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const menuId = match[1].trim();
    
    if (!courses[menuId]) {
        return bot.sendMessage(msg.chat.id, '❌ Menu not found!');
    }
    
    const menuName = courses[menuId].name;
    delete courses[menuId];
    
    await saveCourses(courses);
    bot.sendMessage(msg.chat.id, `✅ Menu "${menuName}" deleted successfully!`);
});

// Revenue Stats
bot.onText(/\/revenue/, async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    let totalRevenue = 0;
    let courseRevenue = new Map();
    
    users.forEach(userData => {
        userData.purchases.forEach(courseId => {
            const courseData = findCourse(courseId);
            if (courseData) {
                const course = courseData.course;
                totalRevenue += course.price;
                courseRevenue.set(courseId, (courseRevenue.get(courseId) || 0) + course.price);
            }
        });
    });
    
    let revenueText = `💰 **Revenue Details**\n\n`;
    revenueText += `💵 **Total Revenue:** ${totalRevenue} TK\n\n`;
    revenueText += `📊 **Course-wise Revenue:**\n`;
    
    if (courseRevenue.size === 0) {
        revenueText += `No sales yet.`;
    } else {
        courseRevenue.forEach((revenue, courseId) => {
            const courseData = findCourse(courseId);
            if (courseData) {
                const course = courseData.course;
                const salesCount = Math.floor(revenue / course.price);
                revenueText += `🔹 ${course.name}\n`;
                revenueText += `   Sales: ${salesCount} | Revenue: ${revenue} TK\n\n`;
            }
        });
    }
    
    bot.sendMessage(msg.chat.id, revenueText, {parse_mode: 'Markdown'});
});

// User Stats
bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    const totalUsers = users.size;
    let paidUsers = 0;
    let freeUsers = 0;
    
    users.forEach(userData => {
        if (userData.purchases.size > 0) {
            paidUsers++;
        } else {
            freeUsers++;
        }
    });
    
    const usersText = `👥 **User Statistics**
    
📊 **Total Users:** ${totalUsers}
💰 **Paid Users:** ${paidUsers}
🆓 **Free Users:** ${freeUsers}
📈 **Conversion Rate:** ${totalUsers > 0 ? ((paidUsers/totalUsers)*100).toFixed(1) : 0}%`;
    
    bot.sendMessage(msg.chat.id, usersText, {parse_mode: 'Markdown'});
});

// General Stats
bot.onText(/\/stats/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    const totalUsers = users.size;
    let totalPurchases = 0;
    let totalRevenue = 0;
    let totalCourses = 0;
    
    // Count courses and calculate stats
    Object.values(courses).forEach(menu => {
        if (menu.submenus) {
            Object.values(menu.submenus).forEach(submenu => {
                if (submenu.courses) {
                    totalCourses += Object.keys(submenu.courses).length;
                }
            });
        }
    });
    
    users.forEach(userData => {
        totalPurchases += userData.purchases.size;
        userData.purchases.forEach(courseId => {
            const courseData = findCourse(courseId);
            if (courseData) {
                totalRevenue += courseData.course.price;
            }
        });
    });
    
    const statsText = `📊 Bot Statistics

👥 Total Users: ${totalUsers}
💰 Total Purchases: ${totalPurchases}  
💵 Total Revenue: ${totalRevenue} TK
📚 Available Courses: ${totalCourses}
👨‍💼 Total Admins: ${adminUsers.size}`;

    bot.sendMessage(msg.chat.id, statsText);
});

// Transaction ID Management Commands
bot.onText(/\/checktrx (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const trxId = match[1];
    const isUsed = isTransactionUsed(trxId);

    bot.sendMessage(
        msg.chat.id,
        `ℹ️ **TRX ID Status:** ${isUsed ? "🟢 Already Used" : "🔴 Not Used"}\n\n` +
        `ID: \`${trxId}\``,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/addtrx (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const trxId = match[1];
    usedTransactions.add(trxId);
    await saveTransactions();

    bot.sendMessage(
        msg.chat.id,
        `✅ **TRX ID Added to Used List**\n\n` +
        `\`${trxId}\` এখন থেকে ব্যবহার করা যাবে না।`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/removetrx (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const trxId = match[1];
    usedTransactions.delete(trxId);
    await saveTransactions();

    bot.sendMessage(
        msg.chat.id,
        `♻️ **TRX ID Removed from Used List**\n\n` +
        `\`${trxId}\` আবার ব্যবহার করা যাবে।`,
        { parse_mode: 'Markdown' }
    );
});

// Callback Query Handler
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const userData = getUserData(userId);
    
    bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'main_menu') {
        const welcomeText = `🎓 HSC Courses Bot - Main Menu 🎓

আপনার পছন্দের course category সিলেক্ট করুন:`;
        
        try {
            bot.editMessageText(welcomeText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...mainMenuKeyboard
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, welcomeText, mainMenuKeyboard);
        }
    }
    else if (data.startsWith('menu_')) {
        const menuId = data.replace('menu_', '');
        const menu = courses[menuId];
        
        if (!menu) {
            return bot.sendMessage(msg.chat.id, '❌ Menu not found!');
        }
        
        const menuText = `${menu.name}

📚 Available Categories:`;
        
        try {
            bot.editMessageText(menuText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...getMenuKeyboard(menuId)
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, menuText, getMenuKeyboard(menuId));
        }
    }
    else if (data.startsWith('submenu_')) {
        const parts = data.replace('submenu_', '').split('_');
        const menuId = parts[0];
        const submenuId = parts[1];
        
        const submenu = courses[menuId]?.submenus?.[submenuId];
        if (!submenu) {
            return bot.sendMessage(msg.chat.id, '❌ Submenu not found!');
        }
        
        const submenuText = `${submenu.name}

📚 Available Courses:`;
        
        try {
            bot.editMessageText(submenuText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...getSubmenuKeyboard(menuId, submenuId, userId)
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, submenuText, getSubmenuKeyboard(menuId, submenuId, userId));
        }
    }
    else if (data.startsWith('course_')) {
        const courseId = data.replace('course_', '');
        const courseData = findCourse(courseId);
        
        if (!courseData) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const { course } = courseData;
        const isPurchased = userData.purchases.has(courseId);
        const isPending = userData.pendingCourse === courseId;
        
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
        if (course.imageLink && !isPending && !isPurchased) {
            try {
                await bot.sendPhoto(msg.chat.id, course.imageLink, {
                    caption: courseText,
                    reply_markup: getCourseKeyboard(courseId, userId, isPending).reply_markup
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
            bot.editMessageText(courseText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...getCourseKeyboard(courseId, userId, isPending)
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, courseText, getCourseKeyboard(courseId, userId, isPending));
        }
    }
    else if (data.startsWith('buy_')) {
        const courseId = data.replace('buy_', '');
        const courseData = findCourse(courseId);
        
        if (!courseData) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const { course } = courseData;
        userData.pendingCourse = courseId;
        await saveUsers();
        
        const paymentText = `💳 Payment for ${course.name}

💰 Amount: ${course.price} TK

💡 Payment Options:
1. bKash or Nagad এ payment করুন
2. Bkash থেকে payment করলে Transaction ID copy করুন, Nagad থেকে payment করলে payment এর screenshot নিন
3. "Submit Payment Proof" button এ click করুন`;

        try {
            bot.editMessageText(paymentText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...getCourseKeyboard(courseId, userId, true)
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, paymentText, getCourseKeyboard(courseId, userId, true));
        }
    }
    else if (data.startsWith('payment_method_')) {
        const courseId = data.replace('payment_method_', '');
        const courseData = findCourse(courseId);
        
        if (!courseData) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const { course } = courseData;
        const paymentText = `💳 Select Payment Method for ${course.name}\n\n💰 Amount: ${course.price} TK`;
        
        try {
            bot.editMessageText(paymentText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...getPaymentMethodKeyboard(courseId)
            });
        } catch (error) {
            console.error('Error editing message:', error);
            bot.sendMessage(msg.chat.id, paymentText, getPaymentMethodKeyboard(courseId));
        }
    }
    else if (data.startsWith('pay_bkash_')) {
        const courseId = data.replace('pay_bkash_', '');
        const courseData = findCourse(courseId);
        
        if (!courseData) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const { course } = courseData;
        userData.pendingPaymentMethod = 'bKash';
        await saveUsers();
        
        let paymentText = `💳 bKash Payment for ${course.name}\n\n💰 Amount: ${course.price} TK\n📱 bKash Number: ${BKASH_NUMBER}\n\n`;
        let keyboard;
        
        if (course.paymentLink) {
            paymentText += `💡 Payment Instructions:\n✅ Click "Pay with bKash Link" button below\n✅ Complete payment using the link\n✅ Copy the Transaction ID from bKash\n✅ Click "Submit Payment Proof" button\n✅ Enter only the Transaction ID (Example: 9BG4R2G5N8)\n\n🔹 bKash payment auto approve হবে!`;
            
            keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Pay with bKash Link', url: course.paymentLink }],
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
        const courseData = findCourse(courseId);
        
        if (!courseData) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const { course } = courseData;
        userData.pendingPaymentMethod = 'Nagad';
        await saveUsers();
        
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
        const courseData = findCourse(courseId);
        
        if (!courseData) {
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const { course } = courseData;
        const paymentMethod = userData.pendingPaymentMethod || 'bKash';
        
        const trxText = `📝 Submit Your Payment Proof\n\n💡 Instructions:\n${paymentMethod === 'bKash' ? '✅ Enter your bKash Transaction ID (Example: 9BG4R2G5N8)' : '✅ Send screenshot of your Nagad payment'}\n\n📱 ${course.name} এর জন্য payment verification\n💰 Amount: ${course.price} TK\n💳 Method: ${paymentMethod}`;
        
        bot.sendMessage(msg.chat.id, trxText, {
            reply_markup: {
                inline_keyboard: [[
                    { text: '❌ Cancel', callback_data: `course_${courseId}` }
                ]]
            }
        });
        
        userData.waitingForProof = {
            courseId,
            paymentMethod
        };
        await saveUsers();
    }
    else if (data.startsWith('approve_') || data.startsWith('reject_')) {
        if (!isAdmin(callbackQuery.from.id)) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ You are not authorized!', show_alert: true });
        }
        
        const parts = data.split('_');
        const action = parts[0];
        const userId = parts[1];
        const courseId = parts[2];
        
        const userData = getUserData(userId);
        const courseData = findCourse(courseId);
        
        if (!courseData) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!', show_alert: true });
        }
        
        const { course } = courseData;
        
        if (action === 'approve') {
            userData.purchases.add(courseId);
            userData.pendingCourse = null;
            userData.pendingPaymentMethod = null;
            await saveUsers();
            
            // Notify user
            bot.sendMessage(userId, `✅ **Your payment for ${course.name} has been approved!**\n\n🎯 Join your course group:\n👉 ${course.groupLink}`, {
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
            bot.sendMessage(userId, `❌ **Your payment proof for ${course.name} was rejected.**\n\n💡 Please submit valid payment proof or contact support.`, {
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
    const userData = getUserData(userId);
    
    if (userData.waitingForProof) {
        const { courseId, paymentMethod } = userData.waitingForProof;
        const courseData = findCourse(courseId);
        
        if (!courseData) {
            userData.waitingForProof = null;
            await saveUsers();
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }
        
        const { course } = courseData;
        userData.waitingForProof = null;
        await saveUsers();
        
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
            if (isTransactionUsed(trxId)) {
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
                    
                    // Save to channel and mark as used
                    await logTransaction(trxId, userId, course.price, course.name, paymentMethod);
                    
                    userData.purchases.add(courseId);
                    userData.pendingCourse = null;
                    userData.pendingPaymentMethod = null;
                    await saveUsers();
                    
                    const successText = `✅ **পেমেন্ট সফলভাবে ভেরিফাই হয়েছে!**\n\n` +
                                       `📱 ${course.name} Unlocked!\n` +
                                       `💰 Amount: ${course.price} TK\n` +
                                       `🎫 Transaction ID: ${trxId}\n\n` +
                                       `🎯 Join your course group:\n👉 Click the button below`;
                    
                    bot.sendMessage(msg.chat.id, successText, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: `🎯 Join ${course.name} Group`, url: course.groupLink }],
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
    res.send('HSC Courses Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize and start bot
initializeBot().then(() => {
    console.log('HSC Courses Bot started successfully!');
}).catch(error => {
    console.error('Error starting bot:', error);
});
