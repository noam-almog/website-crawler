import {PlaywrightCrawler, Configuration, log, LogLevel} from 'crawlee';
import * as cliProgress from 'cli-progress';
import { Command } from 'commander';
import figlet from 'figlet';

log.setLevel(LogLevel.OFF);

console.log(await figlet.text('Website Crawler', 'Doom'))
console.log()
console.log()

const program = new Command();

program.name('site-crawler')
       .description('CLI to crawl websites')
       .version('1.0.0')
       .requiredOption('-u, --url <string>', 'URL to crawl')
       .option('-d, --depth <number>', 'Max crawl depth', '4')
       .option('-o, --output-file <string>', 'Output CSV file', './result.csv')
       .option('-l, --limit-requests <number>', 'Limit number of requests', '5');

program.parse();

const MaxDepth = parseInt(program.opts().depth);
const OutputFile = program.opts().outputFile;
const startUrl = program.opts().url;
const limit = parseInt(program.opts().limitRequests);

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const bar = new cliProgress.SingleBar({
    format: '{spinner} | {bar} | {percentage}% || {url} | {value}/{total} Urls',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
}, cliProgress.Presets.shades_grey)

bar.start(limit, 0, {
    url: "N/A",
    spinner: spinnerFrames[0]
});

const crawler = new PlaywrightCrawler({
    async requestHandler({ request, response, page, enqueueLinks, pushData}) {
        bar.setTotal(Math.min(this.requestQueue.getTotalCount(), limit));
        const count = await this.requestQueue.handledCount();
        bar.update(await this.requestQueue.handledCount(), { url: request.loadedUrl, spinner: spinnerFrames[count % spinnerFrames.length]});

        const status = response?.status();
        if (status > 300) return;

        const url = request.loadedUrl;
        const title = await page.title();
        const content = await page.content();
        const sizeInBytes = Buffer.byteLength(content, 'utf8');

        await pushData({ title, url, sizeInBytes });

        // Extract links from the current page and add them to the crawling queue.
        const currentDepth = request.userData.depth ?? 0;
        if (currentDepth < MaxDepth) {
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

// Add first URL to the queue and start the crawl.
await crawler.run([startUrl]);
bar.stop()

log.setLevel(LogLevel.INFO);


await crawler.exportData(OutputFile, 'csv');

const data = await crawler.getData();
console.table(data.items);