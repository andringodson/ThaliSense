# Hack-A-Throne National Hackathon 2026: Round 1 form answers

Copy each block into the matching field on Unstop. Round 1 closes 15 Oct 2026.

---

## Domain

HealthTech & Wellbeing

---

## Problem statement

India has 101 million people with diabetes and 136 million more with prediabetes (ICMR-INDIAB, Lancet Diabetes & Endocrinology 2023), and most of it is driven by everyday food: large portions of white rice, refined flour, fried snacks and sweet chai. The tools people have don't fit them. Calorie apps are built for Western diets: they don't know pesarattu, bisi bele bath or kadhi, and can't read "do roti aur dahi". They use global BMI cut-offs, even though South Asians develop diabetes at a lower body weight, so people already at risk are told they are fine. Advice like "eat less rice" doesn't stick, a dietitian is unaffordable for most families, and many people won't upload meal photos and health data to a server. India needs a free, private nutrition coach that understands Indian food and measures risk the Indian way.

---

## Proposed solution

ThaliSense is a free web app: an on-device AI nutrition and metabolic-health coach built for Indian meals.

1. Log by typing in your own words ("3 idli with sambar and coffee", "do paratha aur dahi", "rendu dosai"). A parser covering 108 Indian dishes handles quantities, Hindi and Tamil number words, regional names and typos.
2. Log by photo, even a whole thali. A vision model fine-tuned for Indian food runs inside the browser (87.8% top-1, 95% top-3 on 1,694 test photos), scans regions of the plate to find several dishes, and suggests the usual sides; the user confirms with one tap.
3. Know your real risk with the validated Indian Diabetes Risk Score (MDRF), BMI with Asian Indian cut-offs (overweight from 23) and waist-to-height ratio. High-risk users are told to get a blood test.
4. An explainable coach agent reviews the past week, finds the biggest problems (carb-heavy plates, low protein, sugary drinks) and suggests swaps for foods the person already eats, showing each swap's weekly calorie, protein and fibre impact.
5. It drafts a 7-day regional meal plan (South, North, East or West; veg, egg or non-veg) within a ₹/day budget, then verifies each day against the targets and repairs any misses. Every step is shown to the user.

Every meal also gets a 0–100 plate score, and weekly weight and waist entries show progress towards the goals. Nothing leaves the phone: no account, no server, no paid API. It installs like an app and works offline.

---

## Project description

ThaliSense turns the food people already love into a personal, explainable plan for preventing diabetes and obesity.

The Today screen lets users log meals by typing or by photo and shows calories, protein, fibre, carbs and fat against personal targets, with coach-picked ideas for the next meal that fit what is left of the day. The Coach screen runs an agent with eight visible tool steps (assess_profile, review_logs, detect_patterns, suggest_swaps, plan_week, verify_plan, check_budget, set_nudges); the user watches it reason, then sees its insights, swaps with measured weekly impact, and habits such as a 10-minute walk after meals. The Plan screen shows a 7-day regional menu with daily totals, cost against budget and notes on what the coach adjusted; one tap logs a planned meal. The Health screen holds the profile, weight and waist trends, and a transparent breakdown of the risk scores.

A working MVP is already live at https://thalisense.vercel.app with a one-click demo week. We benchmarked four vision models on 1,694 labelled photos from three public datasets, chose MobileCLIP-S2 and fine-tuned it with few-shot adaptation: 87.8% top-1 and 95.0% top-3, up from 71.5% and 86.8% for standard CLIP. Scanning five plate regions doubles the dishes found on a thali. The user confirms from a shortlist, so a wrong guess costs one tap. Because all computation runs on the user's device, running costs stay near zero at any scale, and the same app could support ASHA workers screening villages offline.

ThaliSense is a wellness guide, not a medical device. It does not diagnose anything.

Live: https://thalisense.vercel.app
Code: https://github.com/andringodson/ThaliSense

---

## Technology stack

React 19, TypeScript, Vite; Transformers.js on ONNX Runtime Web (WebGPU or multi-threaded WebAssembly) running Apple's MobileCLIP-S2 vision encoder in a Web Worker, with 108 dish vectors built from descriptive prompts and few-shot adapted on 2,354 labelled photos; a deterministic tool-based coach agent in TypeScript; nutrition data based on IFCT 2017 (ICMR-NIN); Indian Diabetes Risk Score (MDRF), Asian BMI consensus and ICMR-NIN 2024 guidelines; Vitest unit tests and Playwright end-to-end tests including an axe accessibility scan; GitHub Actions CI; Vercel hosting; installable PWA with a service worker. No backend and no paid APIs.

---

## Round 2 (21–23 Oct, if shortlisted)

- GitHub repository: https://github.com/andringodson/ThaliSense
- Live project: https://thalisense.vercel.app
- Demo video: upload [ThaliSense-demo.mp4](https://github.com/andringodson/ThaliSense/releases/download/v1.1/ThaliSense-demo.mp4) to Google Drive (sharing: anyone with the link) and paste that link
