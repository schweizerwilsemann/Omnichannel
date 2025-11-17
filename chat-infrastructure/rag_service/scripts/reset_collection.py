#!/usr/bin/env python3
"""
Reset Qdrant Collection
-----------------------
Deletes and recreates the Qdrant collection to remove all old duplicate documents.
Use this after fixing the vector store upsert logic to clean up existing duplicates.

Usage:
    python scripts/reset_collection.py
"""

import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from qdrant_client import QdrantClient


def reset_collection():
    """Delete and recreate the Qdrant collection."""
    settings = get_settings()
    client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)

    collection_name = settings.qdrant_collection

    print(f"Connecting to Qdrant at {settings.qdrant_host}:{settings.qdrant_port}")
    print(f"Target collection: {collection_name}")

    # Check if collection exists
    try:
        collection_info = client.get_collection(collection_name)
        vector_count = collection_info.points_count
        print(f"\n✓ Collection exists with {vector_count} documents")

        # Confirm deletion
        response = input(
            f"\n⚠️  This will DELETE all {vector_count} documents. Continue? (yes/no): "
        )
        if response.lower() not in ["yes", "y"]:
            print("Aborted.")
            return

        # Delete collection
        print(f"\nDeleting collection '{collection_name}'...")
        client.delete_collection(collection_name)
        print("✓ Collection deleted")

    except Exception as e:
        print(f"\n✓ Collection doesn't exist yet (this is fine)")

    print("\nCollection has been reset.")
    print("\n📋 Next steps:")
    print("1. Restart the RAG service (if not using auto-reload)")
    print("2. Go to admin panel: http://localhost:3000/admin")
    print("3. Click 'Run knowledge sync' to populate with fresh data")
    print("4. Click 'Clear chat cache'")
    print("5. Test the chatbot in a new session")
    print("\n✨ The collection will be auto-created on the next sync!")


if __name__ == "__main__":
    try:
        reset_collection()
    except KeyboardInterrupt:
        print("\n\nAborted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
