import {CheerioCrawler, PlaywrightCrawler} from "crawlee";
import * as cli from "./cli.js";
import {pathFor} from "./utils.js";

export function headlessCrawler(limit, startPath, maxDepth) {
    return new PlaywrightCrawler({
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
}

export function domCrawler(limit, startPath, maxDepth) {
    return new CheerioCrawler({
        preNavigationHooks: [ (ctx) => { ctx.request.headers['User-Agent'] = 'SalesforceTestCrawler/1.0.0 (+https://salesforce.com)'; }],
        async requestHandler({ pushData, request, response, body, enqueueLinks, $ }) {
            cli.reportProgress(this.requestQueue.getTotalCount(), limit, await this.requestQueue.handledCount(), request.loadedUrl);

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
}
