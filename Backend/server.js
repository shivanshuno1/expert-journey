const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const HOME_URL = 'https://rera.karnataka.gov.in';

// Hardcoded districts and taluks (works offline, always available)
const DISTRICT_TALUK_MAP = {
  'Bengaluru Urban': ['Bengaluru North', 'Bengaluru South', 'Bengaluru East', 'Anekal'],
  'Bengaluru Rural': ['Devanahalli', 'Dodballapur', 'Hoskote', 'Nelamangala'],
  'Belagavi': ['Belagavi', 'Athani', 'Bailhongal', 'Chikodi', 'Gokak', 'Hukeri', 'Khanapur', 'Raybag', 'Ramdurg', 'Sadalga', 'Sampgaon'],
  'Mysore': ['Mysore', 'H D Kote', 'Hunsur', 'K R Nagar', 'Nanjangud', 'Piriyapatna', 'T Narasipura', 'Saligrama'],
  'Dakshina Kannada': ['Mangaluru', 'Bantwal', 'Belthangady', 'Kadaba', 'Puttur', 'Sullia'],
  'Udupi': ['Udupi', 'Brahmavar', 'Karkala', 'Kundapura', 'Byndoor'],
  'Shivamogga': ['Shivamogga', 'Bhadravati', 'Hosanagara', 'Sagara', 'Shikaripura', 'Soraba', 'Thirthahalli'],
  'Tumakuru': ['Tumakuru', 'Chikkanayakanahalli', 'Gubbi', 'Koratagere', 'Kunigal', 'Madhugiri', 'Pavagada', 'Sira', 'Tiptur', 'Turuvekere'],
  'Hassan': ['Hassan', 'Alur', 'Arkalgud', 'Arsikere', 'Belur', 'Channarayapatna', 'Hole Narsipur', 'Sakleshpur'],
  'Mandya': ['Mandya', 'Krishnarajpet', 'Maddur', 'Malavalli', 'Nagamangala', 'Pandavapura', 'Shrirangapattana'],
  'Chamarajanagar': ['Chamarajanagar', 'Gundlupet', 'Kollegal', 'Yelandur'],
  'Kodagu': ['Madikeri', 'Somvarpet', 'Virajpet'],
  'Chikkamagaluru': ['Chikkamagaluru', 'Kadur', 'Koppa', 'Mudigere', 'Narasimharajapura', 'Sringeri', 'Tarikere'],
  'Davanagere': ['Davanagere', 'Channagiri', 'Harapanahalli', 'Honnali', 'Jagalur', 'Nyamathi'],
  'Ballari': ['Ballari', 'Hagaribommanahalli', 'Hospet', 'Kampli', 'Kudligi', 'Sandur', 'Siruguppa'],
  'Vijayanagara': ['Hospet', 'Harapanahalli', 'Hagaribommanahalli', 'Kotturu', 'Kudligi', 'Mariyammanahalli'],
  'Raichur': ['Raichur', 'Devadurga', 'Lingsugur', 'Manvi', 'Sindhanur'],
  'Kalaburagi': ['Kalaburagi', 'Aland', 'Afzalpur', 'Chincholi', 'Chitapur', 'Jevargi', 'Sedam'],
  'Bidar': ['Bidar', 'Aurad', 'Basavakalyan', 'Bhalki', 'Chitgoppa', 'Humnabad', 'Kamalnagar'],
  'Yadgir': ['Yadgir', 'Gurumitkal', 'Hunasagi', 'Shahapur', 'Shorapur', 'Wadgera'],
  'Koppal': ['Koppal', 'Gangawati', 'Kushtagi', 'Yelburga'],
  'Gadag': ['Gadag', 'Gajendragad', 'Mundargi', 'Nargund', 'Ron', 'Shirhatti'],
  'Dharwad': ['Dharwad', 'Alnavar', 'Annigeri', 'Hublikar', 'Kalghatgi', 'Kundgol', 'Navalgund'],
  'Haveri': ['Haveri', 'Byadgi', 'Hangal', 'Hirekerur', 'Ranebennur', 'Savanur', 'Shiggaon'],
  'Uttara Kannada': ['Karwar', 'Ankola', 'Bhatkal', 'Haliyal', 'Honnavar', 'Joida', 'Kumta', 'Mundgod', 'Siddapur', 'Sirsi', 'Yellapur', 'Yellapur'],
  'Bagalkot': ['Bagalkot', 'Badami', 'Bilgi', 'Hungund', 'Jamkhandi', 'Mudhol', 'Rabkavi Banhatti', 'Teradal'],
  'Vijayapura': ['Vijayapura', 'Babaleshwar', 'Basavana Bagewadi', 'Devara Hipparagi', 'Indi', 'Kolhar', 'Muddebihal', 'Nidagundi', 'Sindgi', 'Tikota'],
  'Chitradurga': ['Chitradurga', 'Challakere', 'Hiriyur', 'Holalkere', 'Hosadurga', 'Molakalmuru'],
  'Ramanagara': ['Ramanagara', 'Channapatna', 'Harohalli', 'Kanakapura', 'Magadi'],
  'Kolar': ['Kolar', 'Bangarapet', 'Malur', 'Mulbagal', 'Srinivaspur', 'Kolar Gold Fields'],
  'Chikkaballapura': ['Chikkaballapura', 'Bagepalli', 'Chintamani', 'Gauribidanur', 'Gudibanda', 'Sidlaghatta']
};

const FALLBACK_DISTRICTS = Object.keys(DISTRICT_TALUK_MAP);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper to attempt live scraping with multiple strategies
async function scrapeWithPuppeteer(district, taluk = null) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Go to homepage first
    await page.goto(HOME_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    
    // Try to find and click "Project Applications" link
    const clicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const target = links.find(a => 
        a.innerText.includes('Project Applications') || 
        a.innerText.includes('Project Search') ||
        a.href.includes('projectViewDetails')
      );
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    
    if (clicked) {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } else {
      // Try direct URL as fallback
      await page.goto('https://rera.karnataka.gov.in/projectViewDetails', { waitUntil: 'networkidle2', timeout: 30000 });
    }
    
    await delay(2000);
    
    // Check for district dropdown with multiple possible selectors
    const districtSelectors = ['#projectDist', 'select[name="district"]', 'select[id*="district"]', '.district-select'];
    let districtElement = null;
    for (const sel of districtSelectors) {
      districtElement = await page.$(sel);
      if (districtElement) break;
    }
    
    if (!districtElement) {
      await page.screenshot({ path: 'debug-no-district.png' });
      throw new Error('District dropdown not found on page');
    }
    
    // Select district if provided
    if (district) {
      await page.select(districtSelectors[0], district);
      await delay(1000);
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
      }, districtSelectors[0]);
      await delay(1500);
    }
    
    // If taluk requested, try to get taluk options
    if (taluk === null) {
      // Return taluks
      const talukSelectors = ['#SubDistrict-projectDist', 'select[name="subdistrict"]', 'select[id*="taluk"]', 'select[id*="subdistrict"]'];
      let talukSelect = null;
      let usedSelector = null;
      for (const sel of talukSelectors) {
        talukSelect = await page.$(sel);
        if (talukSelect) {
          usedSelector = sel;
          break;
        }
      }
      
      if (!talukSelect) {
        return { success: false, error: 'Taluk dropdown not found' };
      }
      
      const taluks = await page.evaluate((sel) => {
        const select = document.querySelector(sel);
        if (!select) return [];
        return Array.from(select.options)
          .filter(opt => opt.value && opt.value !== '0' && opt.text.trim() !== '--Select--')
          .map(opt => ({ value: opt.value, label: opt.text.trim() }));
      }, usedSelector);
      
      return { success: true, taluks };
    } else {
      // Scrape project data
      const talukSelectors = ['#SubDistrict-projectDist', 'select[name="subdistrict"]', 'select[id*="taluk"]'];
      let talukSelected = false;
      for (const sel of talukSelectors) {
        const exists = await page.$(sel);
        if (exists) {
          await page.select(sel, taluk);
          talukSelected = true;
          break;
        }
      }
      if (!talukSelected) {
        throw new Error('Taluk dropdown not found for selection');
      }
      await delay(1000);
      
      // Click search button
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const searchBtn = btns.find(b => b.innerText.includes('Search') || b.value === 'Search');
        if (searchBtn) searchBtn.click();
        else {
          const form = document.querySelector('form');
          if (form) form.submit();
        }
      });
      
      await delay(3000);
      
      // Extract table
      const tableData = await page.evaluate(() => {
        const table = document.querySelector('.dataTable, table');
        if (!table) return { columns: [], rows: [] };
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
          Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
        );
        return { columns: headers, rows };
      });
      
      return { success: true, ...tableData };
    }
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

// API endpoints

app.get('/api/districts', async (req, res) => {
  // Return hardcoded districts (reliable)
  res.json({ districts: FALLBACK_DISTRICTS });
});

app.post('/api/taluks', async (req, res) => {
  const { district } = req.body;
  if (!district) return res.status(400).json({ error: 'District required' });
  
  // Try live scrape first
  const result = await scrapeWithPuppeteer(district);
  if (result.success && result.taluks && result.taluks.length > 0) {
    return res.json({ taluks: result.taluks });
  }
  
  // Fallback to hardcoded data
  const taluks = DISTRICT_TALUK_MAP[district] || [];
  if (taluks.length === 0) {
    return res.status(404).json({ error: 'No taluks found for this district' });
  }
  
  res.json({ taluks: taluks.map(t => ({ value: t, label: t })) });
});

app.post('/api/scrape', async (req, res) => {
  const { district, taluk } = req.body;
  if (!district || !taluk) {
    return res.status(400).json({ error: 'District and Taluk are required' });
  }
  
  // Try live scrape
  const result = await scrapeWithPuppeteer(district, taluk);
  if (result.success && result.rows) {
    return res.json({
      success: true,
      columns: result.columns,
      data: result.rows,
      district,
      taluk,
      totalCount: result.rows.length
    });
  }
  
  // Return sample data as fallback
  const sampleData = [
    ['1', 'PR/KN/170728/000131', '', 'GREEN HOUSE DEVELOPERS', 'LAKE VIEW TOWERS', 'REJECTED', district, taluk, 'RESIDENTIAL', ''],
    ['2', 'PR/KN/170729/000144', 'PRM/KA/RERA/1251/309/PR/170913/000144', 'VAJRAM ESTATES PVT LTD', 'VAJRAM TIARA', 'APPROVED', district, taluk, 'RESIDENTIAL', '13/09/2017'],
    ['3', 'PR/KN/170728/000051', 'PRM/KA/RERA/1251/309/PR/171019/000051', 'SRC DIVAKARS', 'SKY ASTA', 'APPROVED', district, taluk, 'RESIDENTIAL', '19/10/2017'],
    ['4', 'PR/KN/170731/000178', 'PRM/KA/RERA/1251/309/PR/171026/000178', 'CREATIVE & SRIVARU BUILDERS', 'SREE PALACE', 'APPROVED', district, taluk, 'RESIDENTIAL', '26/10/2017']
  ];
  
  res.json({
    success: true,
    columns: ['S.No', 'ACKNOWLEDGEMENT NO', 'REGISTRATION NO', 'PROMOTER NAME', 'PROJECT NAME', 'STATUS', 'DISTRICT', 'TALUK', 'PROJECT TYPE', 'APPROVED ON'],
    data: sampleData,
    district,
    taluk,
    totalCount: sampleData.length,
    note: 'Using sample data because live scraping failed. Please check the website manually.'
  });
});

app.get('/', (req, res) => {
  res.send('Karnataka RERA Scraper API is running. Use /api/districts, /api/taluks, /api/scrape');
});

// Fix for Chrome DevTools well-known endpoint
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));