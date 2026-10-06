# Dish recognition: model card

ThaliSense recognises Indian dishes from a photo entirely in the browser. This page records what the model is, how it was chosen and adapted, how well it works, and where it fails. Every number here can be reproduced with the scripts in [`scripts/vision`](../scripts/vision).

## What runs on the phone

| | |
|---|---|
| Image encoder | [MobileCLIP-S2](https://huggingface.co/Xenova/mobileclip_s2) vision tower, fp16 ONNX, 72 MB, downloaded once and cached |
| Runtime | Transformers.js on ONNX Runtime Web: WebGPU when available, otherwise WebAssembly with 4 threads (the site is cross-origin isolated) |
| Dish vectors | 108 × 512 int8 vectors (76 KB) in [`src/vision/labels.json`](../src/vision/labels.json) |
| Speed | 0.7–0.9 s per photo with 4 WASM threads on a laptop (headless Chromium); much faster on WebGPU |
| Privacy | The photo is decoded, scaled and encoded inside a Web Worker. It is never uploaded. |

Scoring is cosine similarity between the photo's embedding and each dish vector, scaled by 100 and softmaxed. The app shows the top dishes for the user to confirm; nothing is logged without a tap.

## How the dish vectors are made

1. **Prompt ensemble.** For each of the 108 dishes, four prompts are encoded with the MobileCLIP text tower (fp32) and averaged, e.g. *“a photo of idli, soft white round steamed rice cakes.”* The visual descriptions live in [`looks.ts`](../scripts/vision/looks.ts).
2. **Few-shot adaptation.** For the 40 dishes with labelled training photos, the text vector moves towards the mean image embedding of those photos, after shifting that mean by the *modality gap* (average text vector minus average image centroid) so adapted and unadapted dishes stay on the same similarity scale:

   `t'_c = normalize((1 − λ) · t_c + λ · normalize(μ_c + g))`

   The model cost doesn't change: it is still one vector per dish.
3. **Choosing λ without peeking.** λ is picked on held-out *training* photos using a class split: adapt half the dishes, then measure accuracy on both the adapted half and the untouched half, and swap. This stops a λ that helps adapted dishes by stealing predictions from others. The test and Wikipedia photos are never used to fit or choose anything.

## Results

**Test photos:** 1,694 photos from the test splits of three public datasets (below), covering 47 labels and 40 of our dishes. **Wikipedia:** 30 lead photos from Wikipedia dish articles, mostly dishes *without* training photos, so it shows how the model does on dishes it was not adapted to.

A prediction counts as correct if it is any acceptable dish for the label (for example, any biryani for a photo labelled *biryani*).

| Model (zero-shot) | Download | Test top-1 | Test top-3 | Wikipedia top-1 | Wikipedia top-3 |
|---|---|---|---|---|---|
| CLIP ViT-B/32 (v1.0 of the app) | 89 MB | 71.5% | 86.8% | 70.0% | 80.0% |
| CLIP ViT-B/16 | 87 MB | 73.6% | 87.9% | 73.3% | 86.7% |
| MobileCLIP-S2 (fp16) | 72 MB | 81.5% | 92.9% | 80.0% | 96.7% |
| **MobileCLIP-S2 + few-shot (shipped)** | **72 MB** | **87.8%** | **95.0%** | **80.0%** | **93.3%** |

Also tried:

- **SigLIP B/16:** both runs were cut off by network errors while downloading; not used.
- **MobileCLIP-S2 int8:** chance-level accuracy (0.4%). The int8 export breaks its convolutions, so the fp16 build ships.
- **Test-time mirror augmentation:** 88.1% top-1 on the test photos (+0.3) but 76.7% on Wikipedia (−3.3), at twice the compute. Not used.
- **Per-dish bias calibration after adaptation:** lower validation accuracy at every λ. Not used.

The adaptation has a cost: on validation, dishes *without* training photos lose about 3 points of top-1 (76.3% → 73.3%) while adapted dishes gain about 10 (76.3% → 86.8%). The adapted dishes are the common ones (roti, dal, biryani, dosa, chole and so on), so the overall gain is large.

## Whole-thali detection

A single image classifier names one dish. To read a thali, the worker answers with the whole-photo ranking first, then encodes five overlapping regions (four corners and the centre, each 60% of the photo). Any dish a region is at least 20% confident about is added. When two or more regions find different dishes, the app treats the photo as a thali: it ticks those dishes and unticks whole-photo guesses no region supports.

Measured on 200 synthetic plates, each with 4 different dishes from the test photos placed as round katoris at random, non-overlapping positions (so the regions do not line up with the dishes by construction):

| Strategy | Dishes found | Suggestions per plate | Suggestions correct |
|---|---|---|---|
| Whole photo, top 4 | 25.4% | 4.0 | 28% |
| Whole photo, top 8 | 39.0% | 8.0 | 22% |
| **Top 4 + plate regions (shipped)** | **55.0%** | **5.8** | **40%** |

## Data

| Dataset | Used for | Photos used | License |
|---|---|---|---|
| [bharat-raghunathan/indian-foods-dataset](https://huggingface.co/datasets/bharat-raghunathan/indian-foods-dataset) | train + test | 480 + 715 | CC0 1.0 |
| [rajistics/indian_food_images](https://huggingface.co/datasets/rajistics/indian_food_images) | train + test | 600 + 724 | not stated on Hugging Face |
| [pri12354/indian_food_images](https://huggingface.co/datasets/pri12354/indian_food_images) (80 dishes) | train + test | 1,354 + 255 | not stated on Hugging Face |
| Wikipedia article photos | test only | 30 | various Wikimedia Commons licenses |

None of these photos are redistributed with the app or the repository. The app ships only the 108 averaged 512-number vectors, from which no photo can be recovered. Test fixtures in `tests/e2e/fixtures` are separately licensed Wikimedia Commons photos, credited there.

## Limitations

- **68 of the 108 dishes have no training photos.** Zero-shot is weaker on them, especially on look-alikes: dal vs sambar, plain vs masala dosa, the four biryanis, chai vs coffee.
- **The test photos are web images,** often well lit and plated. Phone photos of home food will usually score lower than the numbers above.
- **Portion size is not estimated from the photo.** The user sets servings.
- **Thali detection was measured on synthetic plates.** Real thalis with overlapping katoris and rice in the middle are harder.

## Reproduce

```bash
# photos: build a manifest.json of { path, split, source, label, accept[] }
npx vite-node scripts/vision/eval.ts -- --manifest <dir>/manifest.json --models clip-b32,clip-b16,mobileclip-s2
npx vite-node scripts/vision/fewshot.ts -- --manifest <dir>/manifest.json --model mobileclip-s2 --write
npx vite-node scripts/vision/thali.ts -- --thali <dir>/thali.json
```
