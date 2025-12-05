import json
import os
import sys
from sentence_transformers import SentenceTransformer, util
from tqdm import tqdm

def evaluate_model(model_path, data_path):
    print(f"Loading model from {model_path}...")
    try:
        model = SentenceTransformer(model_path)
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    print(f"Loading data from {data_path}...")
    pairs = []
    with open(data_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                pairs.append(json.loads(line))

    print(f"Evaluating on {len(pairs)} pairs...")
    
    correct_count = 0
    total_margin = 0
    total_pos_sim = 0
    total_neg_sim = 0
    total_count = 0

    # Pre-compute embeddings if possible, or just process one by one
    # For 300 items, one by one is fast enough
    
    for pair in tqdm(pairs):
        anchor_text = pair['anchor']
        positive_text = pair['positive']
        negative_text = pair['negative']

        # Encode
        embeddings = model.encode([anchor_text, positive_text, negative_text], convert_to_tensor=True)
        anchor_emb = embeddings[0]
        pos_emb = embeddings[1]
        neg_emb = embeddings[2]

        # Cosine similarity
        sim_pos = util.cos_sim(anchor_emb, pos_emb).item()
        sim_neg = util.cos_sim(anchor_emb, neg_emb).item()

        if sim_pos > sim_neg:
            correct_count += 1
        
        total_margin += (sim_pos - sim_neg)
        total_pos_sim += sim_pos
        total_neg_sim += sim_neg
        total_count += 1

    accuracy = correct_count / total_count if total_count > 0 else 0
    avg_margin = total_margin / total_count if total_count > 0 else 0
    avg_pos_sim = total_pos_sim / total_count if total_count > 0 else 0
    avg_neg_sim = total_neg_sim / total_count if total_count > 0 else 0

    print(f"\nResults:")
    print(f"Total Pairs: {total_count}")
    print(f"Correct Predictions: {correct_count}")
    print(f"Accuracy: {accuracy:.4f}")
    print(f"Average Positive Similarity: {avg_pos_sim:.4f}")
    print(f"Average Negative Similarity: {avg_neg_sim:.4f}")
    print(f"Average Margin (Pos - Neg): {avg_margin:.4f}")

if __name__ == "__main__":
    # Resolve paths relative to script location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    model_dir = os.path.join(project_root, "models", "menu-similarity-model")
    data_file = os.path.join(project_root, "data", "menu_similarity_pairs.jsonl")

    if not os.path.exists(model_dir):
        print(f"Model directory not found: {model_dir}")
        sys.exit(1)

    if not os.path.exists(data_file):
        print(f"Data file not found: {data_file}")
        sys.exit(1)

    evaluate_model(model_dir, data_file)