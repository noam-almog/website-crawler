import {CheerioCrawler, PlaywrightCrawler} from "crawlee";
import * as cli from "./cli.js";
import {pathFor} from "./utils.js";

export function headlessCrawler(limit, startPath, maxDepth, cfg) {
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
        ...{cfg}
    });
}


export function domCrawler(limit, startPath, maxDepth, cfg) {
    return new CheerioCrawler({
        preNavigationHooks: [
            async ({ request }) => {
                request.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            }
        ],
        async requestHandler({ pushData, request, response, body, enqueueLinks, $, log }) {
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
        ...cfg,
    });
}
