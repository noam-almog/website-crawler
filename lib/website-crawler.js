import {log, LogLevel, Sitemap} from 'crawlee';
import * as cli from "./cli.js";
import * as crawlers from "./crawlers.js";
import {pathFor} from "./utils.js";

log.setLevel(LogLevel.OFF);

const options = await cli.userInteraction();

const maxDepth = options.depth;
const outputFile = options.outputFile;
const startUrl = options.url;
const startPath = pathFor(startUrl)

const limit = options.limitRequests;

cli.initProgressBar(limit)

const startUrls = []
if (startUrl.endsWith('/sitemap.xml')) {
    const {urls} = await Sitemap.load(startUrl);
    startUrls.push(...urls);
} else {
    startUrls.push(startUrl);
}

const cfg = { maxRequestsPerCrawl: 5 }
if (options.fullCrawl) {
    cfg.maxRequestsPerCrawl = 100000;
}


let crawler;
if (options.crawler === 'headless') {
    crawler = crawlers.headlessCrawler(limit, startPath, maxDepth, cfg);
} else {
    crawler = crawlers.domCrawler(limit, startPath, maxDepth, cfg);
}

if (options.throttle) {
    crawler.maxConcurrency = options.concurrency;
    crawler.sameDomainDelaySecs = options.delay;
}

await crawler.run(startUrls);

cli.closeProgressBar()

console.log('\n\n')

log.setLevel(LogLevel.INFO);
const data = await crawler.getData();

if (data.items.length > 0) {
    console.log('  Crawled data:');
    console.table(data.items);
    await crawler.exportData(outputFile, 'csv');
} else {
    console.log('No data found')
}
