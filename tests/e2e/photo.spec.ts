import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// Downloads the 72 MB vision model, so it runs locally rather than on every CI push.
test.skip(!!process.env.CI, 'needs the vision model download')
test.setTimeout(300_000)

test('recognises idli from a photo and finds more dishes on a thali', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop')
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: /try with a demo week/i }).click()
  expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true)
  await page.getByRole('button', { name: /log from a photo/i }).click()
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('fixtures/idli.jpg', import.meta.url)))
  const first = page.locator('.cands li').first()
  await expect(first).toContainText('Idli', { timeout: 240_000 })
  await expect(first.locator('input[type=checkbox]')).toBeChecked()
  await expect(page.getByText(/Checking the rest of the plate/)).toBeHidden({ timeout: 60_000 })

  await page.getByRole('button', { name: 'Another photo' }).click()
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('fixtures/thali.jpg', import.meta.url)))
  await expect(page.locator('.cands li').first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/Checking the rest of the plate/)).toBeHidden({ timeout: 60_000 })
  const names = await page.locator('.cands li .cand-name').allInnerTexts()
  const ticked = await page.locator('.cands li.on .cand-name').allInnerTexts()
  console.log('thali suggestions:', names.join(' | '), '· ticked:', ticked.join(' | '))
  // The plate holds samosa, jalebi, dhokla and pav bhaji.
  const onPlate = ['Samosa', 'Jalebi', 'Dhokla', 'Pav Bhaji']
  expect(onPlate.filter((d) => names.some((n) => n.startsWith(d))).length).toBeGreaterThanOrEqual(3)
  expect(onPlate.filter((d) => ticked.some((n) => n.startsWith(d))).length).toBeGreaterThanOrEqual(2)
})
