const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');

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

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

// User states for navigation
const userStates = new Map();

const COURSES_DATA = {
  "hsc27": {
    "name": "🔥HSC 2027 All Courses🔥",
    "type": "menu",
    "submenus": {
      "acs27_hm": {
        "name": "🎯 ACS 27 HM All Course",
        "type": "submenu",
        "courses": {
          "acs27_hm_cycle1": {
            "name": "🧮 ACS HM Cycle 1",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH1",
            "paymentLink": "https://shop.bkash.com/mamun-gazipur-printer019029126/pay/bdt100/ceGy7t",
            "imageLink": "https://cdn.jsdelivr.net/gh/PremiumSubscriptions/premium-subscriptions-bot@main/IMG_20250813_180937_978.jpg",
            "description": "🗒️শিক্ষক প্যানেল ❤️\n\n🔵অভিদত্ত তুশার \n🔵রকিবুল হাসান \n\n📥 ম্যাট্রিক্স ও নির্ণায়ক\n📥ভেক্টর \n📥বৃত্ত\n📥সরলরেখা\n\n\n🔥কোর্স এর সাথে পাবেন🔥\n\n☺️টপিক ভিক্তিক ক্লাস ( 1080p ) \n☺️প্রতি ক্লাস এর লেকচার শীট \n☺️বাড়ির কাজের পিডিএফ \n☺️প্রতি অধ্যায় শেষে প্র্যাকটিস শীট \n☺️মাঝে অধ্যায় ভিক্তিক ডাউট সলভ ক্লাস\n☺️আগের ব্যাচ এর ক্লাস ( আর্কাইভ ) \n☺️লাইফটাইম এক্সেস পাবে\n☺️আইডি ব্যান হলে নতুন আইডি এড হতে পারবে"
          },
          "acs27_hm_cycle2": {
            "name": "🧮 ACS HM Cycle 2",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "https://cdn.jsdelivr.net/gh/PremiumSubscriptions/premium-subscriptions-bot@main/IMG_20250813_180939_285.jpg",
            "description": "🗒️শিক্ষক প্যানেল ❤️\n\n🔵অভিদত্ত তুশার \n🔵রকিবুল হাসান \n\n✔️গনিত সাইকেল ০২ ✅১০০ টাকা \n\n📥 বিন্যাস ও সমাবেশ\n📥 ত্রিকোণমিতিক অনুপাত\n📥 সংযুক্ত কোণের ত্রিকোণমিতিক অনুপাত\n📥 ফাংশন ও ফাংশনের লেখচিত্র\n\n🔥কোর্স এর সাথে পাবেন🔥\n\n☺️টপিক ভিক্তিক ক্লাস ( 1080p ) \n☺️প্রতি ক্লাস এর লেকচার শীট \n☺️বাড়ির কাজের পিডিএফ \n☺️প্রতি অধ্যায় শেষে প্র্যাকটিস শীট \n☺️মাঝে অধ্যায় ভিক্তিক ডাউট সলভ ক্লাস\n☺️আগের ব্যাচ এর ক্লাস ( আর্কাইভ ) \n☺️লাইফটাইম এক্সেস পাবে\n☺️আইডি ব্যান হলে নতুন আইডি এড হতে পারবে"
          },
          "acs27_hm_cycle3": {
            "name": "🧮 ACS HM Cycle 3",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "https://cdn.jsdelivr.net/gh/PremiumSubscriptions/premium-subscriptions-bot@main/IMG_20250813_180940_617.jpg",
            "description": "🗒️শিক্ষক প্যানেল ❤️\n\n🔵অভিদত্ত তুশার \n🔵রকিবুল হাসান \n\n✔️গনিত সাইকেল ০৩ ✅১০০ টাকা \n\n📥 আন্তরিকরণ\n📥 যোগজীকরণ\n\n🔥কোর্স এর সাথে পাবেন🔥\n\n☺️টপিক ভিক্তিক ক্লাস ( 1080p ) \n☺️প্রতি ক্লাস এর লেকচার শীট \n☺️বাড়ির কাজের পিডিএফ \n☺️প্রতি অধ্যায় শেষে প্র্যাকটিস শীট \n☺️মাঝে অধ্যায় ভিক্তিক ডাউট সলভ ক্লাস\n☺️আগের ব্যাচ এর ক্লাস ( আর্কাইভ ) \n☺️লাইফটাইম এক্সেস পাবে\n☺️আইডি ব্যান হলে নতুন আইডি এড হতে পারবে"
          },
          "acs27_hm_cycle4": {
            "name": "🧮 ACS HM Cycle 4",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "https://cdn.jsdelivr.net/gh/PremiumSubscriptions/premium-subscriptions-bot@main/IMG_20250813_180942_956.jpg",
            "description": "🗒️শিক্ষক প্যানেল ❤️\n\n🔵অভিদত্ত তুশার \n🔵রকিবুল হাসান \n\n✔️গনিত সাইকেল ০৪ ✅১০০ টাকা \n\n📥 বাস্তব সংখ্যা ও সমতা\n📥 যোগাশ্রয়ী প্রোগ্রাম\n📥 জটিল সংখ্যা\n📥 বহুপদী ও বহুপদী সমীকরণ\n\n🔥কোর্স এর সাথে পাবেন🔥\n\n☺️টপিক ভিক্তিক ক্লাস ( 1080p ) \n☺️প্রতি ক্লাস এর লেকচার শীট \n☺️বাড়ির কাজের পিডিএফ \n☺️প্রতি অধ্যায় শেষে প্র্যাকটিস শীট \n☺️মাঝে অধ্যায় ভিক্তিক ডাউট সলভ ক্লাস\n☺️আগের ব্যাচ এর ক্লাস ( আর্কাইভ ) \n☺️লাইফটাইম এক্সেস পাবে\n☺️আইডি ব্যান হলে নতুন আইডি এড হতে পারবে"
          },
          "acs27_hm_cycle5": {
            "name": "🧮 ACS HM Cycle 5",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "https://cdn.jsdelivr.net/gh/PremiumSubscriptions/premium-subscriptions-bot@main/IMG_20250813_180945_218.jpg",
            "description": "🗒️শিক্ষক প্যানেল ❤️\n\n🔵অভিদত্ত তুশার \n🔵রকিবুল হাসান \n\n✔️গনিত সাইকেল ০৫ ✅১০০ টাকা \n\n📥 দ্বিপদী বিস্তৃতি\n📥 কনিক\n📥 বিপরীত ত্রিকোণমিতি\n\n🔥কোর্স এর সাথে পাবেন🔥\n\n☺️টপিক ভিক্তিক ক্লাস ( 1080p ) \n☺️প্রতি ক্লাস এর লেকচার শীট \n☺️বাড়ির কাজের পিডিএফ \n☺️প্রতি অধ্যায় শেষে প্র্যাকটিস শীট \n☺️মাঝে অধ্যায় ভিক্তিক ডাউট সলভ ক্লাস\n☺️আগের ব্যাচ এর ক্লাস ( আর্কাইভ ) \n☺️লাইফটাইম এক্সেস পাবে\n☺️আইডি ব্যান হলে নতুন আইডি এড হতে পারবে"
          },
          "acs27_hm_cycle6": {
            "name": "🧮 ACS HM Cycle 6",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "https://cdn.jsdelivr.net/gh/PremiumSubscriptions/premium-subscriptions-bot@main/IMG_20250813_180943_442.jpg",
            "description": "🗒️শিক্ষক প্যানেল ❤️\n\n🔵অভিদত্ত তুশার \n🔵রকিবুল হাসান \n\n✔️গনিত সাইকেল ০৬ ✅১০০ টাকা \n\n📥 স্থিতিবিদ্যা\n📥 সমতলে বস্তুকণার গতি\n📥সম্ভবনা\n\n🔥কোর্স এর সাথে পাবেন🔥\n\n☺️টপিক ভিক্তিক ক্লাস ( 1080p ) \n☺️প্রতি ক্লাস এর লেকচার শীট \n☺️বাড়ির কাজের পিডিএফ \n☺️প্রতি অধ্যায় শেষে প্র্যাকটিস শীট \n☺️মাঝে অধ্যায় ভিক্তিক ডাউট সলভ ক্লাস\n☺️আগের ব্যাচ এর ক্লাস ( আর্কাইভ ) \n☺️লাইফটাইম এক্সেস পাবে\n☺️আইডি ব্যান হলে নতুন আইডি এড হতে পারবে"
          },
          "acs27_hm_all": {
            "name": "🧮 ACS HM ALL Cycle Combo",
            "type": "course",
            "price": 450,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "https://cdn.jsdelivr.net/gh/PremiumSubscriptions/premium-subscriptions-bot@main/IMG_20250813_180946_639.jpg",
            "description": "🗒️শিক্ষক প্যানেল ❤️\n\n🔵অভিদত্ত তুশার \n🔵রকিবুল হাসান \n\n✔️গনিত সাইকেল ০১ ✅১০০ টাকা \n\n📥 ম্যাট্রিক্স ও নির্ণায়ক\n📥ভেক্টর \n📥বৃত্ত\n📥সরলরেখা\n\n✔️গনিত সাইকেল ০২ ✅১০০ টাকা \n\n📥 বিন্যাস ও সমাবেশ\n📥 ত্রিকোণমিতিক অনুপাত\n📥 সংযুক্ত কোণের ত্রিকোণমিতিক অনুপাত\n📥 ফাংশন ও ফাংশনের লেখচিত্র\n\n✔️গনিত সাইকেল ০৩ ✅১০০ টাকা \n\n📥 আন্তরিকরণ\n📥 যোগজীকরণ\n\n✔️গনিত সাইকেল ০৪ ✅১০০ টাকা \n\n📥 বাস্তব সংখ্যা ও সমতা\n📥 যোগাশ্রয়ী প্রোগ্রাম\n📥 জটিল সংখ্যা\n📥 বহুপদী ও বহুপদী সমীকরণ\n\n✔️গনিত সাইকেল ০৫ ✅১০০ টাকা \n\n📥 দ্বিপদী বিস্তৃতি\n📥 কনিক\n📥 বিপরীত ত্রিকোণমিতি\n\n✔️গনিত সাইকেল ০৬ ✅১০০ টাকা \n\n📥 স্থিতিবিদ্যা\n📥 সমতলে বস্তুকণার গতি\n📥সম্ভবনা\n\n\n🔥কোর্স এর সাথে পাবেন🔥\n\n☺️টপিক ভিক্তিক ক্লাস ( 1080p ) \n☺️প্রতি ক্লাস এর লেকচার শীট \n☺️বাড়ির কাজের পিডিএফ \n☺️প্রতি অধ্যায় শেষে প্র্যাকটিস শীট \n☺️মাঝে অধ্যায় ভিক্তিক ডাউট সলভ ক্লাস\n☺️আগের ব্যাচ এর ক্লাস ( আর্কাইভ ) \n☺️লাইফটাইম এক্সেস পাবে\n☺️আইডি ব্যান হলে নতুন আইডি এড হতে পারবে"
          }
        }
      }
    }
  }
};

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
                        NULL;  -- Column exists, ignore
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

function getCourses(menuId, submenuId) {
    const menu = COURSES_DATA[menuId];
    if (!menu || !menu.submenus || !menu.submenus[submenuId]) return [];
    
    const submenu = menu.submenus[submenuId];
    if (!submenu.courses) return [];
    
    return Object.entries(submenu.courses).map(([courseId, course]) => ({
        course_id: courseId,
        menu_id: menuId,
        submenu_id: submenuId,
        name: course.name,
        type: course.type,
        price: course.price,
        group_link: course.groupLink,
        payment_link: course.paymentLink,
        image_link: course.imageLink,
        description: course.description
    }));
}

function findCourseById(courseId) {
    for (const [menuId, menu] of Object.entries(COURSES_DATA)) {
        if (menu.submenus) {
            for (const [submenuId, submenu] of Object.entries(menu.submenus)) {
                if (submenu.courses && submenu.courses[courseId]) {
                    const course = submenu.courses[courseId];
                    return {
                        course_id: courseId,
                        menu_id: menuId,
                        submenu_id: submenuId,
                        name: course.name,
                        type: course.type,
                        price: course.price,
                        group_link: course.groupLink,
                        payment_link: course.paymentLink,
                        image_link: course.imageLink,
                        description: course.description
                    };
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
                ['📝 Submit Payment Proof'],
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

// Bot command handlers
bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    userStates.delete(userId);
    
    const mainKeyboard = getMainMenuKeyboard();
    const welcomeText = `🎓 Welcome to Premium Subscription Bot! 🎓

আমাদের premium courses গুলো দেখুন এবং আপনার পছন্দের course কিনুন।

💎 High Quality Content
📚 Expert Teachers  
🎯 Guaranteed Results
💯 24/7 Support`;

    bot.sendMessage(msg.chat.id, welcomeText, mainKeyboard);
});

bot.onText(/\/admin/, async (msg) => {
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

    bot.sendMessage(msg.chat.id, adminText, { parse_mode: 'Markdown' });
});

// Admin commands
bot.onText(/\/checktrx (.+)/, async (msg, match) => {
    if (!(await isAdmin(msg.from.id))) return;
    
    const trxId = match[1];
    const isUsed = await isTransactionUsed(trxId);
    
    bot.sendMessage(msg.chat.id, 
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
            'INSERT INTO transactions (transaction_id, user_id, course_id, amount, payment_method, payment_date) VALUES ($1, $2, $3, $4, $5, $6)',
            [trxId, 'admin_added', 'manual', 0, 'manual', new Date().toISOString().split('T')[0]]
        );
        
        bot.sendMessage(msg.chat.id,
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
    try {
        const result = await pool.query('DELETE FROM transactions WHERE transaction_id = $1', [trxId]);
        
        if (result.rowCount > 0) {
            bot.sendMessage(msg.chat.id,
                `♻️ **TRX ID Removed from Used List**\n\n` +
                `\`${trxId}\` আবার ব্যবহার করা যাবে।`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(msg.chat.id, '❌ Transaction not found!');
        }
    } catch (error) {
        console.error('Error removing transaction:', error);
        bot.sendMessage(msg.chat.id, '❌ Error removing transaction!');
    }
});

bot.onText(/\/addadmin (.+)/, async (msg, match) => {
    if (!isPrimaryAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Only primary admin can add new admins!');
    }
    
    const adminId = match[1];
    try {
        await pool.query('INSERT INTO admins (admin_id, added_by) VALUES ($1, $2)', [adminId, msg.from.id]);
        bot.sendMessage(msg.chat.id, `✅ Admin ${adminId} added successfully!`);
    } catch (error) {
        if (error.code === '23505') {
            bot.sendMessage(msg.chat.id, `❌ Admin ${adminId} already exists!`);
        } else {
            console.error('Error adding admin:', error);
            bot.sendMessage(msg.chat.id, '❌ Error adding admin!');
        }
    }
});

bot.onText(/\/removeadmin (.+)/, async (msg, match) => {
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
            bot.sendMessage(msg.chat.id, `✅ Admin ${adminId} removed successfully!`);
        } else {
            bot.sendMessage(msg.chat.id, '❌ Admin not found or is primary admin!');
        }
    } catch (error) {
        console.error('Error removing admin:', error);
        bot.sendMessage(msg.chat.id, '❌ Error removing admin!');
    }
});

bot.onText(/\/listadmins/, async (msg) => {
    if (!isPrimaryAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Only primary admin can view admin list!');
    }
    
    try {
        const result = await pool.query('SELECT admin_id, is_primary FROM admins ORDER BY is_primary DESC, created_at');
        let adminList = '👥 **Admin List:**\n\n';
        
        result.rows.forEach((admin, index) => {
            adminList += `${index + 1}. \`${admin.admin_id}\` ${admin.is_primary ? '(Primary)' : '(Sub Admin)'}\n`;
        });
        
        bot.sendMessage(msg.chat.id, adminList, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error listing admins:', error);
        bot.sendMessage(msg.chat.id, '❌ Error fetching admin list!');
    }
});

// Message handler for reply keyboard navigation
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const userId = msg.from.id;
    const messageText = msg.text;
    const userData = await getUserData(userId);
    
    // Handle payment proof submission
    if (userData.waiting_for_proof) {
        const proofData = JSON.parse(userData.waiting_for_proof);
        const { courseId, paymentMethod } = proofData;
        const course = findCourseById(courseId);
        
        if (!course) {
            await updateUserData(userId, { waiting_for_proof: null });
            return bot.sendMessage(msg.chat.id, '❌ Course not found!');
        }

        await updateUserData(userId, { waiting_for_proof: null });

        // Handle Nagad screenshot
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

                bot.sendMessage(msg.chat.id, 
                    `✅ Payment proof received for ${course.name}!\n\nAdmin will verify your payment shortly.`,
                    {
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '💬 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` }
                            ]]
                        }
                    }
                );
            } catch (error) {
                console.error('Error sending proof to admin:', error);
                bot.sendMessage(msg.chat.id, '⚠️ Error submitting payment proof. Please try again or contact support.');
            }
        }
        // Handle bKash transaction ID
        else if (msg.text && paymentMethod === 'bKash') {
            const trxId = msg.text.trim();
            bot.sendMessage(msg.chat.id, '⏳ Verifying payment time validity...');

            try {
                const verificationResult = await verifyPaymentWithDateCheck(trxId);
                
                if (!verificationResult.success) {
                    return bot.sendMessage(msg.chat.id, 
                        `❌ **${verificationResult.error}**`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '🔄 Try Another TRX ID', callback_data: `submit_proof_${courseId}` }
                                ], [
                                    { text: '💳 Make New Payment', callback_data: `payment_method_${courseId}` }
                                ], [
                                    { text: '💬 Contact Support', url: 'https://t.me/yoursupport' }
                                ]]
                            }
                        }
                    );
                }

                if (await isTransactionUsed(trxId)) {
                    return bot.sendMessage(msg.chat.id,
                        "❌ **এই Transaction ID আগেই ব্যবহার করা হয়েছে!**\n\n" +
                        "দয়া করে নতুন একটি Transaction ID দিন অথবা সাপোর্টে যোগাযোগ করুন।",
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }
                                ], [
                                    { text: '💬 Contact Support', url: 'https://t.me/yoursupport' }
                                ]]
                            }
                        }
                    );
                }

                if (verificationResult.data.transactionStatus !== 'Completed' || 
                    parseInt(verificationResult.data.amount) < course.price) {
                    return bot.sendMessage(msg.chat.id,
                        `❌ **Payment Verification Failed!**\n\n` +
                        `🔍 Possible reasons:\n` +
                        `• Payment status not completed\n` +
                        `• Insufficient amount (Paid: ${verificationResult.data.amount} TK, Required: ${course.price} TK)\n\n` +
                        `Transaction ID: ${trxId}`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }
                                ], [
                                    { text: '💬 Contact Support', url: 'https://t.me/yoursupport' }
                                ]]
                            }
                        }
                    );
                }

                const added = await addTransaction(trxId, userId, courseId, course.price, paymentMethod, verificationResult.paymentDate);
                if (!added) {
                    return bot.sendMessage(msg.chat.id,
                        "❌ **Transaction processing error!**\n\n" +
                        "Please contact support immediately.",
                        { parse_mode: 'Markdown' }
                    );
                }

                await logTransaction(trxId, userId, course.price, course.name, paymentMethod, verificationResult.paymentDate);
                await addUserPurchase(userId, courseId, course.menu_id, course.submenu_id, trxId, paymentMethod, course.price, verificationResult.paymentDate);
                await updateUserData(userId, { 
                    pending_course: null, 
                    pending_payment_method: null 
                });

                const validityEndTime = new Date(verificationResult.paymentTime.getTime() + 24 * 60 * 60 * 1000);
                const options = {
                    timeZone: 'Asia/Dhaka',
                    hour12: true,
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                };
                const validityEndStr = validityEndTime.toLocaleString('en-BD', options);

                const successText = `✅ **পেমেন্ট সফলভাবে ভেরিফাই হয়েছে!**\n\n` +
                    `📱 ${course.name} Unlocked!\n` +
                    `💰 Amount: ${course.price} TK\n` +
                    `🎫 Transaction ID: ${trxId}\n` +
                    `⏰ Valid Until: ${validityEndStr}\n\n` +
                    `🎯 Join your course group:\n👉 Click the button below`;

                bot.sendMessage(msg.chat.id, successText, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: `🎯 Join ${course.name} Group`, url: course.group_link }
                        ], [
                            { text: '🏠 Main Menu', callback_data: 'main_menu' }
                        ]]
                    }
                });

                // Reset user state and show main menu
                userStates.delete(userId);
                const mainKeyboard = getMainMenuKeyboard();
                bot.sendMessage(msg.chat.id, "🎓 Main Menu", mainKeyboard);

            } catch (error) {
                console.error('Payment verification error:', error);
                bot.sendMessage(msg.chat.id,
                    `⚠️ **Verification Error!**\n\nSomething went wrong. Please contact support.\n\nTransaction ID: ${trxId}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '💬 Contact Support', url: 'https://t.me/yoursupport' }
                            ], [
                                { text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }
                            ], [
                                { text: '🏠 Main Menu', callback_data: 'main_menu' }
                            ]]
                        }
                    }
                );
            }
        } else {
            bot.sendMessage(msg.chat.id, '❌ Invalid payment proof format!');
        }
        return;
    }

    // Handle navigation based on message text
    const userState = userStates.get(userId) || {};
    
    // Main menu navigation
    if (messageText === '🏠 Main Menu') {
        userStates.delete(userId);
        const mainKeyboard = getMainMenuKeyboard();
        const welcomeText = `🎓 Premium Subscription Bot - Main Menu 🎓

আপনার পছন্দের course category সিলেক্ট করুন:`;
        
        bot.sendMessage(msg.chat.id, welcomeText, mainKeyboard);
        return;
    }
    
    // Support buttons
    if (messageText === '🔥 Support 🔥') {
        bot.sendMessage(msg.chat.id, '💬 Contact our support team:', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '💬 Support', url: 'https://t.me/Mehedi_X71' }
                ]]
            }
        });
        return;
    }
    
    if (messageText === '🔥 Our Channel ❤️') {
        bot.sendMessage(msg.chat.id, '📢 Join our channel for updates:', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '📢 Our Channel', url: 'https://t.me/premium_subscriptionss' }
                ]]
            }
        });
        return;
    }
    
    // Cancel button
    if (messageText === '❌ Cancel') {
        await updateUserData(userId, { 
            pending_course: null,
            pending_payment_method: null,
            waiting_for_proof: null
        });
        
        userStates.delete(userId);
        const mainKeyboard = getMainMenuKeyboard();
        bot.sendMessage(msg.chat.id, '🚫 Operation canceled. Returning to main menu.', mainKeyboard);
        return;
    }
    
    // Back button
    if (messageText === '⬅️ Back') {
        if (userState.state === 'submenu') {
            // Go back to menu
            userStates.set(userId, { state: 'menu', menuId: userState.menuId });
            const menuKeyboard = getMenuKeyboard(userState.menuId);
            const menus = getMenus();
            const menu = menus.find(m => m.menu_id === userState.menuId);
            
            bot.sendMessage(msg.chat.id, `${menu.name}\n\n📚 Available Categories:`, menuKeyboard);
        } else if (userState.state === 'course') {
            // Go back to submenu
            userStates.set(userId, { 
                state: 'submenu', 
                menuId: userState.menuId, 
                submenuId: userState.submenuId 
            });
            const submenuKeyboard = await getSubmenuKeyboard(userState.menuId, userState.submenuId, userId);
            const submenus = getSubmenus(userState.menuId);
            const submenu = submenus.find(s => s.submenu_id === userState.submenuId);
            
            bot.sendMessage(msg.chat.id, `${submenu.name}\n\n📚 Available Courses:`, submenuKeyboard);
        } else if (userState.state === 'payment_method') {
            // Go back to course
            const course = findCourseById(userState.courseId);
            if (course) {
                userStates.set(userId, { 
                    state: 'course', 
                    menuId: course.menu_id, 
                    submenuId: course.submenu_id,
                    courseId: userState.courseId 
                });
                const courseKeyboard = await getCourseKeyboard(userState.courseId, userId);
                
                let courseText = `${course.name}\n\n`;
                courseText += course.description + '\n\n';
                courseText += `💰 Price: ${course.price} TK`;
                
                if (course.image_link) {
                    try {
                        await bot.sendPhoto(msg.chat.id, course.image_link, {
                            caption: courseText,
                            ...courseKeyboard
                        });
                    } catch (error) {
                        bot.sendMessage(msg.chat.id, courseText, courseKeyboard);
                    }
                } else {
                    bot.sendMessage(msg.chat.id, courseText, courseKeyboard);
                }
            }
        } else {
            // Default back to main menu
            userStates.delete(userId);
            const mainKeyboard = getMainMenuKeyboard();
            bot.sendMessage(msg.chat.id, '🎓 Main Menu', mainKeyboard);
        }
        return;
    }
    
    // Check for menu selection
    const menus = getMenus();
    const selectedMenu = menus.find(menu => menu.name === messageText);
    if (selectedMenu) {
        userStates.set(userId, { state: 'menu', menuId: selectedMenu.menu_id });
        const menuKeyboard = getMenuKeyboard(selectedMenu.menu_id);
        const menuText = `${selectedMenu.name}\n\n📚 Available Categories:`;
        
        bot.sendMessage(msg.chat.id, menuText, menuKeyboard);
        return;
    }
    
    // Check for submenu selection
    if (userState.state === 'menu') {
        const submenus = getSubmenus(userState.menuId);
        const selectedSubmenu = submenus.find(submenu => submenu.name === messageText);
        
        if (selectedSubmenu) {
            userStates.set(userId, { 
                state: 'submenu', 
                menuId: userState.menuId, 
                submenuId: selectedSubmenu.submenu_id 
            });
            const submenuKeyboard = await getSubmenuKeyboard(userState.menuId, selectedSubmenu.submenu_id, userId);
            const submenuText = `${selectedSubmenu.name}\n\n📚 Available Courses:`;
            
            bot.sendMessage(msg.chat.id, submenuText, submenuKeyboard);
            return;
        }
    }
    
    // Check for course selection
    if (userState.state === 'submenu') {
        const courses = getCourses(userState.menuId, userState.submenuId);
        const selectedCourse = courses.find(course => 
            messageText === `${course.name} - ${course.price} TK`
        );
        
        if (selectedCourse) {
            userStates.set(userId, { 
                state: 'course', 
                menuId: userState.menuId, 
                submenuId: userState.submenuId,
                courseId: selectedCourse.course_id 
            });
            
            const courseKeyboard = await getCourseKeyboard(selectedCourse.course_id, userId);
            
            let courseText = `${selectedCourse.name}\n\n`;
            courseText += selectedCourse.description + '\n\n';
            courseText += `💰 Price: ${selectedCourse.price} TK`;
            
            if (selectedCourse.image_link) {
                try {
                    await bot.sendPhoto(msg.chat.id, selectedCourse.image_link, {
                        caption: courseText,
                        ...courseKeyboard
                    });
                } catch (error) {
                    console.error('Error sending course image:', error);
                    bot.sendMessage(msg.chat.id, courseText, courseKeyboard);
                }
            } else {
                bot.sendMessage(msg.chat.id, courseText, courseKeyboard);
            }
            return;
        }
    }
    
    // Handle course actions
    if (userState.state === 'course') {
        const course = findCourseById(userState.courseId);

        if (messageText === '💳 Buy Now') {
            await updateUserData(userId, { pending_course: userState.courseId });
            userStates.set(userId, { ...userState, state: 'payment_method' });

            const paymentText = `💳 Select Payment Method for ${course.name}\n\n💰 Amount: ${course.price} TK`;
            const paymentMethodKeyboard = getPaymentMethodKeyboard();

            bot.sendMessage(msg.chat.id, paymentText, paymentMethodKeyboard);
        } 
        else if (messageText === '🎯 Join Course Group') {
            // Ensure purchases exists and supports has/includes
            const hasCourse = Array.isArray(userData.purchases)
                ? userData.purchases.includes(userState.courseId)
                : userData.purchases?.has?.(userState.courseId);

            if (hasCourse) { 
                bot.sendMessage(msg.chat.id, `🎯 Join your course group:`, {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: `Join ${course.name} Group`, url: course.group_link }
                        ]]
                    }
                });
            }
        }
    }
    
    // Handle payment method selection
    if (userState.state === 'payment_method') {
        const course = findCourseById(userData.pending_course);
        
        if (messageText === 'bKash') {
            await updateUserData(userId, { pending_payment_method: 'bKash' });
            userStates.set(userId, { ...userState, state: 'bkash_payment' });
            
            const hasPaymentLink = course && course.payment_link;
            bot.sendMessage(msg.chat.id, `💳 bKash Payment for ${course.name}\n\nAmount: ${course.price} TK`, getBkashPaymentKeyboard(hasPaymentLink));
        } 
        else if (messageText === 'Nagad') {
            await updateUserData(userId, { pending_payment_method: 'Nagad' });
            userStates.set(userId, { ...userState, state: 'nagad_payment' });
            
            bot.sendMessage(msg.chat.id, `💳 Nagad Payment for ${course.name}\n\nAmount: ${course.price} TK\n\nSend money to: ${NAGAD_NUMBER}`, getNagadPaymentKeyboard());
        }
    }
    
    // Handle bKash payment options
    if (userState.state === 'bkash_payment') {
        const course = findCourseById(userData.pending_course);
        
        if (messageText === '💳 Use bKash Link') {
            if (course && course.payment_link) {
                bot.sendMessage(msg.chat.id, `💳 Pay with bKash:\n\n${course.payment_link}\n\nAfter payment, please send the Transaction ID (TRX ID) here.`, getCancelKeyboard());
                await updateUserData(userId, { 
                    waiting_for_proof: JSON.stringify({ 
                        courseId: userData.pending_course, 
                        paymentMethod: 'bKash' 
                    }) 
                });
            } else {
                bot.sendMessage(msg.chat.id, '❌ Payment link not available for this course. Please use "📝 Submit Payment Proof" instead.', getBkashPaymentKeyboard(false));
            }
        } 
        else if (messageText === '📝 Submit Payment Proof') {
            bot.sendMessage(msg.chat.id, '🔢 Please send the bKash Transaction ID (TRX ID):', getCancelKeyboard());
            await updateUserData(userId, { 
                waiting_for_proof: JSON.stringify({ 
                    courseId: userData.pending_course, 
                    paymentMethod: 'bKash' 
                }) 
            });
        }
    }
    
    // Handle Nagad payment options
    if (userState.state === 'nagad_payment') {
        if (messageText === '📝 Submit Payment Proof') {
            bot.sendMessage(msg.chat.id, '📸 Please send the Nagad payment screenshot:', getCancelKeyboard());
            await updateUserData(userId, { 
                waiting_for_proof: JSON.stringify({ 
                    courseId: userData.pending_course, 
                    paymentMethod: 'Nagad' 
                }) 
            });
        } 
        else if (messageText === '💬 Contact Admin') {
            bot.sendMessage(msg.chat.id, `Contact admin for Nagad payment: @${ADMIN_USERNAME}`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '💬 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` }
                    ]]
                }
            });
        }
    }
});

// Callback query handler for admin actions
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    
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
            // Generate unique transaction ID for manual approval
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
            
            // Send success message to user
            bot.sendMessage(targetUserId, 
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
            
            // Update admin message
            bot.editMessageText(`✅ Payment approved for user: ${targetUserId}`, {
                chat_id: msg.chat.id,
                message_id: msg.message_id
            });
            
            bot.answerCallbackQuery(callbackQuery.id, { text: 'Payment approved!' });
        } catch (error) {
            console.error('Error approving payment:', error);
            bot.answerCallbackQuery(callbackQuery.id, { text: 'Error approving payment!' });
        }
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
        
        // Update admin message
        bot.editMessageText(`❌ Payment rejected for user: ${targetUserId}`, {
            chat_id: msg.chat.id,
            message_id: msg.message_id
        });
        
        // Send rejection message to user
        bot.sendMessage(targetUserId, 
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
        
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Payment rejected!' });
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

// Initialize and start bot
initializeDatabase()
    .then(() => {
        console.log('Premium Subscription Bot started successfully with PostgreSQL!');
        console.log('Features enabled:');
        console.log('- Hardcoded courses with auto-update on deployment');
        console.log('- Enhanced bKash verification with time checking');
        console.log('- Payment date validation (next 24 hours from payment time)');
        console.log('- Duplicate transaction prevention');
        console.log('- PostgreSQL database: premium-subscription-bot-db');
    })
    .catch(error => {
        console.error('Error starting bot:', error);
    });
