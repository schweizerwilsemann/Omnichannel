# AI Model Evaluation Report
**Date:** November 29, 2025

This document details the performance evaluation of the **Menu Similarity Model**, which powers the "Find Similar Items" feature in the Customer UI.

## 1. Evaluation Methodology

The model is evaluated using a **Triplet Classification** task. We use a validation dataset (`menu_similarity_pairs.jsonl`) containing 296 manually curated triplets.

Each triplet consists of:
*   **Anchor:** The reference item (e.g., "Lobster Bisque").
*   **Positive:** An item that *should* be similar (e.g., "Crème Brûlée").
*   **Negative:** An item that *should not* be similar (e.g., "Pinot Grigio").

The AI model converts each of these into a **Vector** (a list of numbers representing meaning). We then calculate the **Cosine Similarity** (a score from -1 to 1) between them:
*   `sim_pos`: Similarity between **Anchor** and **Positive**.
*   `sim_neg`: Similarity between **Anchor** and **Negative**.

### Metric Calculations:

#### **Accuracy**
*   **Purpose:** Measures how often the model correctly ranks the Positive item higher than the Negative one.
*   **Logic:** For each triplet, if `sim_pos > sim_neg`, it's counted as a "Correct Prediction".
*   **Formula:**
    ```
    Accuracy = (Total Correct Predictions) / (Total Triplets)
    ```

#### **Average Positive Similarity**
*   **Purpose:** Shows, on average, how similar the model perceives the Anchor and Positive items to be.
*   **Logic:** Sums up the `sim_pos` for every triplet.
*   **Formula:**
    ```
    Avg Pos Sim = Sum(sim_pos for all triplets) / (Total Triplets)
    ```
    *(A value close to 1.0 means the model sees them as nearly identical.)*

#### **Average Negative Similarity**
*   **Purpose:** Shows, on average, how similar the model perceives the Anchor and Negative items to be.
*   **Logic:** Sums up the `sim_neg` for every triplet.
*   **Formula:**
    ```
    Avg Neg Sim = Sum(sim_neg for all triplets) / (Total Triplets)
    ```
    *(Ideally, this value should be significantly lower than the Average Positive Similarity.)*

#### **Average Margin**
*   **Purpose:** Indicates the average difference between the positive similarity score and the negative similarity score, reflecting the model's confidence in its distinction.
*   **Logic:** For each triplet, calculates the difference `(sim_pos - sim_neg)`.
*   **Formula:**
    ```
    Avg Margin = Sum(sim_pos - sim_neg for all triplets) / (Total Triplets)
    ```
    *(A larger margin indicates a more robust and confident distinction by the model.)*

### Metrics Used

1.  **Accuracy:** The percentage of triplets where the model correctly scores the *Positive* item higher than the *Negative* item relative to the *Anchor*.
    *   *Goal:* > 80% for a robust user experience.

2.  **Average Margin:** The average difference between the positive similarity score and the negative similarity score.
    *   *Goal:* A higher margin indicates the model can clearly distinguish between similar and dissimilar items.

3.  **Average Positive/Negative Similarity:** The raw cosine similarity scores.
    *   *Context:* Helps diagnose if the model is "collapsing" (mapping everything to the same vector space region).

## 2. Performance Results

| Metric | Value | Status |
| :--- | :--- | :--- |
| **Accuracy** | **87.84%** | ✅ **Excellent** |
| **Avg. Positive Similarity** | 0.9710 | ⚠️ High |
| **Avg. Negative Similarity** | 0.9550 | ⚠️ High |
| **Avg. Margin** | 0.0160 | ⚠️ Narrow |

### Interpretation

*   **High Accuracy (87.84%):** The model is very effective at ranking. When a user clicks "Find Similar", the system will almost always show relevant items before irrelevant ones. This meets the production requirement.
*   **High Similarity Scores (>0.95):** Both positive and negative pairs have extremely high cosine similarity. This suggests that the *structure* of the text (e.g., "Category: ... Description: ...") is dominating the embedding more than the semantic content. The model sees "Lobster Bisque" and "Pinot Grigio" as 95% similar because they both follow the exact same text template.
*   **Narrow Margin (0.016):** While the ranking is correct, the difference is tiny. The model is "confident but barely."

## 3. Recommendations for Improvement

1.  **Template Denoising:**
    *   *Issue:* The high baseline similarity is likely due to repeated prefixes like `Category:`, `Ingredients:`, `Dietary tags:`.
    *   *Fix:* Experiment with removing these static labels during embedding, or use a "pooling" strategy that weights unique tokens higher.

2.  **Hard Negatives Mining:**
    *   *Issue:* The current negative samples might be too easy or too distinct in a way that doesn't force the model to learn deep semantic differences.
    *   *Fix:* During training, select negative pairs that are *closer* to the anchor (e.g., same category but different ingredients) to force the model to push them apart.

3.  **Contrastive Loss Tuning:**
    *   *Issue:* The narrow margin suggests the loss function's margin parameter might be too small or the learning rate too low.
    *   *Fix:* Retrain with a larger margin (e.g., `margin=0.5`) in the Triplet Loss function to force a wider gap between positives and negatives.

## 4. Reproduction

To reproduce these results, run the evaluation script from the project root:

```bash
chat-infrastructure/rag_service/.venv/bin/python chat-infrastructure/rag_service/scripts/evaluate_similarity.py
```
