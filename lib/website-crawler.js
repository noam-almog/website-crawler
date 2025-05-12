import {log, LogLevel, PlaywrightCrawler, Sitemap, CheerioCrawler} from 'crawlee';
import * as cli from "./cli.js";
import {pathFor} from "./utils.js";

log.setLevel(LogLevel.OFF);

const options = await cli.userInteraction();

const maxDepth = options.depth;
const outputFile = options.outputFile;
const startUrl = options.url;
const startPath = pathFor(startUrl)

const limit = options.limitRequests;

cli.initProgressBar(limit)

const headlessCrawler = new PlaywrightCrawler({
    async requestHandler({ request, response, page, enqueueLinks, pushData}) {
        cli.reportProgress(this.requestQueue.getTotalCount(), limit, await this.requestQueue.handledCount(), request.loadedUrl);

        const status = response?.status();
        if (status > 300) return;

        const url = request.loadedUrl;
        if (startPath !== '/' && !pathFor(url).startsWith(startPath)) return;

        const title = await page.title();
        const content = await page.content();
        const sizeInBytes = Buffer.byteLength(content, 'utf8');

        await pushData({ title, url, sizeInBytes });

        // Extract links from the current page and add them to the crawling queue.
        const currentDepth = request.userData.depth ?? 0;
        if (currentDepth < maxDepth) {
            await enqueueLinks({
                transformRequestFunction: (req) => {
                    req.userData.depth = currentDepth + 1;

                    return req;
                },
                strategy: 'same-domain',
            });
        }
    },
    maxRequestsPerCrawl: limit,
});

const domCrawler = new CheerioCrawler({
    preNavigationHooks: [ (ctx) => { ctx.request.headers['User-Agent'] = 'SalesforceTestCrawler/1.0.0 (+https://salesforce.com)'; }],
    async requestHandler({ pushData, request, response, body, enqueueLinks, $ }) {
        cli.reportProgress(this.requestQueue.getTotalCount(), await this.requestQueue.handledCount(), request.loadedUrl);

        const status = response.statusCode;
        if (status > 300) return;

        const url = request.loadedUrl;
        if (startPath !== '/' && !pathFor(url).startsWith(startPath)) return;

        const title = $('title').text();
        const sizeInBytes = Buffer.byteLength(body, 'utf8');

        await pushData({ title, url, sizeInBytes });

        const currentDepth = request.userData.depth ?? 0;
        if (currentDepth < maxDepth) {
            await enqueueLinks({
                selector: 'a',
                strategy: 'same-domain',
                transformRequestFunction: (req) => {
                    req.userData.depth = currentDepth + 1;

                    return req;
                },

            });
        }
    },
    maxRequestsPerCrawl: limit,
});

const startUrls = []
if (startUrl.endsWith('/sitemap.xml')) {
    const {urls} = await Sitemap.load(startUrl);
    startUrls.push(...urls);
} else {
    startUrls.push(startUrl);
}

let useCrawler = domCrawler;
if (options.crawler === 'headless') {
    useCrawler = headlessCrawler;
}

if (options.throttle) {
    useCrawler.maxConcurrency = options.concurrency;
    useCrawler.sameDomainDelaySecs = options.delay;
}

await useCrawler.run(startUrls);

cli.closeProgressBar()

log.setLevel(LogLevel.INFO);
const data = await useCrawler.getData();

if (data.items.length > 0) {
    console.table(data.items);
    await useCrawler.exportData(outputFile, 'csv');
} else {
    console.log('No data found')
}


