import { chromium } from 'playwright'
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'

const BASE = 'https://thalisense.vercel.app'
const V = '../video2'
const FX = '../ts/tests/e2e/fixtures'
const dur = JSON.parse(readFileSync(`${V}/durations.json`, 'utf8'))
const PAD = 700
const W = 1280, H = 720

const cursorScript = `
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div')
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,154,60,.35);border:2px solid #ff9a3c;z-index:99999;pointer-events:none;transition:transform 120ms;'
    document.body.appendChild(c)
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
    addEventListener('mousedown', () => { c.style.transform = 'scale(.7)' }, true)
    addEventListener('mouseup', () => { c.style.transform = '' }, true)
  })`

async function open(record) {
  const ctx = await chromium.launchPersistentContext(`${V}/profile`, {
    viewport: { width: W, height: H },
    colorScheme: 'dark',
    ...(record ? { recordVideo: { dir: `${V}/raw`, size: { width: W, height: H } } } : {}),
  })
  await ctx.addInitScript(cursorScript)
  return { ctx, page: ctx.pages()[0] ?? (await ctx.newPage()) }
}

// Warm-up: cache the app, fonts and the vision model.
{
  const { ctx, page } = await open(false)
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: /demo week/i }).click()
  await page.getByRole('button', { name: /log from a photo/i }).click()
  await page.locator('input[type=file]').setInputFiles(`${FX}/thali.jpg`)
  await page.locator('.cands li').first().waitFor({ timeout: 300000 })
  await page.getByText(/Checking the rest of the plate/).waitFor({ state: 'hidden', timeout: 60000 })
  await page.evaluate(() => localStorage.clear())
  await ctx.close()
  console.log('warm-up done')
}

rmSync(`${V}/raw`, { recursive: true, force: true })
const { ctx, page } = await open(true)
const t0 = Date.now()
const marks = {}
const sleep = (ms) => page.waitForTimeout(ms)
async function moveTo(locator, click = true) {
  await locator.scrollIntoViewIfNeeded()
  const b = await locator.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 22 })
  if (click) { await sleep(150); await page.mouse.down(); await page.mouse.up() }
}
async function scrollBy(dy, steps = 30, ms = 1200) {
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(ms / steps) }
}
async function scene(id, fn) {
  const start = Date.now()
  marks[id] = (start - t0) / 1000
  await fn()
  const left = dur[id] * 1000 + PAD - (Date.now() - start)
  if (left > 0) await sleep(left)
}
const nav = (name) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name })

await page.goto(BASE)
await page.waitForSelector('text=Try with a demo week')
await page.mouse.move(W / 2, H / 2)
await sleep(500)

await scene('s3', async () => {
  await sleep(1500)
  await moveTo(page.getByRole('button', { name: /demo week/i }))
  await page.waitForSelector('text=Breakfast')
  await sleep(3000)
  await moveTo(page.locator('.summary .ring'), false)
  await sleep(2500)
  await scrollBy(430, 30, 1500)
  await moveTo(page.locator('.plate-score').first(), false)
  await sleep(3000)
  await scrollBy(-430, 20, 900)
})

await scene('s4', async () => {
  await moveTo(page.getByRole('tab', { name: 'Lunch' }))
  await moveTo(page.getByLabel('Describe your meal'))
  await sleep(300)
  await page.keyboard.type('2 chapathi, dal and half cup curd', { delay: 90 })
  await sleep(3200)
  await moveTo(page.getByRole('button', { name: 'Add', exact: true }))
  await sleep(1000)
  await scrollBy(430, 30, 1500)
  await sleep(2200)
  await scrollBy(-430, 20, 900)
})

await scene('s5', async () => {
  await moveTo(page.getByRole('button', { name: /log from a photo/i }))
  await sleep(1000)
  await page.locator('input[type=file]').setInputFiles(`${FX}/thali.jpg`)
  await page.locator('.cands li').first().waitFor({ timeout: 60000 })
  await page.getByText(/Checking the rest of the plate/).waitFor({ state: 'hidden', timeout: 60000 })
  await sleep(1500)
  for (const n of ['Samosa', 'Jalebi', 'Dhokla', 'Pav Bhaji']) {
    await moveTo(page.locator('.cands li', { hasText: n }).locator('.cand-name'), false)
    await sleep(700)
  }
  await sleep(1500)
  await moveTo(page.getByRole('button', { name: /^Add \d+ to/ }))
})

await scene('s6', async () => {
  await moveTo(nav('Coach'))
  await sleep(700)
  await moveTo(page.getByRole('button', { name: /run coach/i }).first())
  await sleep(4000)
  await scrollBy(520, 40, 4000)
  await page.waitForSelector('text=See the 7-day plan', { timeout: 20000 })
  await sleep(600)
  await scrollBy(700, 40, 3500)
  await sleep(2200)
  await scrollBy(800, 40, 3500)
})

await scene('s7', async () => {
  await moveTo(page.getByRole('button', { name: /see the 7-day plan/i }))
  await sleep(2200)
  const days = page.locator('.days button')
  await moveTo(days.nth(1))
  await sleep(1800)
  await moveTo(page.locator('.plan-side .revisions'), false)
  await sleep(2500)
  await moveTo(page.getByRole('button', { name: /ate this today/i }).first())
  await sleep(1200)
  await moveTo(page.getByRole('button', { name: /share plan/i }), false)
})

await scene('s8', async () => {
  await moveTo(nav('Health'))
  await sleep(1200)
  await moveTo(page.locator('.idrs'), false)
  await sleep(3500)
  await moveTo(page.locator('.trend').first(), false)
  await sleep(2500)
  await moveTo(page.locator('.trend').nth(1), false)
})

const end = (Date.now() - t0) / 1000
await ctx.close()
const file = readdirSync(`${V}/raw`).filter((f) => f.endsWith('.webm')).sort().pop()
writeFileSync(`${V}/marks.json`, JSON.stringify({ marks, end, file }, null, 1))
console.log({ marks, end, file })
