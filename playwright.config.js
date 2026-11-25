import {defineConfig} from '@playwright/test';
const port=Number(process.env.PORT||18787);
// Every test/*.spec.js runs. The node unit tests (*.test.js) are not Playwright specs.
// To keep a spec out of the run, add its file name to testIgnore below.
const testIgnore=[];
export default defineConfig({testDir:'./test',testMatch:/\.spec\.js$/,testIgnore,timeout:45000,expect:{timeout:6000},reporter:'list',use:{baseURL:`http://127.0.0.1:${port}`,browserName:process.env.PW_BROWSER||'chromium',headless:true,viewport:{width:1600,height:1000}},webServer:{command:`npm run build && HOST=127.0.0.1 PORT=${port} node scripts/serve-dist.mjs`,url:`http://127.0.0.1:${port}/health`,reuseExistingServer:false,timeout:30000}});
