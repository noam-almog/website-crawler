import { PlaywrightCrawler } from 'crawlee';
import { Command } from 'commander';
const program = new Command();



program.name('site-crawler')
       .description('CLI to crawl websites')
       .version('1.0.0')
       .requiredOption('-u, --url <string>', 'URL to crawl')
       .option('-d, --depth <number>', 'Max crawl depth', '4')
       .option('-o, --output-file <string>', 'Output CSV file', 'result.csv');

program.parse();

const MaxDepth = program.opts().depth || 4;
const OutputFile = program.opts().outputFile || './result.csv';
const startUrl = program.opts().url;

// PlaywrightCrawler crawls the web using a headless browser controlled by the Playwright library.
const crawler = new PlaywrightCrawler({
    // Use the requestHandler to process each of the crawled pages.
    async requestHandler({ request, page, enqueueLinks, pushData, log }) {
        const url = request.loadedUrl;
        const title = await page.title();
        const content = await page.content();
        const sizeInBytes = Buffer.byteLength(content, 'utf8');

        const currentDepth = request.userData.depth ?? 0;

        log.info(`[${request.loadedUrl}]: '${title}'`);

        // Save results as JSON to `./storage/datasets/default` directory.
        await pushData({ title, url, sizeInBytes });

        // Extract links from the current page and add them to the crawling queue.
        if (currentDepth < MaxDepth) {
            await enqueueLinks({
                transformRequestFunction: (req) => {
                    req.userData.depth = currentDepth + 1;

                    if (!req.url.startsWith(startUrl)) {
                        return null;
                    }

                    return req;
                },
            });
        }
    },
});

// Add first URL to the queue and start the crawl.
await crawler.run([startUrl]);

// Export the whole dataset to a single file in `./result.csv`.
await crawler.exportData(OutputFile);

// Or work with the data directly.
const data = await crawler.getData();
console.table(data.items);