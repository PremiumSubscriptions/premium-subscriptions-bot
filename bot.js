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

// Hardcoded Courses Data (Auto-updates when bot.js is deployed)
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
            "imageLink": "",
            "description": "📖 Complete ACS Higher Math Cycle 1 Course\n\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support\n✅ Lifetime Access\n\n🎯 Perfect for HSC 2027 students!"
          },
          "acs27_hm_cycle2": {
            "name": "🧮 ACS HM Cycle 2",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete ACS Higher Math Cycle 2 Course\n\n✅ Advanced Topics Coverage\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support\n✅ Lifetime Access"
          },
          "acs27_hm_cycle3": {
            "name": "🧮 ACS HM Cycle 3",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete ACS Higher Math Cycle 3 Course\n\n✅ Advanced Topics Coverage\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support\n✅ Lifetime Access"
          },
          "acs27_hm_cycle4": {
            "name": "🧮 ACS HM Cycle 4",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete ACS Higher Math Cycle 4 Course\n\n✅ Advanced Topics Coverage\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support\n✅ Lifetime Access"
          },
          "acs27_hm_cycle5": {
            "name": "🧮 ACS HM Cycle 5",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete ACS Higher Math Cycle 5 Course\n\n✅ Advanced Topics Coverage\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support\n✅ Lifetime Access"
          },
          "acs27_hm_cycle6": {
            "name": "🧮 ACS HM Cycle 6",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete ACS Higher Math Cycle 6 Course\n\n✅ Advanced Topics Coverage\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support\n✅ Lifetime Access"
          },
          "acs27_hm_all": {
            "name": "🧮 ACS HM ALL Cycle Combo",
            "type": "course",
            "price": 450,
            "groupLink": "https://t.me/+HSC2027ACSMATH2",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete ACS Higher Math ALL Cycle Course\n\n✅ Advanced Topics Coverage\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support\n✅ Lifetime Access"
          }
        }
      },
      "acs27_physics": {
        "name": "⚛️ ACS 27 Physics All Course",
        "type": "submenu",
        "courses": {
          "acs27_phy_cycle1": {
            "name": "⚛️ ACS Physics Cycle 1",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_phy_cycle2": {
            "name": "⚛️ ACS Physics Cycle 2",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_phy_cycle3": {
            "name": "⚛️ ACS Physics Cycle 3",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_phy_cycle4": {
            "name": "⚛️ ACS Physics Cycle 4",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_phy_cycle5": {
            "name": "⚛️ ACS Physics Cycle 5",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_phy_cycle6": {
            "name": "⚛️ ACS Physics Cycle 6",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_phy_all": {
            "name": "⚛️ ACS Physics ALL Cycle",
            "type": "course",
            "price": 450,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          }
        }
      },
      "acs27_aloron_chemistry": {
        "name": "⚛️ ACS 27 Aloron Chemistry All Course",
        "type": "submenu",
        "courses": {
          "acs27_alo_chem_cycle1": {
            "name": "⚛️ ACS Aloron Chemistry Cycle 1",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_alo_chem_cycle2": {
            "name": "⚛️ ACS Aloron Chemistry Cycle 2",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_alo_chem_cycle3": {
            "name": "⚛️ ACS Aloron Chemistry Cycle 3",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_alo_chem_cycle4": {
            "name": "⚛️ ACS Aloron Chemistry Cycle 4",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_alo_chem_cycle5": {
            "name": "⚛️ ACS Aloron Chemistry Cycle 5",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_alo_chem_all": {
            "name": "⚛️ ACS Aloron Chemistry ALL Cycle",
            "type": "course",
            "price": 350,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          }
        }
      },
      "acs27_chemshifu_chemistry": {
        "name": "⚛️ ACS 27 CHEMSHIFU CHEMISTY ALL Course",
        "type": "submenu",
        "courses": {
          "acs27_chemshifu_chem_cycle1": {
            "name": "⚛️ ACS Chemshifu Chemistry Cycle 1",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_chemshifu_chem_cycle2": {
            "name": "⚛️ ACS Chemshifu Chemistry Cycle 2",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_chemshifu_chem_cycle3": {
            "name": "⚛️ ACS Chemshifu Chemistry Cycle 3",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_chemshifu_chem_cycle4": {
            "name": "⚛️ ACS Chemshifu Chemistry Cycle 4",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_chemshifu_chem_cycle5": {
            "name": "⚛️ ACS Chemshifu Chemistry Cycle 5",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_chemshifu_chem_all": {
            "name": "⚛️ ACS Chemshifu Chemistry ALL Cycle Combo",
            "type": "course",
            "price": 350,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          }
        }
      },
      "acs27_hemel_chemistry": {
        "name": "⚛️ ACS 27 Hemel Bhai Chemistry All Course",
        "type": "submenu",
        "courses": {
          "acs27_hemel_chem_cycle1": {
            "name": "⚛️ ACS Hemel Bhai Chemistry Cycle 1",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_hemel_chem_cycle2": {
            "name": "⚛️ ACS Hemel Bhai Chemistry Cycle 2",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_hemel_chem_cycle3": {
            "name": "⚛️ ACS Hemel Bhai Chemistry Cycle 3",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_hemel_chem_cycle4": {
            "name": "⚛️ ACS Hemel Bhai Chemistry Cycle 4",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_hemel_chem_cycle5": {
            "name": "⚛️ ACS Hemel Bhai Chemistry Cycle 5",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_hemel_chem_all": {
            "name": "⚛️ ACS Hemel Bhai Chemistry ALL Cycle Combo",
            "type": "course",
            "price": 350,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          }
        }
      },
      "acs27_dmc_biology": {
        "name": "⚛️ ACS 27 DMC Dreamers Biology All Course",
        "type": "submenu",
        "courses": {
          "acs27_dmc_bio_cycle1": {
            "name": "⚛️ ACS 27 DMC Dreamers Biology Cycle 1",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_dmc_bio_cycle2": {
            "name": "⚛️ ACS 27 DMC Dreamers Biology Cycle 2",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_dmc_bio_cycle3": {
            "name": "⚛️ ACS 27 DMC Dreamers Biology Cycle 3",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_dmc_bio_cycle4": {
            "name": "⚛️ ACS 27 DMC Dreamers Biology Cycle 4",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_dmc_bio_cycle5": {
            "name": "⚛️ ACS 27 DMC Dreamers Biology Cycle 5",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_dmc_bio_cycle6": {
            "name": "⚛️ ACS 27 DMC Dreamers Biology Cycle 6",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_dmc_bio_all": {
            "name": "⚛️ ACS 27 DMC Dreamers Biology ALL Cycle Combo",
            "type": "course",
            "price": 400,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          }
        }
      },
      "acs27_biomission_biology": {
        "name": "⚛️ ACS 27 BIOMISSION BIOLOGY ALL Course",
        "type": "submenu",
        "courses": {
          "acs27_biomission_bio_cycle1": {
            "name": "⚛️ ACS 27 Biomission Biology Cycle 1",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_biomission_bio_cycle2": {
            "name": "⚛️ ACS 27 Biomission Biology Cycle 2",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_biomission_bio_cycle3": {
            "name": "⚛️ ACS 27 Biomission Biology Cycle 3",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_biomission_bio_cycle4": {
            "name": "⚛️ ACS 27 Biomission Biology Cycle 4",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_biomission_bio_cycle5": {
            "name": "⚛️ ACS 27 Biomission Biology Cycle 5",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_biomission_bio_cycle6": {
            "name": "⚛️ ACS 27 Biomission Biology Cycle 6",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_biomission_bio_all": {
            "name": "⚛️ ACS 27 Biomission Biology ALL Cycle Combo",
            "type": "course",
            "price": 400,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          }
        }
      },
      "acs27_bh_biology": {
        "name": "🔥 ACS 27 Biology Haters Biology ALL Course🔥",
        "type": "submenu",
        "courses": {
          "acs27_bh_bio_cycle1": {
            "name": "🔥 ACS 27 Biology Haters Biology Cycle 1",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_bh_bio_cycle2": {
            "name": "🔥 ACS 27 Biology Haters Biology Cycle 2",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_bh_bio_cycle3": {
            "name": "🔥 ACS 27 Biology Haters Biology Cycle 3",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_bh_bio_cycle4": {
            "name": "🔥 ACS 27 Biology Haters Biology Cycle 4",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_bh_bio_cycle5": {
            "name": "🔥 ACS 27 Biology Haters Biology Cycle 5",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_bh_bio_cycle6": {
            "name": "🔥 ACS 27 Biology Haters Biology Cycle 6",
            "type": "course",
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          },
          "acs27_bh_bio_all": {
            "name": "🔥 ACS 27 Biology Haters Biology ALL Cycle Combo",
            "type": "course",
            "price": 400,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          }
        }
      },
      "acs27_ict": {
        "name": "🔥 ACS 27 ICT Decoders 🔥",
        "type": "submenu",
        "courses": {
          "acs27_ict_all": {
            "name": "🔥 ACS 27 ICT DECODER",
            "type": "course", 
            "price": 100,
            "groupLink": "https://t.me/+HSC2027Physics1st",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Physics 1st Paper Course\n\n✅ Mechanics & Properties of Matter\n✅ Heat & Thermodynamics\n✅ Oscillations & Waves\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions"
          }
        }
      }
    }
  },
  "hsc26": {
    "name": "🔥HSC 2026 All Courses🔥",
    "type": "menu",
    "submenus": {
      "acs26_bangla": {
        "name": "📚 ACS  বাংলা ১ম পত্র সম্পূর্ণ",
        "type": "submenu",
        "courses": {
          "acs26_bangla_all": {
            "name": "📚 ACS  বাংলা ১ম পত্র সম্পূর্ণ",
            "type": "course",
            "price": 0,
            "groupLink": "https://t.me/+HSC2026Biology1",
            "paymentLink": "",
            "imageLink": "",
            "description": "📖 Complete Biology Cycle 1 Course\n\n✅ Cell Biology & Biochemistry\n✅ Plant Biology\n✅ Animal Biology\n✅ HD Video Lectures\n✅ PDF Notes & Books\n✅ Practice Questions\n✅ Live Support"
          }
        }
      },
         "acs26_bangla": {
        "name": "📚 ACS  বাংলা ১ম পত্র সম্পূর্ণ",
        "type": "submenu",
        "courses": {}
         },
         "acs26_bangla": {
        "name": "📚 ACS  বাংলা ১ম পত্র সম্পূর্ণ",
        "type": "submenu",
        "courses": {}
         },
         "acs26_bangla": {
        "name": "📚 ACS  বাংলা ১ম পত্র সম্পূর্ণ",
        "type": "submenu",
        "courses": {}
         },
         "acs26_bangla": {
        "name": "📚 ACS  বাংলা ১ম পত্র সম্পূর্ণ",
        "type": "submenu",
        "courses": {}
         },
         "acs26_bangla": {
        "name": "📚 ACS  বাংলা ১ম পত্র সম্পূর্ণ",
        "type": "submenu",
        "courses": {}
         },
         "acs26_bangla": {
        "name": "📚 ACS  বাংলা ১ম পত্র সম্পূর্ণ",
        "type": "submenu",
        "courses": {}
         },
        
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
            "price": 10,
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

// Updated Database initialization function
async function initializeDatabase() {
    try {
        // Create users table with all required columns
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

        // Add missing column if it doesn't exist (for existing databases)
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE users ADD COLUMN waiting_for_proof TEXT;
                EXCEPTION
                    WHEN duplicate_column THEN
                        -- Column already exists, do nothing
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
                payment_date DATE,
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
                payment_date DATE NOT NULL,
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
        console.log('All required columns are now present');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Helper functions for hardcoded courses
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

// Database helper functions
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
        await pool.query(
            'INSERT INTO transactions (transaction_id, user_id, course_id, amount, payment_method, payment_date) VALUES ($1, $2, $3, $4, $5, $6)',
            [transactionId, userId, courseId, amount, paymentMethod, paymentDate]
        );
        return true;
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            console.error('Duplicate transaction ID:', transactionId);
            return false;
        }
        console.error('Error adding transaction:', error);
        return false;
    }
}

async function addUserPurchase(userId, courseId, menuId, submenuId, transactionId, paymentMethod, amount, paymentDate) {
    try {
        await pool.query(
            `INSERT INTO user_purchases (user_id, course_id, menu_id, submenu_id, transaction_id, payment_method, amount, payment_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (user_id, course_id) DO NOTHING`,
            [userId, courseId, menuId, submenuId, transactionId, paymentMethod, amount, paymentDate]
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
            current_menu: null,
            waiting_for_proof: null
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

// Enhanced bKash payment verification with CORRECTED date checking
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
        
        // NEW: Properly parse bKash date format (2025-08-12T19:57:13:000)
        const [datePart, timePart] = paymentData.completedTime.split('T');
        const paymentDateBD = datePart;
        
        // Get current Bangladesh date (UTC+6)
        const now = new Date();
        const bangladeshOffset = 6 * 60; // minutes
        const bangladeshTime = new Date(now.getTime() + (bangladeshOffset * 60 * 1000));
        const todayOnly = bangladeshTime.toISOString().split('T')[0];
        
        // Calculate yesterday and tomorrow
        const yesterday = new Date(bangladeshTime);
        yesterday.setDate(bangladeshTime.getDate() - 1);
        const yesterdayOnly = yesterday.toISOString().split('T')[0];
        
        const tomorrow = new Date(bangladeshTime);
        tomorrow.setDate(bangladeshTime.getDate() + 1);
        const tomorrowOnly = tomorrow.toISOString().split('T')[0];
        
        // Check if payment date is within allowed range
        const validDates = [yesterdayOnly, todayOnly, tomorrowOnly];
        const isDateValid = validDates.includes(paymentDateBD);
        
        if (!isDateValid) {
            return { 
                success: false, 
                error: `Transaction Verification Error. You can use the Transaction ID only today ± 1 day. Payment Date: ${paymentDateBD}, Today: ${todayOnly}`,
                paymentDate: paymentDateBD,
                currentDate: todayOnly
            };
        }
        
        // Return success with payment data
        return {
            success: true,
            data: paymentData,
            paymentDate: paymentDateBD
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

// Keyboard functions
function getMainMenuKeyboard() {
    const menus = getMenus();
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

function getMenuKeyboard(menuId) {
    const submenus = getSubmenus(menuId);
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
    const courses = getCourses(menuId, submenuId);
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
    const course = findCourseById(courseId);
    if (!course) return getMainMenuKeyboard();
    
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
    const mainKeyboard = getMainMenuKeyboard();
    
    const welcomeText = `🎓 Welcome to Premium Subscription Bot! 🎓

আমাদের premium courses গুলো দেখুন এবং আপনার পছন্দের course কিনুন।

💎 High Quality Content
📚 Expert Teachers  
🎯 Guaranteed Results
💯 24/7 Support`;

    bot.sendMessage(msg.chat.id, welcomeText, mainKeyboard);
});

// Simplified Admin Commands
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

    bot.sendMessage(msg.chat.id, adminText, {parse_mode: 'Markdown'});
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
            'INSERT INTO transactions (transaction_id, user_id, course_id, amount, payment_method, payment_date) VALUES ($1, $2, $3, $4, $5, $6)',
            [trxId, 'admin_added', 'manual', 0, 'manual', new Date().toISOString().split('T')[0]]
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
    try {
        const result = await pool.query('DELETE FROM transactions WHERE transaction_id = $1', [trxId]);
        
        if (result.rowCount > 0) {
            bot.sendMessage(
                msg.chat.id,
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

// Admin management commands (Primary Admin Only)
bot.onText(/\/addadmin (.+)/, async (msg, match) => {
    if (!isPrimaryAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Only primary admin can add new admins!');
    }
    
    const adminId = match[1];
    try {
        await pool.query(
            'INSERT INTO admins (admin_id, added_by) VALUES ($1, $2)',
            [adminId, msg.from.id]
        );
        
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

// Callback Query Handler
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    
    bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'main_menu') {
        const mainKeyboard = getMainMenuKeyboard();
        
        const welcomeText = `🎓 Premium Subscription Bot - Main Menu 🎓

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
        const menus = getMenus();
        const menu = menus.find(m => m.menu_id === menuId);
        
        if (!menu) {
            return bot.sendMessage(msg.chat.id, '❌ Menu not found!');
        }
        
        const menuText = `${menu.name}

📚 Available Categories:`;
        
        try {
            const menuKeyboard = getMenuKeyboard(menuId);
            bot.editMessageText(menuText, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                ...menuKeyboard
            });
        } catch (error) {
            console.error('Error editing message:', error);
            const menuKeyboard = getMenuKeyboard(menuId);
            bot.sendMessage(msg.chat.id, menuText, menuKeyboard);
        }
    }
    else if (data.startsWith('submenu_')) {
        const parts = data.replace('submenu_', '').split('_');
        const menuId = parts[0];
        const submenuId = parts.slice(1).join('_');
        
        const submenus = getSubmenus(menuId);
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
        const course = findCourseById(courseId);
        
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
        const course = findCourseById(courseId);
        
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
        const course = findCourseById(courseId);
        
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
        const course = findCourseById(courseId);
        
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
        const course = findCourseById(courseId);
        
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
        const course = findCourseById(courseId);
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
        
        const course = findCourseById(courseId);
        
        if (!course) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Course not found!', show_alert: true });
        }
        
        if (action === 'approve') {
            const currentDate = new Date().toISOString().split('T')[0];
            
            await addUserPurchase(targetUserId, courseId, course.menu_id, course.submenu_id, 'manual_approve', 'manual', course.price, currentDate);
            await updateUserData(targetUserId, { 
                pending_course: null, 
                pending_payment_method: null,
                waiting_for_proof: null
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
            await updateUserData(targetUserId, {
                waiting_for_proof: null
            });
            
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

// Enhanced Payment Proof Handler with Date Verification
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const userId = msg.from.id;
    const userData = await getUserData(userId);
    
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
            // Handle photo proof (mainly for Nagad)
            const photo = msg.photo[msg.photo.length - 1];
            const fileId = photo.file_id;
            
            // Notify admin
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
            // Handle bKash TRX ID with enhanced verification
            const trxId = msg.text.trim();
            
            // Check if TRX ID already used
            if (await isTransactionUsed(trxId)) {
                return bot.sendMessage(
                    msg.chat.id, 
                    "❌ **এই Transaction ID আগেই ব্যবহার করা হয়েছে!**\n\n" +
                    "দয়া করে নতুন একটি Transaction ID দিন অথবা সাপোর্টে যোগাযোগ করুন।",
                    { 
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }],
                                [{ text: '💬 Contact Support', url: 'https://t.me/yoursupport' }]
                            ]
                        }
                    }
                );
            }
            // In the bKash payment verification section:
const added = await addTransaction(trxId, userId, courseId, course.price, paymentMethod, verificationResult.paymentDate);
if (!added) {
    return bot.sendMessage(
        msg.chat.id, 
        "❌ **এই Transaction ID আগেই ব্যবহার করা হয়েছে!**\n\n" +
        "দয়া করে নতুন একটি Transaction ID দিন অথবা সাপোর্টে যোগাযোগ করুন।",
        { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }],
                    [{ text: '💬 Contact Support', url: 'https://t.me/yoursupport' }]
                ]
            }
        }
    );
}

// Only proceed if transaction was added successfully
await logTransaction(trxId, userId, course.price, course.name, paymentMethod, verificationResult.paymentDate);
await addUserPurchase(userId, courseId, course.menu_id, course.submenu_id, trxId, paymentMethod, course.price, verificationResult.paymentDate);
await updateUserData(userId, { 
    pending_course: null, 
    pending_payment_method: null 
});

// Send success message...
            bot.sendMessage(msg.chat.id, '⏳ Verifying payment and checking date... Please wait...');
            
            try {
                // Enhanced verification with date checking
                const verificationResult = await verifyPaymentWithDateCheck(trxId);
                
                if (verificationResult.success && verificationResult.data.transactionStatus === 'Completed' && 
                    parseInt(verificationResult.data.amount) >= course.price) {
                    
                    // Save to database with payment date
                    await addTransaction(trxId, userId, courseId, course.price, paymentMethod, verificationResult.paymentDate);
                    await logTransaction(trxId, userId, course.price, course.name, paymentMethod, verificationResult.paymentDate);
                    
                    await addUserPurchase(userId, courseId, course.menu_id, course.submenu_id, trxId, paymentMethod, course.price, verificationResult.paymentDate);
                    await updateUserData(userId, { 
                        pending_course: null, 
                        pending_payment_method: null 
                    });
                    
                    const successText = `✅ **পেমেন্ট সফলভাবে ভেরিফাই হয়েছে!**\n\n` +
                                       `📱 ${course.name} Unlocked!\n` +
                                       `💰 Amount: ${course.price} TK\n` +
                                       `🎫 Transaction ID: ${trxId}\n` +
                                       `📅 Payment Date: ${verificationResult.paymentDate}\n\n` +
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
                    
                } else if (!verificationResult.success && verificationResult.error.includes('Transaction Verification Error')) {
                    bot.sendMessage(msg.chat.id, `❌ **${verificationResult.error}**\n\n💡 **Valid Transaction Dates:**\n📅 Yesterday, Today, or Tomorrow only\n\n🔍 **Your Transaction Details:**\n• Transaction ID: \`${trxId}\`\n• Payment Date: ${verificationResult.paymentDate || 'Unknown'}\n• Current Date: ${verificationResult.currentDate || 'Unknown'}\n\n⚠️ Please use a recent transaction ID or make a new payment.`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Try Another TRX ID', callback_data: `submit_proof_${courseId}` }],
                                [{ text: '💳 Make New Payment', callback_data: `payment_method_${courseId}` }],
                                [{ text: '💬 Contact Support', url: 'https://t.me/yoursupport' }],
                                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                            ]
                        }
                    });
                    
                } else {
                    bot.sendMessage(msg.chat.id, `❌ **Payment Verification Failed!**\n\n🔍 Possible reasons:\n• Transaction ID not found\n• Payment amount insufficient (Required: ${course.price} TK)\n• Payment not completed\n• Payment date is invalid\n\n💡 Please check your Transaction ID and try again.\n\nTransaction ID entered: ${trxId}`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }],
                                [{ text: '💬 Contact Support', url: 'https://t.me/yoursupport' }],
                                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                            ]
                        }
                    });
                }
                
            } catch (error) {
                console.error('Payment verification error:', error);
                bot.sendMessage(msg.chat.id, `⚠️ **Verification Error!**\n\nSomething went wrong while verifying your payment. Please contact support.\n\nTransaction ID: ${trxId}`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💬 Contact Support', url: 'https://t.me/yoursupport' }],
                            [{ text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }],
                            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                        ]
                    }
                });
            }
        } else {
            bot.sendMessage(msg.chat.id, '⚠️ Please send the correct format:\n• For bKash: Send Transaction ID only\n• For Nagad: Send payment screenshot', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: `submit_proof_${courseId}` }]
                    ]
                }
            });
        }
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
            <li>✅ Enhanced bKash verification with date checking</li>
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
initializeDatabase().then(() => {
    console.log('Premium Subscription Bot started successfully with PostgreSQL!');
    console.log('Features enabled:');
    console.log('- Hardcoded courses with auto-update on deployment');
    console.log('- Enhanced bKash verification with date checking');
    console.log('- Payment date validation (±1 day from current date)');
    console.log('- Duplicate transaction prevention');
    console.log('- PostgreSQL database: premium-subscription-bot-db');
}).catch(error => {
    console.error('Error starting bot:', error);
});
