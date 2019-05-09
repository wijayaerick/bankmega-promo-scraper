# Bank Mega Promotions Scraper

Bank Mega credit card promotions scraper

Website: https://www.bankmega.com/promolainnya.php

## Usage

1. Run `npm install`
2. Start scraping by running `node solution.js`
3. Results will be saved in `solution.json`
4. Try the [troubleshooting](#troubleshoot) if the script does not run as expected

## Troubleshoot

The script uses [Nightmare](http://www.nightmarejs.org/), which depends on 
[Electron](https://electronjs.org/), to handle ajax load. If the script **stopped 
without error message** and `solution.json` has not been created, most likely it was 
caused by [incomplete electron installation](https://github.com/electron/electron/issues/1518). 

To validate this behavior, you can run the script with `DEBUG=nightmare* node solution.js` 
command to see the debug logs from Nightmare. The logs are pretty much self-explanatory. 
```
...
nightmare electron child process exited with code 127: command not found - you may not have electron installed correctly +3ms
nightmare electron child process not started yet, skipping kill. +0ms
...
```

Additionaly, the scraper is developed and tested with Node.js v8.16.0. I haven't tested it with 
different versions yet. 

## Why I use [Nightmare](http://www.nightmarejs.org/)

The Bank Mega website loads data with ajax when category image or page number is clicked. 
The element itself does not contain url to load data so that parsing the element's HTML won't be enough. 
Therefore, I use headless browser library such as Nightmare so that I can "click" the category or page number and then scrape the loaded data. The drawback is that currently the Nightmare instance will "wait" for 3s after every click to make sure that the data has been loaded before invoking parser. 

Another possible method is to scrape data from https://www.bankmega.com/ajax.promolainnya.php 
and pass the category numbers and pagination. However, that method will require to hardcode 
the category numbers (travel=1, lifestyle=2, ..., others=6). 
