const axios = require('axios');
const Nightmare = require('nightmare');
const {URL} = require('url');
const $ = require('cheerio');
const fs = require('fs')

const BANK_MEGA_URL = 'https://www.bankmega.com/promolainnya.php';
const WAIT_AFTER_CLICK = 3000;
axios.defaults.timeout = 20000;

async function scrape() {
    console.log("Scraping categories..");
    let categories = await getCategories();
    console.log("Scraping promotions..");
    let promos = await getPromos(categories);
    console.log("Scraping promotions detail..");
    let promosWithDetail = await getPromosWithDetail(promos);
    console.log("Creating results..");
    let result = {};
    categories.forEach(category => {
        result[category.title] = [];
    });
    promosWithDetail.forEach(promo => {
        let categoryName = promo.category.title;
        delete promo.category;
        result[categoryName].push(promo);
    });
    return result;
}

async function getCategories() {
    return axios.get(BANK_MEGA_URL).then((response) => {
        if (response && response.status == 200 && response.data) {
            return $('#subcatpromo img', response.data).map((i, el) => el.attribs).get();
        } else {
            Promise.reject(new Error(`No response/data from ${BANK_MEGA_URL}`));
        }
    })
}

async function getPromos(categories) {
    return Promise.all(categories.map(getPromosByCategory))
        .then((promos) => [].concat.apply([], promos));
}

async function getPromosByCategory(category) {
    console.log(`  Scraping promos with category=${category.id}`);
    const nightmare = new Nightmare({show: false});
    await nightmare
        .goto(BANK_MEGA_URL)
        .exists('#subcatpromo')
        .click('#' + category.id)
        .wait(WAIT_AFTER_CLICK);

    let promos = [];
    let currentPage = 0, lastPage = 0;
    do {
        let promosSinglePage = await getPromosSinglePage(nightmare, category)
        promos.push(...promosSinglePage);
        let info = await getPageNumberInfo(nightmare);
        if (info) {
            [currentPage, lastPage] = info.split(' ').map((token)=>parseInt(token))
                .filter((token) => !isNaN(token));
        } else {
            currentPage = 0;
            lastPage = 0;
        }
        if (currentPage < lastPage) {
            await nightmare
                .evaluate(() => {
                    let nodes = document.querySelectorAll('.page_promo_lain');
                    nodes[nodes.length-1].click();
                }).wait(WAIT_AFTER_CLICK);
        }
    } while (currentPage < lastPage);
    console.log(`  Finished scraping promos with category=${category.id}`);
    return promos;
}

async function getPageNumberInfo(nightmare) {
    return nightmare
        .evaluate(() => { 
            let node = document.querySelector('#paging1');
            if (node) {
                return node.getAttribute('title');
            } else {
                return null;
            }
        });
}

async function getPromosSinglePage(nightmare, category) {
    return nightmare
        .evaluate(() => document.querySelector('#promolain').innerHTML)
        .then((html) => $('img', html).map((i, el) => {
            let promo = {category: category};
            if (el) {
                if (el.attribs.title) 
                    promo.title = el.attribs.title;
                if (el.parent && el.parent.attribs.href)
                    promo.url = new URL(el.parent.attribs.href, BANK_MEGA_URL).toString();
                if (el.attribs.src) 
                    promo.image_url = new URL(el.attribs.src, BANK_MEGA_URL).toString();
            }
            return promo;
        }).get());
}

async function getPromosWithDetail(promos) {
    return Promise.all(promos.map(getPromoWithDetail));
}

async function getPromoWithDetail(promo) {
    console.log(`  Scraping details from: ${promo.url}`);
    return axios.get(promo.url)
        .then((response) => {
            if (response && response.status == 200 && response.data) {
                promo = Object.assign({}, promo, parsePromoDetail(response));
                console.log(`  Finished scraping details from ${promo.url}`);            
            } else {
                console.log(`  Warning: no response/data from ${promo.url}`);
            }
            return promo;
        }).catch((err) => {
            console.log(`  Error when scraping details from ${promo.url}  (${err})`);
            promo.error = err.message;
            return promo;
        });
}

function parsePromoDetail(response) {
    detail = {}
    let html = $('#contentpromolain2', response.data).html();
    let area = $('.area', html).text().replace('Area Promo : ', '');
    let period = $('.periode', html).text().replace(/\t|\n/g, '').replace('Periode Promo : ', '');
    let descImageUrl = $('.keteranganinside img', html).attr('src');
    if (area) detail.area = area;
    if (period) {
        let [startPeriod, endPeriod] = period.split(' - ');
        if (startPeriod) detail.start_period = periodToDayMonthYear(startPeriod);
        if (endPeriod) detail.end_period = periodToDayMonthYear(endPeriod);
    }
    if (descImageUrl) {
        detail.description_image = new URL(descImageUrl, BANK_MEGA_URL).toString();
    }
    return detail;
}

function periodToDayMonthYear(period) {
    let [day, month, year] = period.split(" ");
    return { day: day, month: month, year: year };
}

scrape().then((promos) => {
    const filename = 'solution.json';
    console.log(`Writing results to ${filename}..`);
    fs.writeFileSync(filename, JSON.stringify(promos, null, 4));
    console.log('Done');
}).catch((err) => {
    console.log('An error occured:', err);
}).then(() => {
    process.exit();
});
