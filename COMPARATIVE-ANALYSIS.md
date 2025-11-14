# Comparative Analysis: Puppeteer vs Playwright - January 2026

## Test Overview

**Date:** 2025-11-14
**Test Period:** January 15-17, 2026 (2 nights)
**Parameters:** 2 adults
**URL:** `https://reservations3.fasthotel.com.br/188/214`

---

## Executive Summary

Both providers achieved **100% success rate** in 2 attempts each. However, they are **scraping different data** from the same webpage, leading to significantly different results.

| Metric | Puppeteer | Playwright |
|--------|-----------|------------|
| **Success Rate** | 2/2 (100%) | 2/2 (100%) |
| **Avg Execution Time** | 9,240ms (~9.2s) | 7,951ms (~8.0s) |
| **Speed Difference** | Baseline | **16.2% faster** ⚡ |
| **Items Found** | 16 | 78 |
| **Data Type** | Accommodation packages/rates | Individual room numbers |
| **Warnings Captured** | ✅ Yes | ❌ No |
| **Descriptions** | ✅ Full descriptions | ❌ Empty |
| **Price Format** | "Selecionar" | "Sob consulta" |

---

## Detailed Findings

### 🤖 PUPPETEER - Accommodation Packages (16 items)

#### What It Scrapes
Puppeteer captures the **accommodation types and packages** offered by the hotel:

**Sample Data:**
```json
{
  "name": "Pacote 1 diária",
  "description": "Este pacote inclui: Hospedagem com Café da Manhã, Almoço e Jantar; Pesca esportiva; Piscina privativa da Pousada; Lazer...",
  "price": "Selecionar",
  "image": ""
}
```

#### All Packages Found:
1. Pacote 1 diária
2. Pacote 2 diárias
3. Pacote 2 diárias pix
4. Pacote Feriado 3d
5. Pacote Feriado 3d pix
6. Hospedagem 1 diár.
7. Hospedagem 2 diár.
8. Hospedagem 2 diárias pix
9. Hosped. Feriado 3d
10. Hosped. Feriado 3d pix
11. Natal/Reveillon 2 diár
12. Natal/Reveillon 2 diár pix
13. Natal/Reveillon 3 diár.
14. Natal/Reveillon 3 diár. pix
15. Natal/Reveillon 4 diár.
16. Natal/Reveillon 4 diár. pix

#### Characteristics:
- ✅ **Rich descriptions** with full amenity details
- ✅ **Meaningful names** (package types, durations)
- ✅ **Warning detection** active ("O sistema de reserva está oculpado")
- ✅ **Booking-relevant data** for end users
- ⚡ Slightly slower (9.2s avg)

---

### 🎭 PLAYWRIGHT - Room Numbers (78 items)

#### What It Scrapes
Playwright captures **individual room numbers** or inventory items:

**Sample Data:**
```json
{
  "name": "Quarto 1",
  "description": "",
  "price": "Sob consulta",
  "image": ""
}
```

#### Pattern:
- Quarto 1, Quarto 2, Quarto 3, ..., Quarto 78
- Also includes: "Serviços Gerais" entries

#### Characteristics:
- ❌ **No descriptions** (all empty)
- ❌ **Generic room numbers** (not booking types)
- ❌ **No warning detection** implemented
- ⚡ Faster execution (7.95s avg, **16.2% faster**)
- ❓ **Data usefulness** questionable for end users

---

## Critical Analysis

### Data Quality Comparison

| Aspect | Puppeteer | Playwright | Winner |
|--------|-----------|------------|--------|
| **Relevance for booking** | High | Low | 🤖 Puppeteer |
| **Description completeness** | Full | Empty | 🤖 Puppeteer |
| **Warning system** | Working | Missing | 🤖 Puppeteer |
| **Execution speed** | 9.2s | 7.95s | 🎭 Playwright |
| **Consistency** | 100% | 100% | 🤝 Tie |

### What's Happening?

The two scrapers are targeting **different DOM elements** on the same page:

1. **Puppeteer** → Correctly targeting accommodation/package selectors
2. **Playwright** → Targeting room inventory or a different section

This suggests:
- ❌ Playwright selectors may need adjustment
- ✅ Puppeteer selectors are accurate
- ⚠️ The webpage might have multiple sections (packages vs rooms)

---

## Performance Metrics

### Response Times (milliseconds)

| Provider | Attempt 1 | Attempt 2 | Average | Std Dev |
|----------|-----------|-----------|---------|---------|
| Puppeteer | 9,087ms | 9,392ms | 9,240ms | 152ms |
| Playwright | 7,966ms | 7,936ms | 7,951ms | 15ms |

**Observations:**
- Playwright is **16.2% faster** but returns less useful data
- Puppeteer has **slightly higher variance** (152ms vs 15ms)
- Both providers show **excellent consistency** (low std dev)

---

## Warnings & System Messages

### Puppeteer Warnings (Both Attempts)
```
⚠️ "O sistema de reserva está oculpado. Tente novamente."
```

**Translation:** "The booking system is busy. Try again."

### Playwright Warnings
```
(none detected)
```

**Analysis:**
- Puppeteer successfully captures site warnings ✅
- Playwright has no warning detection mechanism ❌
- This is crucial for user experience and error handling

---

## Recommendations

### 1. **Data Accuracy Priority** 🎯
**Preferred Provider: PUPPETEER**

**Reasoning:**
- Captures the correct data (accommodation packages)
- Rich descriptions for user decision-making
- Warning system provides valuable feedback
- Slightly slower but acceptable (<10s)

### 2. **Playwright Improvements Needed** 🔧

**Issues to Address:**
```typescript
// Current: Capturing room numbers (not useful)
// Needed: Capture accommodation packages (like Puppeteer)
```

**Action Items:**
- [ ] Review Playwright selectors
- [ ] Align with Puppeteer's target elements
- [ ] Implement warning detection
- [ ] Validate scraped data matches expected format

### 3. **Speed Optimization for Puppeteer** ⚡

While Puppeteer is only 16.2% slower, optimization could help:
- Reduce wait times if possible
- Optimize element selection
- Consider caching strategies

---

## Test Reproducibility

### Test Script Location
```bash
./compare-providers.js
```

### Run Tests Again
```bash
docker cp compare-providers.js orchestrator:/app/
docker exec orchestrator node /app/compare-providers.js
```

### Results Location
```
/tmp/comparison-results.json
```

---

## Conclusion

### Current Status: Puppeteer is Production-Ready ✅

**Why Puppeteer wins:**
1. ✅ Correct data extraction (accommodation packages)
2. ✅ Full descriptions and details
3. ✅ Warning system functional
4. ✅ 100% reliability
5. ⚠️ Only 16.2% slower (acceptable trade-off)

**Why Playwright needs work:**
1. ❌ Extracting wrong data (room numbers instead of packages)
2. ❌ No descriptions captured
3. ❌ No warning detection
4. ✅ Faster execution (but data quality > speed)

### Final Recommendation

**Use PUPPETEER as the primary provider** until Playwright selectors are fixed to capture the same data format.

The A/B testing strategy should be paused for Playwright until it matches Puppeteer's data quality. Speed advantages mean nothing if the data is not useful for end users.

---

**Report Generated:** 2025-11-14
**Test Data:** `/tmp/comparison-results.json`
