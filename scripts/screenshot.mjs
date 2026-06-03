import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out  = join(root, 'public', 'screenshots', 'mobile.png')
mkdirSync(join(root, 'public', 'screenshots'), { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()

await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' })

// Seed onboardingComplete so we land on Today, not Onboarding
await page.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open('tfpt-db', 1)
  req.onsuccess = () => {
    const db = req.result
    const tx = db.transaction('settings', 'readwrite')
    tx.objectStore('settings').put(true, 'onboardingComplete')
    tx.oncomplete = resolve
    tx.onerror = reject
  }
  req.onerror = reject
}))

await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.today-screen', { timeout: 8000 })
await page.waitForTimeout(1000)

await page.screenshot({ path: out })
console.log('saved:', out)
await browser.close()
