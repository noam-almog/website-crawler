import {log, LogLevel, PlaywrightCrawler, Sitemap, CheerioCrawler} from 'crawlee';
import * as cliProgress from 'cli-progress';
import {Command} from 'commander';
import figlet from 'figlet';

log.setLevel(LogLevel.OFF);

console.log(await figlet.text('Website Crawler', 'Doom'))

const program = new Command();

program.name('site-crawler')
    .description('CLI to crawl websites')
    .version('1.0.0')
    .requiredOption('-u, --url <string>', 'URL to crawl')
    .option('-c, --crawler <string>', `Use 'headless' or 'dom'`, 'dom')
    .option('-d, --depth <number>', 'Max crawl depth', '4')
    .option('-o, --output-file <string>', 'Output CSV file', './result.csv')
    .option('-l, --limit-requests <number>', 'Limit number of requests', '5');

program.parse();

console.log('\n🔧 Selected Options:');
Object.entries(program.opts())
    .forEach(([key, value]) => console.log(`   ${key}: ${value}`));

const pathFor = (url) => {
    const path = new URL(url).pathname
    const arr = path.split('/')
    const filePattern = /.*\.(html?|php|json|asp|htm)$/i;
    if (arr.length > 0 && arr.at(-1).match(filePattern)) {
        arr.pop()
        return arr.join('/')
    }
    return path;
}

const options = program.opts()
const maxDepth = parseInt(options.depth);
const outputFile = options.outputFile;
const startUrl = options.url;
const startPath = pathFor(startUrl)

const limit = parseInt(options.limitRequests);

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const bar = new cliProgress.SingleBar({
    format: '{spinner} | {bar} | {percentage}% | {value}/{total} || {url}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
}, cliProgress.Presets.shades_grey)

bar.start(limit, 0, {
    url: "N/A",
    spinner: spinnerFrames[0]
});

const reportProgress = (total, count, url) => {
    bar.setTotal(Math.min(total, limit));
    bar.update(count, { url, spinner: spinnerFrames[count % spinnerFrames.length]});
}

const crawler = new PlaywrightCrawler({
    async requestHandler({ request, response, page, enqueueLinks, pushData}) {
        reportProgress(this.requestQueue.getTotalCount(), await this.requestQueue.handledCount(), request.loadedUrl);

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

const crawler2 = new CheerioCrawler({
    async requestHandler({ pushData, request, response, body, log, enqueueLinks, $ }) {
        reportProgress(this.requestQueue.getTotalCount(), await this.requestQueue.handledCount(), request.loadedUrl);

        const status = response.statusCode;
        if (status > 300) return;

        log.info(`Processing ${request.url}`);
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
    // This function is called if the page processing failed more than maxRequestRetries + 1 times.
    // failedRequestHandler({ request, log }) {
    //     log.info(`Request ${request.url} failed twice.`);
    // },
});

const startUrls = []
if (startUrl.endsWith('/sitemap.xml')) {
    const {urls} = await Sitemap.load(startUrl);
    startUrls.push(...urls);
} else {
    startUrls.push(startUrl);
}

let useCrawler = crawler2;
if (options.crawler === 'headless') {
    useCrawler = crawler;
}

await useCrawler.run(startUrls);

bar.stop()

log.setLevel(LogLevel.INFO);
const data = await useCrawler.getData();

if (data.items.length > 0) {
    console.table(data.items);
    await useCrawler.exportData(outputFile, 'csv');
} else {
    console.log('No data found')
}


