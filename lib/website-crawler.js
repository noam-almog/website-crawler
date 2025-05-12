import {log, LogLevel, PlaywrightCrawler, Sitemap, CheerioCrawler} from 'crawlee';
import * as cliProgress from 'cli-progress';
import {Command} from 'commander';
import figlet from 'figlet';
import inquirer from 'inquirer';


log.setLevel(LogLevel.OFF);

console.log(await figlet.text('Website Crawler', 'Doom'))

const program = new Command();

program.name('site-crawler')
    .description('CLI to crawl websites')
    .version('1.0.0')
    .option('-u, --url <string>', 'URL to crawl')
    .option('-c, --crawler <string>', `Use 'headless' or 'dom'`)
    .option('-d, --depth <number>', 'Max crawl depth')
    .option('-o, --output-file <string>', 'Output CSV file', './result.csv')
    .option('-l, --limit-requests <number>', 'Limit number of requests')
    .parse(process.argv);



const options = program.opts();

const questions = [];

if (!options.url) {
    questions.push({
        type: 'input',
        name: 'url',
        message: 'Enter the URL to crawl:',
        validate: (input) => {
            try {
                new URL(input);
                return true;
            } catch {
                return 'Please enter a valid URL (e.g., https://example.com)';
            }
        },
    });
}

if (!options.crawler) {
    questions.push({
        type: 'list',
        choices: [ { name: 'Dom Crawler', value: 'dom' },
                   { name: 'Headless Crawler', value: 'headless' }
                 ],
        name: 'crawler',
        message: 'Which crawler to use?:',
    });
}
questions.push(
    {
        type: 'confirm',
        name: 'throttle',
        message: 'Do you want to enable throttling?',
        default: false,
    },
    {
        type: 'number',
        name: 'concurrency',
        message: 'Enter max concurrency:',
        when: (answers) => answers.throttle,
        default: 1,
        validate: (input) => input > 0 || 'Concurrency must be a positive number',
    },
    {
        type: 'number',
        name: 'delay',
        message: 'Enter delay between same domain requests (in seconds):',
        when: (answers) => answers.throttle,
        default: 1,
        validate: (input) => input >= 0 || 'Delay must be zero or more',
    },
);

if (!options.depth) {
    questions.push({
        type: 'number',
        name: 'depth',
        message: 'Enter the max crawl depth:',
        default: 4,
    });
}

if (!options.limitRequests) {
    questions.push({
        type: 'number',
        name: 'limitRequests',
        message: 'Max number of requests:',
        default: 5,
    });
}

const answers = await inquirer.prompt(questions);

const finalOptions = { ...options, ...answers };

console.log('\n🔧 Selected Options:');
Object.entries(finalOptions)
    .forEach(([key, value]) => console.log(`   ${key}: ${value}`));
console.log();

const pathFor = (url) => {
    const path = new URL(url).pathname
    const arr = path.split('/')
    const filePattern = /.*\.(html?|php|json|asp|htm|xml)$/i;
    if (arr.length > 0 && arr.at(-1).match(filePattern)) {
        arr.pop()
        return arr.join('/')
    }
    return path;
}

const maxDepth = parseInt(finalOptions.depth);
const outputFile = finalOptions.outputFile;
const startUrl = finalOptions.url;
const startPath = pathFor(startUrl)

const limit = parseInt(finalOptions.limitRequests);

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

const headlessCrawler = new PlaywrightCrawler({
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

const domCrawler = new CheerioCrawler({
    preNavigationHooks: [ (ctx) => { ctx.request.headers['User-Agent'] = 'SalesforceTestCrawler/1.0.0 (+https://salesforce.com)'; }],
    async requestHandler({ pushData, request, response, body, log, enqueueLinks, $ }) {
        reportProgress(this.requestQueue.getTotalCount(), await this.requestQueue.handledCount(), request.loadedUrl);

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

let useCrawler = domCrawler;
if (options.crawler === 'headless') {
    useCrawler = headlessCrawler;
}

if (finalOptions.throttle) {
    useCrawler.maxConcurrency = finalOptions.concurrency;
    useCrawler.sameDomainDelaySecs = finalOptions.delay;
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


