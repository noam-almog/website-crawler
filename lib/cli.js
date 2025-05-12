import figlet from 'figlet';
import inquirer from 'inquirer';
import * as cliProgress from "cli-progress";
import {pathFor} from "./utils.js";

const TestUrls = new Set(
    [
        'https://www.vfsglobal.com/',
        'https://www.intel.com/content/www/us/en/support.html',
        'https://www.intel.com/content/www/us/en/ark.html',
        'https://www.intel.com/content/www/us/en/download-center/home.html',
        'https://www.intel.com/content/www/us/en/resources-documentation/developer.html',
        'https://www.intel.com/content/www/us/en/support.html',
        'https://www.anz.com.au/personal/',
        'https://unity.com/',
        'https://docs.nvidia.com/',
        'https://www.thebicestercollection.com/la-vallee-village/en/',
        'https://www.thebicestercollection.com/bicester-village/en/',
        'https://help.zerto.com/',
        'https://www.intel.com/content/www/us/en/support.html',
        'https://en.wikipedia.org/wiki/Main_Page',
        'https://www.irs.gov/',
        'https://www.irs.gov/',
        'https://www.irs.gov/',
        'https://www.irs.gov/',
        'https://docs.nvidia.com/',
        'https://help.zerto.com',
        'https://www.brenntag.com/en-us/',
    ]
)


export async function userInteraction() {

    console.log(await figlet.text('Website Crawler', 'Doom'))

    const questions = [
        {
            type: 'list',
            name: 'url',
            message: 'Enter the URL to crawl:',
            choices: [...TestUrls],
        },
        {
            type: 'list',
            choices: [ { name: 'Dom Crawler', value: 'dom' },
                { name: 'Headless Crawler', value: 'headless' }
            ],
            name: 'crawler',
            message: 'Which crawler to use?:',
        },
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
        {
            type: 'number',
            name: 'depth',
            message: 'Enter the max crawl depth:',
            default: 4,
        },
        {
            type: 'number',
            name: 'limitRequests',
            message: 'Max number of requests:',
            default: 5,
        },
        {
            type: 'input',
            name: 'outputFile',
            message: 'Output report file:',
            default: './result.csv',
        },

    ];

    const options = await inquirer.prompt(questions);

    console.log('\n🔧 Selected Options:');
    Object.entries(options)
        .forEach(([key, value]) => console.log(`   ${key}: ${value}`));
    console.log();

    const maxDepth = options.depth;
    const outputFile = options.outputFile;
    const startUrl = options.url;
    const startPath = pathFor(startUrl)

    const limit = options.limitRequests;

    return options;
}


const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const bar = new cliProgress.SingleBar({
    format: '{spinner} | {bar} | {percentage}% | {value}/{total} || {url}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
}, cliProgress.Presets.shades_grey)


export function initProgressBar(limit) {
    bar.start(limit, 0, {
        url: 'N/A',
        spinner: spinnerFrames[0]
    });
}

export function reportProgress(total, limit, count, url) {
    bar.setTotal(Math.min(total, limit));
    bar.update(count, { url, spinner: spinnerFrames[count % spinnerFrames.length]});
}

export function closeProgressBar() {
    bar.stop();
}
